-- 570: Sehat -- vaccine, keeRay-maar (deworm), ilaaj/dawai, vet visit. Additive. Delete nahi -- void.
-- Dawai ki "doodh rokne ki muddat": us dauran doodh record khud "roka hua" (withheld) -- kisan hata nahi sakta.
-- Kharcha 569 wale fn_dairy_event_cost se (ek hi dafa, source 'health').

create table if not exists public.dairy_vaccine_schedule (
  code text primary key check (code ~ '^[A-Z_]{2,12}$'),
  name_en text not null, name_rm text not null, name_ur text not null,
  interval_months int check (interval_months is null or interval_months between 1 and 60),
  min_age_months int not null default 0,
  species text[] not null default array['cow','buffalo','goat'],
  season_hint text
);
insert into public.dairy_vaccine_schedule (code, name_en, name_rm, name_ur, interval_months, min_age_months, species, season_hint) values
  ('FMD', 'Foot & mouth (FMD)', 'Mooh-khur', 'منہ کھر', 6, 4, array['cow','buffalo','goat'], 'Har 6 maheene'),
  ('HS', 'Haemorrhagic septicaemia (HS)', 'Gal-ghotu', 'گل گھوٹو', 12, 6, array['cow','buffalo'], 'Barsaat se pehle'),
  ('LSD', 'Lumpy skin (LSD)', 'Lumpy skin', 'لمپی سکن', 12, 4, array['cow','buffalo'], 'Saal mein 1'),
  ('BQ', 'Black quarter (BQ)', 'Chhar / Pheel', 'چھڑ', 12, 6, array['cow','buffalo'], 'Vachhi/bachhre 6 maah+'),
  ('ANTHRAX', 'Anthrax', 'Anthrax (Saat)', 'اینتھریکس', 12, 6, array['cow','buffalo','goat'], null),
  ('BRUCELLA', 'Brucellosis', 'Brucella', 'بروسیلا', null, 4, array['cow','buffalo'], 'Vachhi 4-8 maah, ek dafa'),
  ('PPR', 'PPR (goats)', 'PPR (bakri)', 'پی پی آر', 36, 4, array['goat'], null)
on conflict (code) do nothing;
alter table public.dairy_vaccine_schedule enable row level security;
revoke all on public.dairy_vaccine_schedule from anon;
grant select on public.dairy_vaccine_schedule to authenticated;
grant insert, update on public.dairy_vaccine_schedule to authenticated;
drop policy if exists dairy_vaccine_schedule_read on public.dairy_vaccine_schedule;
create policy dairy_vaccine_schedule_read on public.dairy_vaccine_schedule for select to authenticated using (true);
drop policy if exists dairy_vaccine_schedule_admin on public.dairy_vaccine_schedule;
create policy dairy_vaccine_schedule_admin on public.dairy_vaccine_schedule for insert to authenticated with check (public.fn_dairy_is_admin());
drop policy if exists dairy_vaccine_schedule_admin_upd on public.dairy_vaccine_schedule;
create policy dairy_vaccine_schedule_admin_upd on public.dairy_vaccine_schedule for update to authenticated using (public.fn_dairy_is_admin()) with check (public.fn_dairy_is_admin());

create table if not exists public.dairy_health_events (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.farmers(id),
  animal_id uuid references public.dairy_animals(id),           -- null = poora rewar
  kind text not null check (kind in ('vaccine','deworm','treatment','vet_visit')),
  vaccine_code text references public.dairy_vaccine_schedule(code),
  diagnosis text check (diagnosis is null or length(diagnosis) <= 120),
  medicine text check (medicine is null or length(medicine) <= 120),
  dose text check (dose is null or length(dose) <= 60),
  event_date date not null default current_date,                  -- pehli khuraak
  last_dose_date date,
  withdrawal_days int not null default 0 check (withdrawal_days between 0 and 60),
  withdrawal_until date generated always as (case when withdrawal_days > 0 then coalesce(last_dose_date, event_date) + withdrawal_days end) stored,
  vet_name text check (vet_name is null or length(vet_name) <= 80),
  next_due date,
  cost numeric(12,2) check (cost is null or (cost >= 0 and cost <= 1000000)),
  payment text not null default 'cash' check (payment in ('cash','udhaar','bank')),
  expense_id uuid references public.dairy_expenses(id),
  notes text check (notes is null or length(notes) <= 300),
  voided boolean not null default false,
  void_reason text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'vaccine') = (vaccine_code is not null)),
  check (kind not in ('treatment','deworm') or length(btrim(coalesce(medicine,''))) >= 2),
  check (last_dose_date is null or last_dose_date >= event_date),
  check (next_due is null or next_due > event_date),
  check (not voided or length(coalesce(void_reason,'')) >= 3)
);
create index if not exists ix_dairy_health_farmer on public.dairy_health_events (farmer_id, kind, event_date desc);
create unique index if not exists ux_dairy_health_expense on public.dairy_health_events (expense_id) where expense_id is not null;

