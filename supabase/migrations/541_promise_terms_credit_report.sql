-- 541: Waada (verbal) + sharaait + andaroni credit report (tasdeeq) se jor.
-- Additive. Purana data nahi badalta. Live par lagane se pehle backup:
--   create table backups.payment_promises_pre541 as table public.payment_promises;
--   create table backups.score_event_severity_pre541 as table public.score_event_severity;

-- (c) Sharaait ka record: abhi sirf zubani (verbal). OTP/dastakhat future ke liye, ikhtiyari.
alter table public.payment_promises
  add column if not exists terms_version text,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_accepted_by uuid references public.profiles(id),
  add column if not exists terms_channel text not null default 'verbal',
  add column if not exists signature_ref text,
  add column if not exists otp_ref text,
  add column if not exists outcome_scored_at timestamptz;
alter table public.payment_promises drop constraint if exists payment_promises_terms_channel_check;
alter table public.payment_promises add constraint payment_promises_terms_channel_check
  check (terms_channel in ('verbal','otp','signature'));

create or replace function public.fn_guard_promise_terms()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_role text;
begin
  if new.terms_accepted_at is null or new.terms_accepted_by is null or coalesce(new.terms_version,'') = '' then
    raise exception 'Sharaait ki tasdeeq zaroori hai: customer ne zubani maan li -- checkbox lagayein.';
  end if;
  select role::text into v_role from public.profiles where id = coalesce(new.created_by, new.terms_accepted_by) and is_active;
  if coalesce(new.promised_days, 0) > 30 and coalesce(v_role,'') not in ('owner','super_admin','admin') then
    raise exception 'Staff zyada se zyada 30 din ka waada darj kar sakta hai.';
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_promise_terms on public.payment_promises;
create trigger trg_guard_promise_terms before insert on public.payment_promises
  for each row execute function public.fn_guard_promise_terms();

-- (a) Waada poora / toota -> score events (customer + farmer, punctuality factor; wazan nahi badla).
insert into public.score_event_severity (subject_type,factor_key,event_type,direction,magnitude,never_decays,label,engine_version)
select v.* from (values ('customer','payment_punctuality','promise_kept',1,8,false,'Waada waqt par poora kiya',1),
       ('customer','payment_punctuality','promise_broken',-1,20,true,'Waada toota -- Default',1),
       ('farmer','payment_punctuality','promise_kept',1,8,false,'Waada waqt par poora kiya',1),
       ('farmer','payment_punctuality','promise_broken',-1,20,true,'Waada toota -- Default',1))
  v(subject_type,factor_key,event_type,direction,magnitude,never_decays,label,engine_version)
where not exists (select 1 from public.score_event_severity x where x.subject_type = v.subject_type
                    and x.factor_key = v.factor_key and x.event_type = v.event_type and x.engine_version = v.engine_version);

-- Default nishan: kabhi mitta nahi (delete band), 12 mahine baad "halka" (softened).
create table if not exists public.credit_default_marks (
  id uuid primary key default gen_random_uuid(),
  party_type text not null check (party_type in ('customer','farmer','dealer','supplier')),
  party_id uuid not null,
  promise_id uuid unique references public.payment_promises(id),
  amount numeric,
  marked_at timestamptz not null default now(),
  note text
);
create index if not exists idx_credit_default_marks_party on public.credit_default_marks(party_type, party_id, marked_at desc);
alter table public.credit_default_marks enable row level security;
drop policy if exists credit_default_marks_staff_read on public.credit_default_marks;
create policy credit_default_marks_staff_read on public.credit_default_marks for select to authenticated using (public.fn_is_any_staff());

create or replace function public.fn_block_default_delete()
returns trigger language plpgsql as $$
begin raise exception 'Default ka record mitaya nahi ja sakta (12 mahine baad khud halka hota hai).'; end $$;
drop trigger if exists trg_block_default_delete on public.credit_default_marks;
create trigger trg_block_default_delete before delete or update on public.credit_default_marks
  for each row execute function public.fn_block_default_delete();

