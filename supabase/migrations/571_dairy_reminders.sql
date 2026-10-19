-- 571: Yaad-dihaniyan (sirf app ke andar -- WhatsApp/SMS BILKUL nahi) + Admin ka nasal/sehat jaiza.
-- Tasks har dafa taaza hisaab se bante hain (v_dairy_repro_status + sehat). Kisan "ho gaya / kal / laagu nahi" daba sakta hai.

create table if not exists public.dairy_task_state (
  farmer_id uuid not null references public.farmers(id),
  task_key text not null check (task_key ~ '^[a-z_]+:[A-Za-z0-9_:-]{1,120}$'),
  state text not null check (state in ('done','snoozed','not_applicable','muted','active')),
  snooze_until date,
  reason text check (reason is null or length(reason) <= 200),
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  primary key (farmer_id, task_key)
);
alter table public.dairy_task_state enable row level security;
revoke all on public.dairy_task_state from anon, authenticated;
grant select on public.dairy_task_state to authenticated;
drop policy if exists dairy_task_state_own on public.dairy_task_state;
create policy dairy_task_state_own on public.dairy_task_state for select to authenticated
  using (farmer_id = public.fn_dairy_my_farmer_id() or public.fn_is_staff(auth.uid()));

-- In-app reminders (cron roz subah bharta hai). Bhejna kahin nahi.
create table if not exists public.dairy_reminders (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.farmers(id),
  task_key text not null,
  task text not null,
  animal_id uuid references public.dairy_animals(id),
  due_date date not null,
  created_on date not null default current_date,
  seen_at timestamptz,
  unique (farmer_id, task_key, created_on)
);
create index if not exists ix_dairy_reminders_farmer on public.dairy_reminders (farmer_id, created_on desc);
alter table public.dairy_reminders enable row level security;
revoke all on public.dairy_reminders from anon, authenticated;
grant select on public.dairy_reminders to authenticated;
drop policy if exists dairy_reminders_own on public.dairy_reminders;
create policy dairy_reminders_own on public.dairy_reminders for select to authenticated
  using (farmer_id = public.fn_dairy_my_farmer_id());