-- Kis waqia mein kaun se janwar (rewar wala waqia sab active janwaron mein phail jata hai) -- coverage aur doodh rokne ke liye.
create table if not exists public.dairy_health_event_animals (
  event_id uuid not null references public.dairy_health_events(id),
  animal_id uuid not null references public.dairy_animals(id),
  farmer_id uuid not null references public.farmers(id),
  primary key (event_id, animal_id)
);
create index if not exists ix_dairy_hea_animal on public.dairy_health_event_animals (animal_id);
alter table public.dairy_health_event_animals enable row level security;
revoke all on public.dairy_health_event_animals from anon, authenticated;
grant select on public.dairy_health_event_animals to authenticated;
drop policy if exists dairy_hea_own_select on public.dairy_health_event_animals;
create policy dairy_hea_own_select on public.dairy_health_event_animals for select to authenticated
  using (farmer_id = public.fn_dairy_my_farmer_id() or public.fn_is_staff(auth.uid()));

create or replace function public.fn_dairy_health_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare a record; link uuid; months int; label text;
begin
  if tg_op = 'DELETE' then raise exception 'Sehat ka record delete nahi hota -- void karein'; end if;
  if tg_op = 'UPDATE' then
    if old.voided then raise exception 'Void record badla nahi ja sakta'; end if;
    if new.farmer_id <> old.farmer_id or new.animal_id is distinct from old.animal_id or new.kind <> old.kind or new.event_date <> old.event_date then
      raise exception 'Janwar/qism/tareekh badli nahi ja sakti -- void kar ke naya likhein';
    end if;
  end if;
  if new.animal_id is not null then
    select id, farmer_id, status into a from dairy_animals where id = new.animal_id;
    if not found or a.farmer_id <> new.farmer_id then raise exception 'Janwar isi kisan ka hona chahiye'; end if;
    if tg_op = 'INSERT' and a.status in ('sold','dead') then raise exception 'Bika/mara janwar -- naya record nahi'; end if;
  end if;
  if tg_op = 'INSERT' then
    if new.event_date > current_date then raise exception 'Aage ki tareekh nahi'; end if;
    if new.last_dose_date is not null and new.last_dose_date > current_date + 30 then raise exception 'Aakhri khuraak 30 din se zyada aage nahi'; end if;
  end if;
  if new.next_due is null and tg_op = 'INSERT' then
    if new.kind = 'vaccine' then
      select interval_months into months from dairy_vaccine_schedule where code = new.vaccine_code;
      if months is not null then new.next_due := (new.event_date + make_interval(months => months))::date; end if;
    elsif new.kind = 'deworm' then
      new.next_due := (new.event_date + interval '3 months')::date;
    end if;
  end if;
  label := case new.kind when 'vaccine' then 'Vaccine ' || new.vaccine_code when 'deworm' then 'Deworm' when 'treatment' then 'Dawai' else 'Vet visit' end;
  link := case when new.expense_id is not null and not exists (select 1 from dairy_expenses e where e.id = new.expense_id and e.source_ref = new.id)
               then new.expense_id end;
  new.expense_id := public.fn_dairy_event_cost('health', new.id, new.farmer_id, new.event_date, new.cost, new.payment,
                      label || coalesce(' · ' || new.medicine, '') || coalesce(' · ' || new.vet_name, ''), link, new.voided, new.animal_id);
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists trg_dairy_health_guard on public.dairy_health_events;
create trigger trg_dairy_health_guard before insert or update or delete on public.dairy_health_events
  for each row execute function public.fn_dairy_health_guard();

create or replace function public.fn_dairy_health_fanout()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.animal_id is not null then
    insert into dairy_health_event_animals (event_id, animal_id, farmer_id) values (new.id, new.animal_id, new.farmer_id) on conflict do nothing;
  else
    insert into dairy_health_event_animals (event_id, animal_id, farmer_id)
    select new.id, a.id, a.farmer_id from dairy_animals a
     where a.farmer_id = new.farmer_id and a.status not in ('sold','dead')
       and (a.dob is null or a.dob <= new.event_date)
    on conflict do nothing;
  end if;
  return null;
end $$;
drop trigger if exists trg_dairy_health_fanout on public.dairy_health_events;
create trigger trg_dairy_health_fanout after insert on public.dairy_health_events
  for each row execute function public.fn_dairy_health_fanout();

