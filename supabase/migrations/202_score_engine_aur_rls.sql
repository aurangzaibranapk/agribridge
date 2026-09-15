-- =====================================================================
-- Migration 202: Score ka engine, aur us par pehra
-- =====================================================================
-- Engine database mein hai, code mein nahi. Wajah: rok ka faisla usi
-- jagah hona chahiye jahan data rehta hai. Sirf safhe par chhupana
-- kaafi nahi -- kisi bhi doosre raaste se wohi adad bahar aa jata.
-- ---------------------------------------------------------------

-- ---------------------------------------------------------------
-- 1) Darja -- ek hi jagah
-- ---------------------------------------------------------------
-- Ye chhota sa function is liye alag hai ke pehle ye hisaab likhne
-- wale ki yaad par tha, aur wahin ghalti hui: 86 ko "Gold" likh diya
-- gaya jabke wo Platinum hai. Aisi ghalti ek jagah nahi rehti -- gauge
-- kuch dikhata hai, eligibility ka safha kuch aur, aur report teesri
-- baat kehti hai. Ab har jagah yahin se poochhegi.
create or replace function fn_score_band(p_score int)
returns text language sql immutable as $$
  select case
    when p_score is null  then null
    when p_score <= 20    then 'low'
    when p_score <= 40    then 'bronze'
    when p_score <= 60    then 'silver'
    when p_score <= 80    then 'gold'
    else 'platinum'
  end;
$$;

create or replace function fn_score_engine_version()
returns int language sql stable as $$
  select coalesce(max(engine_version), 1) from score_factor_weights;
$$;

-- ---------------------------------------------------------------
-- 2) Waqt ka asar
-- ---------------------------------------------------------------
-- Achhe aur bure waqiat par ek hi paimana -- warna waqt khud ek riayat
-- ban jata.
--
-- JO HAL NAHI HUA WO PURANA NAHI HOTA. Jab tak raqam baqi hai, us ka
-- waqia poore wazan par khara rehta hai -- chahe do saal guzar jayein.
-- Ginti us din se shuru hoti hai jis din wo hal hota hai (decay_from).
-- Warna qarz ko ghari khud khatam kar deti.
create or replace function fn_score_decay(p_from timestamptz, p_never boolean)
returns numeric language plpgsql stable as $$
declare m numeric;
begin
  if p_never then return 1.0; end if;
  if p_from is null then return 0.0; end if;
  m := extract(epoch from (now() - p_from)) / (30.44 * 86400);
  if m < 3  then return 1.0; end if;
  if m < 6  then return 0.7; end if;
  if m < 9  then return 0.4; end if;
  if m < 12 then return 0.2; end if;
  return 0.0;
end;
$$;

-- ---------------------------------------------------------------
-- 3) Bande ka pehla din
-- ---------------------------------------------------------------
create or replace function fn_subject_since(p_subject_type text, p_subject_id uuid)
returns timestamptz language plpgsql stable security definer set search_path to 'public' as $$
declare t timestamptz;
begin
  if    p_subject_type = 'farmer'   then select created_at into t from farmers where id = p_subject_id;
  elsif p_subject_type = 'staff'    then select created_at into t from profiles where id = p_subject_id;
  elsif p_subject_type = 'vendor'   then select created_at into t from machinery_vendors where id = p_subject_id;
  elsif p_subject_type = 'customer' then select created_at into t from customers where id = p_subject_id;
  end if;
  return t;
end;
$$;