create or replace function public.fn_default_active(p_type text, p_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.credit_default_marks
                  where party_type = p_type and party_id = p_id and marked_at > now() - interval '12 months');
$$;

-- Score likhna (customer/farmer par hi).
create or replace function private.score_promise(p public.payment_promises, p_event text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p.party_type not in ('customer','farmer') then return; end if;
  perform public.fn_score_put_event(p.party_type, p.party_id, 'payment_punctuality', p_event,
    coalesce(p.broken_at, now()), 'payment_promises', p.id);
  perform public.fn_recalc_score(p.party_type, p.party_id);
end $$;

-- Poora hua -> promise_kept.
create or replace function public.fn_promise_outcome()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'fulfilled' and old.status is distinct from 'fulfilled' and new.outcome_scored_at is null then
    perform private.score_promise(new, 'promise_kept');
    update public.payment_promises set outcome_scored_at = now() where id = new.id;
  end if;
  return null;
end $$;
drop trigger if exists trg_promise_outcome on public.payment_promises;
create trigger trg_promise_outcome after update of status on public.payment_promises
  for each row execute function public.fn_promise_outcome();

-- (b) Rozana: tareekh guzar gayi aur raqam poori nahi -> toota + Default + score.
create or replace function public.fn_promise_sweep(p_today date default (now() at time zone 'Asia/Karachi')::date)
returns integer language plpgsql security definer set search_path = '' as $$
declare r public.payment_promises; n int := 0;
begin
  for r in
    select * from public.payment_promises
     where status = 'open' and promise_date < p_today
       and not (promised_amount is not null and coalesce(fulfilled_amount,0) >= promised_amount)
     for update skip locked
  loop
    update public.payment_promises set status = 'broken', broken_at = now(), outcome_scored_at = now(), updated_at = now()
     where id = r.id returning * into r;
    insert into public.credit_default_marks (party_type, party_id, promise_id, amount, note)
    values (r.party_type, r.party_id, r.id, coalesce(r.promised_amount,0) - coalesce(r.fulfilled_amount,0), 'Waada toota')
    on conflict (promise_id) do nothing;
    perform private.score_promise(r, 'promise_broken');
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.fn_promise_sweep(date) from public, anon, authenticated;

do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('agribridge_promise_sweep') where exists (select 1 from cron.job where jobname = 'agribridge_promise_sweep');
    perform cron.schedule('agribridge_promise_sweep', '30 19 * * *', 'select public.fn_promise_sweep();'); -- 00:30 PKT
  end if;
end $$;

-- (e) POS: active Default ho to naya udhaar sirf Admin override se (538 ka function + ek shart).
create or replace function private.enforce_pos_recovery_credit()
returns trigger language plpgsql security definer set search_path = '' as $function$
declare
  s public.receivable_recovery_settings%rowtype;
  p record; reason text; actor_role text; v_default boolean; v_found boolean;
begin
  if coalesce(new.khata_amount,0) <= 0 then return new; end if;
  if tg_op = 'UPDATE' then
    if new.crm_customer_id is not distinct from old.crm_customer_id
       and new.customer_id is not distinct from old.customer_id
       and new.khata_amount <= old.khata_amount then return new; end if;
  end if;
  select * into s from public.receivable_recovery_settings where id;
  if not found then raise exception 'Udhaar policy verify nahi ho saki.'; end if;
  if (now() at time zone 'Asia/Karachi')::date < s.effective_from or not s.block_overdue_credit then return new; end if;
  if auth.uid() is null then raise exception 'Udhaar ke liye login zaroori hai.'; end if;
  if new.crm_customer_id is null then return new; end if;
  perform 1 from public.customers where id = new.crm_customer_id for update;
  if not found then raise exception 'Gahak ka khata verify nahi ho saka.'; end if;
  select * into p from public.fn_customer_credit_position(new.crm_customer_id);
  v_found := found;
  v_default := public.fn_default_active('customer', new.crm_customer_id);
  if (not v_found or not p.blocked) and not v_default then return new; end if;
  reason := trim(coalesce(current_setting('agribridge.credit_override_reason',true),''));
  select role::text into actor_role from public.profiles where id = auth.uid() and is_active;
  if actor_role is null or actor_role not in ('owner','super_admin','admin') or length(reason) < 3 then
    if v_default and not coalesce(p.blocked,false) then
      raise exception 'Credit report mein Default darj hai (toota waada); naya udhaar band hai. Sirf Admin/Owner wajah likh kar ijazat de sakta hai.';
    end if;
    raise exception 'Rs % udhaar % din se purana hai (% din ki hadd); naya udhaar band hai. Sirf Admin/Owner wajah likh kar ijazat de sakta hai.',
      round(p.late_amount), coalesce(p.oldest_days,0), p.limit_days;
  end if;
  insert into public.credit_block_overrides
    (customer_id,context,amount,overdue_amount,oldest_days,reason,overridden_by,overridden_role)
  values (new.crm_customer_id,'pos',new.khata_amount,coalesce(p.late_amount,0),coalesce(p.oldest_days,0),reason,auth.uid(),actor_role);
  return new;
end $function$;

-- (f) Party 360 credit report.
create or replace function public.fn_party_credit_report(p_type text, p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare s record; v jsonb; e record;
begin
  if not public.fn_is_any_staff() then raise exception 'Staff permission required.'; end if;
  select * into s from public.score_snapshots where subject_type = p_type and subject_id = p_id
   order by snapshot_date desc limit 1;
  select * into e from public.fn_credit_eligibility(p_type, p_id);
  select jsonb_build_object(
    'score', s.score, 'band', s.band, 'state', coalesce(s.state, 'insufficient_data'),
    'risk_flags', coalesce(to_jsonb(s.risk_flags), '[]'::jsonb), 'factors', s.factors,
    'snapshot_date', s.snapshot_date, 'reason', s.reason_summary,
    'eligibility', e.level,
    'default_active', public.fn_default_active(p_type, p_id),
    'defaults', coalesce((select jsonb_agg(jsonb_build_object('marked_at', d.marked_at, 'amount', d.amount,
        'softened', d.marked_at <= now() - interval '12 months') order by d.marked_at desc)
        from public.credit_default_marks d where d.party_type = p_type and d.party_id = p_id), '[]'::jsonb),
    'promises', coalesce((select jsonb_agg(jsonb_build_object('date', pp.promise_date, 'amount', pp.promised_amount,
        'fulfilled', pp.fulfilled_amount, 'status', pp.status, 'created_at', pp.created_at) order by pp.created_at desc)
        from (select * from public.payment_promises where party_type = p_type and party_id = p_id
              order by created_at desc limit 12) pp), '[]'::jsonb),
    'kept', (select count(*) from public.payment_promises where party_type = p_type and party_id = p_id and status = 'fulfilled'),
    'broken', (select count(*) from public.payment_promises where party_type = p_type and party_id = p_id and status = 'broken')
  ) into v;
  return v;
end $$;
revoke all on function public.fn_party_credit_report(text, uuid) from public, anon;
grant execute on function public.fn_party_credit_report(text, uuid) to authenticated;

-- Admin list: members by category (security_invoker -> RLS lagti hai).
create or replace view public.v_member_credit_categories with (security_invoker = true) as
select distinct on (s.subject_type, s.subject_id)
  s.subject_type, s.subject_id, s.score, s.band, s.state, s.snapshot_date,
  public.fn_default_active(s.subject_type, s.subject_id) as default_active,
  coalesce(c.name, f.name) as name
from public.score_snapshots s
left join public.customers c on s.subject_type = 'customer' and c.id = s.subject_id
left join public.farmers f on s.subject_type = 'farmer' and f.id = s.subject_id
where s.subject_type in ('customer','farmer','vendor')
order by s.subject_type, s.subject_id, s.snapshot_date desc;
grant select on public.v_member_credit_categories to authenticated;