-- Saare kaam (andar ka function -- authenticated ko nahi diya).
create or replace function public.fn_dairy_due_tasks_for(p_farmer uuid, p_as_of date, p_days int)
returns table (task_key text, task text, animal_id uuid, tag_no text, animal_name text, due_date date, until_date date, severity text, info jsonb)
language sql stable security definer set search_path = public as $$
  with r as (select * from v_dairy_repro_status where farmer_id = p_farmer),
  raw as (
    -- garmi dekhein (21 din ka chakkar, aage khiskata hai)
    select 'heat_watch'::text t, r.animal_id, r.tag_no, r.name,
           (r.next_heat + 21 * greatest(0, ceil((p_as_of - 3 - r.next_heat) / 21.0))::int) as due, null::date as until,
           jsonb_build_object('services', r.services_lactation, 'repeat', r.repeat_breeder) as info, null::text as kref
      from r where r.next_heat is not null and r.status <> 'calf'
       and greatest(r.last_heat, r.last_service_date) >= greatest(coalesce(r.last_calving_date, date '1900-01-01'), p_as_of - 120)
    union all
    -- byaane ke 60 din baad bhi garmi nahi
    select 'no_heat', r.animal_id, r.tag_no, r.name, r.last_calving_date + 60, null, jsonb_build_object('dim', r.dim), r.last_calving_date::text
      from r where not r.pregnant and r.status not in ('dry','calf') and r.last_calving_date is not null
       and coalesce(greatest(r.last_heat, r.last_service_date), date '1900-01-01') <= r.last_calving_date
    union all
    select 'pd_due', r.animal_id, r.tag_no, r.name, r.pd_from, r.pd_to, jsonb_build_object('service_date', r.last_service_date), r.last_service_id::text
      from r where r.pd_pending
    union all
    select 'dry_off', r.animal_id, r.tag_no, r.name, r.dry_off_due, r.expected_calving, jsonb_build_object('expected', r.expected_calving), r.preg_service_id::text
      from r where r.pregnant and not r.dried and r.status <> 'dry'
    union all
    select 'calving', r.animal_id, r.tag_no, r.name, r.expected_calving, null, jsonb_build_object('days', r.gestation_days), r.preg_service_id::text
      from r where r.pregnant
    union all
    select 'vaccine', null, null, null, c.next_due, null, jsonb_build_object('code', c.code, 'count', c.eligible), c.code
      from public.fn_dairy_coverage_for(p_farmer, p_as_of) c where c.next_due is not null
    union all
    select 'vaccine_gap', null, null, null, p_as_of + 14, null, jsonb_build_object('code', c.code, 'count', c.eligible - c.covered), c.code
      from public.fn_dairy_coverage_for(p_farmer, p_as_of) c
     where c.covered < c.eligible and (c.next_due is null or c.next_due > p_as_of + p_days) and (c.last_date is not null or c.code = 'BQ')
    union all
    select 'deworm', null, null, null, d.nd, null, jsonb_build_object('last', d.ld), null
      from (select max(h.next_due) nd, max(h.event_date) ld from dairy_health_events h
             where h.farmer_id = p_farmer and not h.voided and h.kind = 'deworm') d where d.nd is not null
    union all
    select 'withheld', a.id, a.tag_no, a.name, public.fn_dairy_withheld_until(a.id, p_as_of), null,
           jsonb_build_object('medicine', (select h.medicine from dairy_health_events h join dairy_health_event_animals x on x.event_id = h.id
              where x.animal_id = a.id and not h.voided and h.withdrawal_until >= p_as_of order by h.withdrawal_until desc limit 1)), null
      from dairy_animals a where a.farmer_id = p_farmer and a.status not in ('sold','dead')
       and public.fn_dairy_withheld_until(a.id, p_as_of) is not null
  ),
  k as (
    select raw.*, raw.t || ':' || coalesce(raw.animal_id::text || ':', '') || coalesce(raw.kref || ':', '') || raw.due::text as key
      from raw where raw.due is not null and raw.due <= p_as_of + p_days
  )
  select k.key, k.t, k.animal_id, k.tag_no, k.name, k.due, k.until,
         case when k.t = 'withheld' then 'active'
              when k.t = 'pd_due' and p_as_of between k.due and coalesce(k.until, k.due) then 'today'  -- PD khirki abhi khuli
              when k.due < p_as_of then 'overdue' when k.due = p_as_of then 'today'
              when k.due <= p_as_of + 7 then 'week' else 'later' end,
         k.info
    from k
   where not exists (select 1 from dairy_task_state s where s.farmer_id = p_farmer and s.task_key = k.key
                       and (s.state in ('done','not_applicable') or (s.state = 'snoozed' and s.snooze_until > p_as_of)))
     and not exists (select 1 from dairy_task_state s where s.farmer_id = p_farmer and s.task_key = 'pref:' || k.t and s.state = 'muted')
   order by k.due, k.t, k.tag_no;
$$;
revoke all on function public.fn_dairy_due_tasks_for(uuid, date, int) from public, anon, authenticated;

create or replace function public.fn_my_due_tasks(p_days int default 30)
returns table (task_key text, task text, animal_id uuid, tag_no text, animal_name text, due_date date, until_date date, severity text, info jsonb)
language plpgsql stable security definer set search_path = public as $$
declare me uuid := public.fn_dairy_my_farmer_id();
begin
  if me is null then raise exception 'Sirf kisan'; end if;
  return query select * from public.fn_dairy_due_tasks_for(me, current_date, least(greatest(coalesce(p_days, 30), 1), 120));
end $$;
revoke all on function public.fn_my_due_tasks(int) from public, anon;
grant execute on function public.fn_my_due_tasks(int) to authenticated;