-- ---------------------------------------------------------------
-- 4) ENGINE
-- ---------------------------------------------------------------
-- Har factor ka nateeja us ke apne waqiat se banta hai:
--
--     s = achhe / (achhe + bure)     -- dono waqt ke hisaab se halke
--
-- Aur yahin se "N/A" khud ba khud nikalta hai: jis factor par koi
-- waqia hi nahi, us ka (achhe + bure) sifar hai -- to wo lagta hi
-- nahi. Us ke liye alag qaida likhne ki zaroorat nahi pari.
--
-- SIRF TASDEEQ SHUDA WAQIA GINTA HAI. Jo khud likha gaya
-- (self_reported) wo kabhi nahi -- warna banda apna darja khud barha
-- leta.
--
-- HALATON KI TARTEEB TAY HAI aur wo ahem hai:
--   pehle    -- kya itna waqt aur itna kaam guzra ke hisaab shuru ho?
--   us ke baad -- kya tasweer itni poori hai ke darja diya ja sake?
-- Ulta karte to teen din purane kisan ko "tasweer adhoori hai" kaha
-- jata -- jo jhoot hai, kyunke us ke bare mein dekhna shuru hi nahi
-- hua tha.
create or replace function fn_recalc_score(p_subject_type text, p_subject_id uuid)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare
  v_version   int := fn_score_engine_version();
  v_since     timestamptz := fn_subject_since(p_subject_type, p_subject_id);
  v_days      int := case when v_since is null then 0
                          else floor(extract(epoch from (now() - v_since)) / 86400)::int end;
  v_verified  int;
  w           record;
  v_pos       numeric;
  v_neg       numeric;
  v_s         numeric;
  v_w_all     numeric := 0;
  v_w_app     numeric := 0;
  v_weighted  numeric := 0;
  v_factors   jsonb := '[]'::jsonb;
  v_coverage  numeric;
  v_state     text;
  v_score     int;
  v_credit    text;
  v_flags     text[] := '{}';
  v_reason    text;
  v_id        uuid;
  v_repay_app boolean := false;
  v_obl_any   boolean;
begin
  select count(*) into v_verified
    from score_events
   where subject_type = p_subject_type and subject_id = p_subject_id
     and evidence_state = 'verified';

  for w in
    select * from score_factor_weights
     where subject_type = p_subject_type
       and engine_version = v_version
       and is_enabled
     order by weight desc, factor_key
  loop
    select
      coalesce(sum(case when direction =  1 then magnitude * fn_score_decay(coalesce(decay_from, occurred_at), never_decays) end), 0),
      coalesce(sum(case when direction = -1 and w.is_punitive
                        then magnitude * fn_score_decay(coalesce(decay_from, occurred_at), never_decays) end), 0)
      into v_pos, v_neg
      from score_events e
     where e.subject_type = p_subject_type
       and e.subject_id = p_subject_id
       and e.factor_key = w.factor_key
       and e.evidence_state = 'verified';

    v_w_all := v_w_all + w.weight;

    if (v_pos + v_neg) > 0 then
      v_s := v_pos / (v_pos + v_neg);
      v_w_app := v_w_app + w.weight;
      v_weighted := v_weighted + (w.weight * v_s);
      if w.factor_key = 'credit_repayment' then v_repay_app := true; end if;
      v_factors := v_factors || jsonb_build_object(
        'factor', w.factor_key, 'label', w.label, 'weight', w.weight,
        'applicable', true, 'sub_score', round(v_s, 3),
        'points', round(w.weight * v_s, 2), 'punitive', w.is_punitive);
    else
      -- N/A: upar se bhi bahar, neeche se bhi. Na tareef, na saza.
      v_factors := v_factors || jsonb_build_object(
        'factor', w.factor_key, 'label', w.label, 'weight', w.weight,
        'applicable', false, 'sub_score', null, 'points', null,
        'punitive', w.is_punitive,
        'reason', case
          when w.factor_key = 'credit_repayment'    then 'Udhaar kabhi diya hi nahi gaya'
          when w.factor_key = 'payment_punctuality' then 'Koi tay shuda tareekh maujood nahi'
          else 'Is ka koi tasdeeq shuda record nahi' end);
    end if;
  end loop;

  v_coverage := case when v_w_all > 0 then v_w_app / v_w_all else 0 end;

  -- Udhaar ka apna record -- alag se, kyunke baqi sab acha ho to yehi
  -- kami nazar se chhup jati hai.
  select exists (select 1 from score_obligations
                  where subject_type = p_subject_type and subject_id = p_subject_id
                    and kind in ('credit','installment'))
    into v_obl_any;
  v_credit := case when v_repay_app then 'established'
                   when v_obl_any   then 'insufficient'
                   else 'none' end;

  if exists (select 1 from score_obligations
              where subject_type = p_subject_type and subject_id = p_subject_id
                and state = 'written_off') then
    v_flags := array_append(v_flags, 'unresolved_write_off');
  end if;
  if exists (select 1 from score_obligations
              where subject_type = p_subject_type and subject_id = p_subject_id
                and state = 'open' and due_date is not null and due_date < current_date) then
    v_flags := array_append(v_flags, 'overdue');
  end if;

  -- TARTEEB. Pehla sawal pehle.
  if v_days < 30 or v_verified < 3 then
    v_state := 'score_building';
    v_score := null;
    v_reason := format('%s din, %s tasdeeq shuda waqiat -- abhi hisaab shuru hua hai', v_days, v_verified);
  elsif v_coverage < 0.50 then
    v_state := 'insufficient_data';
    v_score := null;
    v_reason := format('Tasweer adhoori -- %s%% saboot', round(v_coverage * 100));
  else
    v_state := 'active';
    v_score := round(100 * v_weighted / v_w_app)::int;
    v_reason := format('%s%% saboot par bana', round(v_coverage * 100));
  end if;

  insert into score_snapshots (
    subject_type, subject_id, snapshot_date, score, band, state,
    evidence_coverage, credit_history_state, relationship_days,
    verified_event_count, factors, risk_flags, engine_version, reason_summary)
  values (
    p_subject_type, p_subject_id, current_date, v_score, fn_score_band(v_score), v_state,
    round(v_coverage, 3), v_credit, v_days, v_verified, v_factors, v_flags, v_version, v_reason)
  on conflict (subject_type, subject_id, snapshot_date) do update set
    score = excluded.score, band = excluded.band, state = excluded.state,
    evidence_coverage = excluded.evidence_coverage,
    credit_history_state = excluded.credit_history_state,
    relationship_days = excluded.relationship_days,
    verified_event_count = excluded.verified_event_count,
    factors = excluded.factors, risk_flags = excluded.risk_flags,
    engine_version = excluded.engine_version, reason_summary = excluded.reason_summary,
    computed_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------