alter table public.dairy_health_events enable row level security;
revoke all on public.dairy_health_events from anon;
grant select, insert, update on public.dairy_health_events to authenticated;
revoke delete on public.dairy_health_events from authenticated;
drop policy if exists dairy_health_own_select on public.dairy_health_events;
create policy dairy_health_own_select on public.dairy_health_events for select to authenticated
  using (farmer_id = public.fn_dairy_my_farmer_id() or public.fn_is_staff(auth.uid()));
drop policy if exists dairy_health_own_insert on public.dairy_health_events;
create policy dairy_health_own_insert on public.dairy_health_events for insert to authenticated
  with check (farmer_id = public.fn_dairy_my_farmer_id());
drop policy if exists dairy_health_own_update on public.dairy_health_events;
create policy dairy_health_own_update on public.dairy_health_events for update to authenticated
  using (farmer_id = public.fn_dairy_my_farmer_id()) with check (farmer_id = public.fn_dairy_my_farmer_id());

-- Janwar ki doodh rokne ki aakhri tareekh (jis din tak). null = koi pabandi nahi.
create or replace function public.fn_dairy_withheld_until(p_animal uuid, p_on date)
returns date language sql stable security definer set search_path = public as $$
  select max(h.withdrawal_until) from dairy_health_events h
    join dairy_health_event_animals x on x.event_id = h.id
   where x.animal_id = p_animal and not h.voided and h.withdrawal_until is not null
     and p_on between h.event_date and h.withdrawal_until;
$$;
revoke all on function public.fn_dairy_withheld_until(uuid, date) from public, anon;
grant execute on function public.fn_dairy_withheld_until(uuid, date) to authenticated;

-- Doodh likhte waqt: muddat ke andar ho to "roka hua" zabardasti (567 ke guard ke baad chalta hai: g < w).
create or replace function public.fn_dairy_yields_withdrawal()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.fn_dairy_withheld_until(new.animal_id, new.yield_date) is not null then
    new.withheld := true;
  end if;
  return new;
end $$;
drop trigger if exists trg_dairy_yields_withdrawal on public.dairy_milk_yields;
create trigger trg_dairy_yields_withdrawal before insert or update on public.dairy_milk_yields
  for each row execute function public.fn_dairy_yields_withdrawal();
-- Note: purane doodh rows dobara nahi likhe jate (jo hua wo record hai). Aaj ke baad har naya/badla row khud rukta hai.

-- Vaccine coverage: har code ke liye kitne active janwar muddat ke andar lag chuke.
create or replace function public.fn_dairy_coverage_for(p_farmer uuid, p_as_of date)
returns table (code text, covered int, eligible int, last_date date, next_due date)
language sql stable security definer set search_path = public as $$
  with act as (
    select a.id, a.species, a.dob from dairy_animals a where a.farmer_id = p_farmer and a.status not in ('sold','dead')
  )
  select s.code,
         (select count(distinct x.animal_id)::int from dairy_health_events h join dairy_health_event_animals x on x.event_id = h.id
           join act on act.id = x.animal_id
          where h.farmer_id = p_farmer and not h.voided and h.kind = 'vaccine' and h.vaccine_code = s.code
            and (s.interval_months is null or h.event_date > (p_as_of - make_interval(months => s.interval_months))::date)),
         (select count(*)::int from act where act.species = any (s.species)
            and (act.dob is null or act.dob <= (p_as_of - make_interval(months => s.min_age_months))::date)
            and (s.code <> 'BQ' or (act.dob is not null and act.dob > (p_as_of - interval '3 years')::date))),
         (select max(h.event_date) from dairy_health_events h where h.farmer_id = p_farmer and not h.voided and h.kind = 'vaccine' and h.vaccine_code = s.code),
         (select max(h.next_due) from dairy_health_events h where h.farmer_id = p_farmer and not h.voided and h.kind = 'vaccine' and h.vaccine_code = s.code)
    from dairy_vaccine_schedule s
   where s.code in ('FMD','HS','LSD','BQ');
$$;
revoke all on function public.fn_dairy_coverage_for(uuid, date) from public, anon, authenticated;

create or replace function public.fn_my_vaccine_coverage()
returns table (code text, covered int, eligible int, last_date date, next_due date)
language plpgsql stable security definer set search_path = public as $$
declare me uuid := public.fn_dairy_my_farmer_id();
begin
  if me is null then raise exception 'Sirf kisan'; end if;
  return query select * from public.fn_dairy_coverage_for(me, current_date);
end $$;
revoke all on function public.fn_my_vaccine_coverage() from public, anon;
grant execute on function public.fn_my_vaccine_coverage() to authenticated;