-- "Ho gaya / Kal yaad dilayein / Laagu nahi" + type band/chalu (pref:<type>).
create or replace function public.fn_dairy_task_set(p_key text, p_state text, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := public.fn_dairy_my_farmer_id();
begin
  if me is null then raise exception 'Sirf kisan'; end if;
  if p_state not in ('done','snoozed','not_applicable','muted','active') then raise exception 'Ghalat state'; end if;
  if p_key like 'pref:%' and p_state not in ('muted','active') then raise exception 'Ghalat state'; end if;
  if p_key not like 'pref:%' and p_state in ('muted') then raise exception 'Ghalat state'; end if;
  if p_state = 'not_applicable' and length(coalesce(btrim(p_reason), '')) < 3 then raise exception 'Wajah likhein'; end if;
  insert into dairy_task_state (farmer_id, task_key, state, snooze_until, reason)
  values (me, p_key, p_state, case when p_state = 'snoozed' then current_date + 1 end, left(p_reason, 200))
  on conflict (farmer_id, task_key) do update set state = excluded.state, snooze_until = excluded.snooze_until,
    reason = excluded.reason, updated_at = now(), updated_by = auth.uid();
end $$;
revoke all on function public.fn_dairy_task_set(text, text, text) from public, anon;
grant execute on function public.fn_dairy_task_set(text, text, text) to authenticated;

create or replace function public.fn_dairy_reminders_seen()
returns int language plpgsql security definer set search_path = public as $$
declare me uuid := public.fn_dairy_my_farmer_id(); n int;
begin
  if me is null then return 0; end if;
  update dairy_reminders set seen_at = now() where farmer_id = me and seen_at is null;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.fn_dairy_reminders_seen() from public, anon;
grant execute on function public.fn_dairy_reminders_seen() to authenticated;

-- Roz subah 06:00 PKT (01:00 UTC): agle 15 din ke kaam -> dairy_reminders (din mein ek dafa). Sirf app; koi message nahi jata.
create or replace function public.fn_dairy_reminder_sweep()
returns int language plpgsql security definer set search_path = public as $$
declare f uuid; n int := 0; c int;
begin
  for f in select distinct a.farmer_id from dairy_animals a where a.status not in ('sold','dead') loop
    insert into dairy_reminders (farmer_id, task_key, task, animal_id, due_date)
    select f, t.task_key, t.task, t.animal_id, t.due_date
      from public.fn_dairy_due_tasks_for(f, current_date, 15) t
     where t.severity in ('overdue','today','week','active') or t.task = 'calving'
    on conflict (farmer_id, task_key, created_on) do nothing;
    get diagnostics c = row_count; n := n + c;
  end loop;
  return n;
end $$;
revoke all on function public.fn_dairy_reminder_sweep() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('agribridge_dairy_reminders', '0 1 * * *', $job$ select public.fn_dairy_reminder_sweep(); $job$);
  end if;
end $$;

-- ===== Admin / Owner (578 ka fn_dairy_is_admin) -- read-only =====
create or replace function public.fn_admin_breeding_totals(p_as_of date)
returns table (farmer_id uuid, farmer_code text, full_name text, village text, customer_name text, animals int, pregnant int, calvings_30 int,
               conception_pct numeric, services_known int, fmd_pct numeric, hs_pct numeric, lsd_pct numeric, bq_pct numeric,
               fmd_missing int, withheld int, overdue int, vets_cost numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.fn_dairy_is_admin() then raise exception 'Sirf Admin / Owner'; end if;
  p_as_of := coalesce(p_as_of, current_date);
  return query
  with f as (select distinct a.farmer_id fid from dairy_animals a),
  svc as (
    select s.farmer_id, s.id,
      (exists (select 1 from dairy_breeding_events o where o.service_id = s.id and not o.voided
                 and ((o.event_type = 'pd' and o.pd_result = 'positive') or o.event_type = 'calving'))) pos,
      (exists (select 1 from dairy_breeding_events o where o.service_id = s.id and not o.voided and o.event_type = 'pd' and o.pd_result = 'negative')
        or exists (select 1 from dairy_breeding_events l where l.animal_id = s.animal_id and not l.voided and l.event_type in ('ai','natural')
                     and l.event_date > s.event_date)) neg
      from dairy_breeding_events s
     where not s.voided and s.event_type in ('ai','natural') and s.event_date > p_as_of - 365
  ),
  cov as (select f.fid, c.* from f cross join lateral public.fn_dairy_coverage_for(f.fid, p_as_of) c)
  select f.fid, fr.farmer_code, fr.full_name, fr.village,
         (select cu.name from customers cu where cu.farmer_id = f.fid order by cu.name limit 1),
         (select count(*)::int from dairy_animals a where a.farmer_id = f.fid and a.status not in ('sold','dead')),
         (select count(*)::int from v_dairy_repro_status r where r.farmer_id = f.fid and r.pregnant),
         (select count(*)::int from v_dairy_repro_status r where r.farmer_id = f.fid and r.pregnant and r.expected_calving <= p_as_of + 30),
         (select case when count(*) filter (where pos or neg) > 0
                 then round(100.0 * count(*) filter (where pos) / count(*) filter (where pos or neg)) end from svc where svc.farmer_id = f.fid),
         (select count(*)::int from svc where svc.farmer_id = f.fid and (pos or neg)),
         (select case when c.eligible > 0 then round(100.0 * least(c.covered, c.eligible) / c.eligible) end from cov c where c.fid = f.fid and c.code = 'FMD'),
         (select case when c.eligible > 0 then round(100.0 * least(c.covered, c.eligible) / c.eligible) end from cov c where c.fid = f.fid and c.code = 'HS'),
         (select case when c.eligible > 0 then round(100.0 * least(c.covered, c.eligible) / c.eligible) end from cov c where c.fid = f.fid and c.code = 'LSD'),
         (select case when c.eligible > 0 then round(100.0 * least(c.covered, c.eligible) / c.eligible) end from cov c where c.fid = f.fid and c.code = 'BQ'),
         (select greatest(c.eligible - c.covered, 0) from cov c where c.fid = f.fid and c.code = 'FMD'),
         (select count(*)::int from dairy_animals a where a.farmer_id = f.fid and a.status not in ('sold','dead') and public.fn_dairy_withheld_until(a.id, p_as_of) is not null),
         (select count(*)::int from public.fn_dairy_due_tasks_for(f.fid, p_as_of, 30) t where t.severity = 'overdue'),
         (select coalesce(sum(e.amount), 0) from dairy_expenses e where e.farmer_id = f.fid and not e.voided and e.category = 'vets'
             and e.expense_date between date_trunc('month', p_as_of)::date and p_as_of)
    from f join farmers fr on fr.id = f.fid
   order by fr.farmer_code;
end $$;
revoke all on function public.fn_admin_breeding_totals(date) from public, anon;
grant execute on function public.fn_admin_breeding_totals(date) to authenticated;

create or replace function public.fn_admin_breeding_upcoming(p_as_of date, p_days int)
returns table (farmer_id uuid, farmer_code text, full_name text, tag_no text, animal_name text, expected_calving date)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.fn_dairy_is_admin() then raise exception 'Sirf Admin / Owner'; end if;
  return query
  select r.farmer_id, fr.farmer_code, fr.full_name, r.tag_no, r.name, r.expected_calving
    from v_dairy_repro_status r join farmers fr on fr.id = r.farmer_id
   where r.pregnant and r.expected_calving <= coalesce(p_as_of, current_date) + least(greatest(coalesce(p_days, 30), 1), 330)
   order by r.expected_calving limit 50;
end $$;
revoke all on function public.fn_admin_breeding_upcoming(date, int) from public, anon;
grant execute on function public.fn_admin_breeding_upcoming(date, int) to authenticated;