-- 5) Udhaar ki ijazat -- SCORE SE ALAG
-- ---------------------------------------------------------------
-- Ye function darje ka doosra naam NAHI hai. 86 Platinum ke sath aadha
-- saboot aur koi credit record na ho -- to us ka matlab "Platinum
-- udhaar" nahi, us ka matlab hai "abhi parkha hi nahi gaya".
--
-- Aur ye kabhi manzoori nahi deta. requires_human_approval hamesha true
-- lautta hai: score kisi insaan ke saamne rakha jane wala adad hai, us
-- ki jagah lene wala nahi.
create or replace function fn_credit_eligibility(p_subject_type text, p_subject_id uuid)
returns table (level text, blocked text[], requires_human_approval boolean, reasons jsonb)
language plpgsql stable security definer set search_path to 'public' as $$
declare s record;
begin
  select * into s from score_snapshots
   where subject_type = p_subject_type and subject_id = p_subject_id
   order by snapshot_date desc limit 1;

  if not found or s.state <> 'active' then
    return query select 'not_assessed'::text, array['new_credit']::text[], true,
      jsonb_build_array(jsonb_build_object('reason',
        coalesce(s.reason_summary, 'Koi hisaab abhi bana hi nahi')));
    return;
  end if;

  if 'unresolved_write_off' = any (s.risk_flags) then
    return query select 'high_risk'::text, array['gold_credit','platinum_credit','new_credit']::text[], true,
      jsonb_build_array(jsonb_build_object('reason', 'Write-off abhi hal nahi hua', 'flag', 'unresolved_write_off'));
    return;
  end if;

  if 'overdue' = any (s.risk_flags) then
    return query select 'restricted'::text, array['new_credit']::text[], true,
      jsonb_build_array(jsonb_build_object('reason', 'Tay shuda tareekh guzar chuki aur raqam baqi hai', 'flag', 'overdue'));
    return;
  end if;

  if s.credit_history_state <> 'established' or s.evidence_coverage < 0.70 then
    return query select 'unproven'::text, array[]::text[], true,
      jsonb_build_array(jsonb_build_object(
        'reason', 'Darja bana hai magar udhaar ka apna record poora nahi',
        'credit_history', s.credit_history_state,
        'evidence_coverage', s.evidence_coverage));
    return;
  end if;

  return query select 'standard'::text, array[]::text[], true,
    jsonb_build_array(jsonb_build_object(
      'reason', 'Record poora hai', 'band', s.band, 'evidence_coverage', s.evidence_coverage));
