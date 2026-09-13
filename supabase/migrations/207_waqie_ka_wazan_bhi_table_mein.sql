-- =====================================================================
-- Migration 207: Waqie ka wazan bhi table mein -- code mein nahi
-- =====================================================================
-- Factor ka wazan to table mein rakha gaya tha (201), magar HAR WAQIE
-- KA APNA WAZAN code ke andar likha reh gaya: +5, +10, -20.
--
-- Us ka anjaam ye hota ke bahar ka wazan badalna aasan hota aur andar
-- ka behaviour code mein jama hota rehta -- aur har naye source ke sath
-- aur phailta. Payments/Credit shuru karne se pehle usay rok dena
-- behtar hai, warna do jagah do qism ke number rehte: kuch table mein,
-- kuch code mein, aur koi nahi jaanta ke kaunsa kahan hai.

create table if not exists score_event_severity (
  subject_type   text not null,
  factor_key     text not null,
  event_type     text not null,
  direction      smallint not null check (direction in (-1, 1)),
  magnitude      numeric(6,3) not null check (magnitude > 0),
  never_decays   boolean not null default false,
  label          text not null,
  engine_version int not null default 1,
  primary key (subject_type, factor_key, event_type, engine_version)
);

alter table score_event_severity enable row level security;
drop policy if exists p_score_severity_read on score_event_severity;
create policy p_score_severity_read on score_event_severity for select using (fn_is_any_staff());

insert into score_event_severity
  (subject_type, factor_key, event_type, direction, magnitude, never_decays, label) values
  ('farmer','commitment_reliability','rate_confirmed',           1,  5, false, 'Kisan ne rate ki tasdeeq ki'),
  ('farmer','commitment_reliability','rate_confirmed_by_staff',  1,  3, false, 'Tasdeeq daftar ke bandey se aayi'),
  ('farmer','commitment_reliability','work_completed',           1, 10, false, 'Kaam poora hua'),
  ('farmer','commitment_reliability','cancelled_after_start',   -1, 10, false, 'Kaam shuru hone ke baad mansookh'),
  ('farmer','credit_repayment','bill_settled',                   1, 10, false, 'Bill poora ada hua'),
  ('farmer','credit_repayment','bill_unpaid',                   -1, 10, true,  'Bill baqi -- tareekh guzar chuki'),
  ('farmer','payment_punctuality','paid_on_time',                1, 10, false, 'Waqt par diya'),
  ('farmer','payment_punctuality','paid_late_1_7',              -1,  4, false, 'Ek hafte tak der'),
  ('farmer','payment_punctuality','paid_late_8_30',             -1,  8, false, 'Ek mahine tak der'),
  ('farmer','payment_punctuality','paid_late_31_90',            -1, 14, false, 'Teen mahine tak der'),
  ('farmer','payment_punctuality','paid_late_90_plus',          -1, 20, false, 'Teen mahine se ziyada der'),
  ('farmer','payment_punctuality','overdue',                    -1, 20, true,  'Tareekh guzar chuki, raqam baqi'),
  ('vendor','farmer_confirmation','confirmed',                   1,  5, false, 'Kisan se tasdeeq karwayi'),
  ('vendor','job_completion','completed',                        1, 10, false, 'Kaam poora kiya')
on conflict do nothing;

-- Wazan poochhne ka waahid darwaza. Na mile to KHALI lautta hai, koi
-- farzi qeemat nahi -- warna anjaan waqia chup chaap kisi wazan par gin
-- liya jata.
create or replace function fn_score_severity(p_subject_type text, p_factor text, p_event_type text)
returns table (direction smallint, magnitude numeric, never_decays boolean)
language sql stable security definer set search_path to 'public' as $$
  select s.direction, s.magnitude, s.never_decays
    from score_event_severity s
   where s.subject_type = p_subject_type and s.factor_key = p_factor
     and s.event_type = p_event_type
     and s.engine_version = fn_score_engine_version();
$$;

-- Ab waqia daalne wala function apna wazan khud nahi jaanta -- table se
-- poochhta hai. Wazan na mile to kaam RUKTA hai, chalta nahi: anjaan
-- waqia chup chaap gin lena us se bura hai ke kaam ruk jaye.
create or replace function fn_score_put_event(
  p_subject_type text, p_subject_id uuid, p_factor text, p_event_type text,
  p_occurred timestamptz, p_source_table text, p_source_id uuid,
  p_evidence text default 'verified', p_decay_from timestamptz default null,
  p_note text default null, p_scale numeric default 1)
returns void language plpgsql security definer set search_path to 'public' as $$
declare e record; sev record;
begin
  select * into sev from fn_score_severity(p_subject_type, p_factor, p_event_type);
  if not found then
    raise exception 'Score: "%" ka wazan table mein nahi hai (% / %). Pehle score_event_severity mein daalein.',
      p_event_type, p_subject_type, p_factor;
  end if;

  select * into e from score_events
   where source_table = p_source_table and source_id = p_source_id
     and factor_key = p_factor and event_type = p_event_type
     and invalidated_at is null;

  if found then
    if e.direction = sev.direction and e.magnitude = round(sev.magnitude * p_scale, 3)
       and e.occurred_at = p_occurred and e.evidence_state = p_evidence
       and e.never_decays = sev.never_decays and e.subject_id = p_subject_id then
      return;
    end if;
    update score_events
       set invalidated_at = now(), invalidated_reason = 'asal record badla -- durusti'
     where id = e.id;
  end if;

  insert into score_events (subject_type, subject_id, factor_key, event_type,
    direction, magnitude, occurred_at, decay_from, never_decays,
    source_table, source_id, evidence_state, verified_at, note)
  values (p_subject_type, p_subject_id, p_factor, p_event_type,
    sev.direction, round(sev.magnitude * p_scale, 3), p_occurred,
    coalesce(p_decay_from, p_occurred), sev.never_decays,
    p_source_table, p_source_id, p_evidence,
    case when p_evidence = 'verified' then now() end, p_note);
end;
$$;

-- Purana wala hata do -- warna do version chalte rahenge aur ek code
-- mein likhe hue wazan par chalta rahega.
drop function if exists fn_score_put_event(text, uuid, text, text, int, numeric, timestamptz, text, uuid, text, boolean, timestamptz, text);