end;
$$;

-- ---------------------------------------------------------------
-- 6) Kaun kis ka score dekhe
-- ---------------------------------------------------------------
create or replace function fn_score_visible(p_subject_type text, p_subject_id uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select
    -- Master Admin
    public.fn_has_dept(array['owner','super_admin','admin']::public.user_role[])
    -- Apna apna
    or (p_subject_type = 'farmer' and exists (
          select 1 from farmers f where f.id = p_subject_id and f.user_id = auth.uid()))
    or (p_subject_type = 'staff' and p_subject_id = auth.uid())
    or (p_subject_type = 'vendor' and exists (
          select 1 from machinery_vendors v where v.id = p_subject_id and v.user_id = auth.uid()))
    or (p_subject_type = 'customer' and exists (
          select 1 from customers c where c.id = p_subject_id and c.user_id = auth.uid()))
    -- Department ka sarbarah -- apni team ke log
    or (p_subject_type = 'staff' and exists (
          select 1
            from department_head_grants g
            join departments d on d.key = g.department_key
            join profiles p on p.id = p_subject_id
           where g.profile_id = auth.uid()
             and (g.starts_at is null or g.starts_at <= now())
             and (g.expires_at is null or g.expires_at > now())
             and p.role::text = d.role))
    -- Finance/credit -- karobari bandon ka daaira
    or (p_subject_type in ('farmer','customer','vendor')
        and public.fn_has_dept(array['finance','manager']::public.user_role[]));
$$;

-- Parhne ka waahid darwaza.
--
-- "Ijazat nahi" ka jawab KHALI hai, sifar nahi. Ye is project mein teen
-- dafa ghalat adad de chuka hai: rok ke peeche khali jawab ko asal adad
-- samajh liya gaya. Yahan wo farq mehfooz hai -- jise ijazat nahi, usay
-- ek bhi qatar nahi milti.
create or replace function fn_score_for(p_subject_type text, p_subject_id uuid)
returns table (
  score int, band text, state text, evidence_coverage numeric,
  credit_history_state text, factors jsonb, risk_flags text[],
  reason_summary text, engine_version int, snapshot_date date)
language sql stable security definer set search_path to 'public' as $$
  select s.score, s.band, s.state, s.evidence_coverage, s.credit_history_state,
         s.factors, s.risk_flags, s.reason_summary, s.engine_version, s.snapshot_date
    from score_snapshots s
   where s.subject_type = p_subject_type
     and s.subject_id = p_subject_id
     and public.fn_score_visible(p_subject_type, p_subject_id)
   order by s.snapshot_date desc
   limit 1;
$$;

-- ---------------------------------------------------------------
-- 7) Pehra -- database par, safhe par nahi
-- ---------------------------------------------------------------
alter table score_snapshots   enable row level security;
alter table score_events      enable row level security;
alter table score_obligations enable row level security;
alter table score_factor_weights enable row level security;

drop policy if exists p_score_snap_read on score_snapshots;
create policy p_score_snap_read on score_snapshots for select
  using (fn_score_visible(subject_type, subject_id));

drop policy if exists p_score_events_read on score_events;
create policy p_score_events_read on score_events for select
  using (fn_score_visible(subject_type, subject_id));

drop policy if exists p_score_obl_read on score_obligations;
create policy p_score_obl_read on score_obligations for select
  using (fn_score_visible(subject_type, subject_id));

-- Wazan sab staff dekh sakte hain -- us mein kisi ka zaati hisaab nahi.
drop policy if exists p_score_weights_read on score_factor_weights;
create policy p_score_weights_read on score_factor_weights for select
  using (fn_is_any_staff());

-- LIKHNE KI KOI POLICY NAHI. Jaan boojh kar.
--
-- Score mein kuch bhi haath se nahi likha ja sakta -- na barhane ke
-- liye, na ghatane ke liye. Sirf engine likhta hai, aur wo service ki
-- haisiyat se chalta hai. Agar yahan "apna score theek karo" ka koi
-- darwaza hota to poora nizam usi din bekar ho jata.
