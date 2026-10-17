-- 551: Tankhwah ka dhancha (salary structure) -- components + har staff ka
-- structure, laagu tareekh aur history ke saath. Additive: koi purana table
-- nahi badla, purana data nahi mitaya.
-- Live se pehle backup:
--   create table backups.staff_details_pre551 as table public.staff_details;

-- Kaun kya kar sakta hai (ek jagah)
create or replace function public.fn_payroll_my_role()
returns text language sql stable security definer set search_path = '' as $$
  select role::text from public.profiles where id = auth.uid() and is_active
$$;
create or replace function public.fn_payroll_is_writer()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.fn_payroll_my_role() in ('hr','finance','admin','owner','super_admin'), false)
$$;
create or replace function public.fn_payroll_is_approver()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.fn_payroll_my_role() in ('admin','owner','super_admin'), false)
$$;

create table if not exists public.salary_components (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  kind text not null check (kind in ('earning','deduction')),
  calc text not null check (calc in ('fixed','pct_basic','system')),
  default_amount numeric(12,2) not null default 0 check (default_amount >= 0),
  default_pct numeric(6,3) check (default_pct is null or (default_pct >= 0 and default_pct <= 100)),
  is_system boolean not null default false,
  is_active boolean not null default false,
  sort_order int not null default 100,
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- System components hamesha chalu; baqi sab ikhtiyari aur shuru mein BAND.
insert into public.salary_components (code, name, kind, calc, is_system, is_active, sort_order) values
  ('BASIC',      'Basic Tankhwah',              'earning',   'system',    true,  true,  1),
  ('ABSENT',     'Ghair-hazri kattauti',         'deduction', 'system',    true,  true,  50),
  ('ADV_QIST',   'Advance / Qist kattauti',      'deduction', 'system',    true,  true,  60),
  ('HOUSE_RENT', 'Ghar ka kiraya',               'earning',   'pct_basic', false, false, 10),
  ('TRAVEL',     'Safar / Petrol',               'earning',   'fixed',     false, false, 11),
  ('MOBILE',     'Mobile allowance',             'earning',   'fixed',     false, false, 12),
  ('EOBI',       'EOBI',                         'deduction', 'fixed',     false, false, 70),
  ('INCOME_TAX', 'Income Tax',                   'deduction', 'fixed',     false, false, 71)
on conflict (code) do nothing;

create or replace function public.fn_guard_salary_component()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Component mitaya nahi ja sakta -- band (inactive) kar dein.';
  end if;
  if old.is_system and (new.is_active is distinct from true or new.code <> old.code or new.kind <> old.kind or new.calc <> old.calc) then
    raise exception 'System component (%) band ya tabdeel nahi ho sakta.', old.code;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists trg_guard_salary_component on public.salary_components;
create trigger trg_guard_salary_component before update or delete on public.salary_components
  for each row execute function public.fn_guard_salary_component();

create table if not exists public.staff_salary_structures (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete restrict,
  basic numeric(12,2) not null check (basic > 0),
  effective_from date not null,
  status text not null default 'draft' check (status in ('draft','approved','rejected')),
  notes text,
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  reject_reason text
);
create index if not exists idx_salary_structures_profile on public.staff_salary_structures(profile_id, effective_from desc);
create unique index if not exists uq_salary_structure_approved_date
  on public.staff_salary_structures(profile_id, effective_from) where status = 'approved';

create table if not exists public.staff_salary_structure_items (
  id uuid primary key default gen_random_uuid(),
  structure_id uuid not null references public.staff_salary_structures(id) on delete cascade,
  component_id uuid not null references public.salary_components(id),
  amount numeric(12,2) check (amount is null or amount >= 0),
  pct numeric(6,3) check (pct is null or (pct >= 0 and pct <= 100)),
  unique (structure_id, component_id)
);

-- Manzoor shuda structure kabhi badalta ya mitta nahi -- nayi line nayi tareekh se.
create or replace function public.fn_guard_salary_structure()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'approved' then raise exception 'Manzoor shuda structure mitaya nahi ja sakta -- nayi tareekh se naya banayein.'; end if;
    return old;
  end if;
  if tg_op = 'INSERT' then
    if new.profile_id = new.created_by then raise exception 'Apni tankhwah ka structure khud nahi banaya ja sakta.'; end if;
    new.status := 'draft'; new.approved_by := null; new.approved_at := null;
    return new;
  end if;
  if old.status <> 'draft' then raise exception 'Ye structure % hai -- ab badla nahi ja sakta.', old.status; end if;
  if new.created_by <> old.created_by or new.profile_id <> old.profile_id then raise exception 'Banane wala / staff badla nahi ja sakta.'; end if;
  if new.status <> 'draft' and current_setting('agribridge.salary_decide', true) is distinct from 'on' then
    raise exception 'Manzoori sirf fn_salary_structure_decide se.';
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_salary_structure on public.staff_salary_structures;
create trigger trg_guard_salary_structure before insert or update or delete on public.staff_salary_structures
  for each row execute function public.fn_guard_salary_structure();

create or replace function public.fn_guard_salary_structure_items()
returns trigger language plpgsql as $$
declare v_status text;
begin
  select status into v_status from public.staff_salary_structures where id = coalesce(new.structure_id, old.structure_id);
  if v_status is not null and v_status <> 'draft' then raise exception 'Manzoor shuda structure ke hissay badle nahi ja sakte.'; end if;
  return coalesce(new, old);
end $$;
drop trigger if exists trg_guard_salary_structure_items on public.staff_salary_structure_items;
create trigger trg_guard_salary_structure_items before insert or update or delete on public.staff_salary_structure_items
  for each row execute function public.fn_guard_salary_structure_items();

-- Maker-checker: Admin/Owner manzoor kare; banane wala aur khud staff nahi.
create or replace function public.fn_salary_structure_decide(p_id uuid, p_approve boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare s public.staff_salary_structures;
begin
  if not public.fn_payroll_is_approver() then raise exception 'Structure sirf Admin ya Owner manzoor kar sakta hai.'; end if;
  select * into s from public.staff_salary_structures where id = p_id for update;
  if not found then raise exception 'Structure nahi mila.'; end if;
  if s.status <> 'draft' then raise exception 'Ye structure pehle hi % hai.', s.status; end if;
  if s.created_by = auth.uid() then raise exception 'Banane wala khud manzoor nahi kar sakta.'; end if;
  if s.profile_id = auth.uid() then raise exception 'Apni tankhwah khud manzoor nahi ki ja sakti.'; end if;
  if not p_approve and coalesce(btrim(p_reason),'') = '' then raise exception 'Rad karne ki wajah likhein.'; end if;
  perform set_config('agribridge.salary_decide', 'on', true);
  update public.staff_salary_structures
     set status = case when p_approve then 'approved' else 'rejected' end,
         approved_by = auth.uid(), approved_at = now(),
         reject_reason = case when p_approve then null else btrim(p_reason) end
   where id = p_id;
  perform set_config('agribridge.salary_decide', 'off', true);
  -- Purane safhaat (staff_details.basic_salary) ke liye aaj ki basic bhi
  if p_approve and s.effective_from <= current_date then
    update public.staff_details set basic_salary = s.basic where profile_id = s.profile_id;
  end if;
end $$;

-- Kisi tareekh par laagu structure
create or replace function public.fn_salary_structure_as_of(p_profile uuid, p_date date)
returns public.staff_salary_structures language sql stable security definer set search_path = '' as $$
  select * from public.staff_salary_structures
   where profile_id = p_profile and status = 'approved' and effective_from <= p_date
   order by effective_from desc, approved_at desc limit 1
$$;

alter table public.salary_components enable row level security;
alter table public.staff_salary_structures enable row level security;
alter table public.staff_salary_structure_items enable row level security;

drop policy if exists salary_components_read on public.salary_components;
create policy salary_components_read on public.salary_components for select to authenticated using (public.fn_is_any_staff());
drop policy if exists salary_components_write on public.salary_components;
create policy salary_components_write on public.salary_components for all to authenticated
  using (public.fn_payroll_is_approver()) with check (public.fn_payroll_is_approver());

drop policy if exists salary_structures_read on public.staff_salary_structures;
create policy salary_structures_read on public.staff_salary_structures for select to authenticated
  using (public.fn_payroll_is_writer() or profile_id = auth.uid());
drop policy if exists salary_structures_insert on public.staff_salary_structures;
create policy salary_structures_insert on public.staff_salary_structures for insert to authenticated
  with check (public.fn_payroll_is_writer() and created_by = auth.uid() and profile_id <> auth.uid());
drop policy if exists salary_structures_update on public.staff_salary_structures;
create policy salary_structures_update on public.staff_salary_structures for update to authenticated
  using (public.fn_payroll_is_writer() and status = 'draft') with check (public.fn_payroll_is_writer());
drop policy if exists salary_structures_delete on public.staff_salary_structures;
create policy salary_structures_delete on public.staff_salary_structures for delete to authenticated
  using (public.fn_payroll_is_writer() and status = 'draft');

drop policy if exists salary_structure_items_read on public.staff_salary_structure_items;
create policy salary_structure_items_read on public.staff_salary_structure_items for select to authenticated
  using (exists (select 1 from public.staff_salary_structures s where s.id = structure_id and (public.fn_payroll_is_writer() or s.profile_id = auth.uid())));
drop policy if exists salary_structure_items_write on public.staff_salary_structure_items;
create policy salary_structure_items_write on public.staff_salary_structure_items for all to authenticated
  using (public.fn_payroll_is_writer()) with check (public.fn_payroll_is_writer());

revoke execute on function public.fn_salary_structure_decide(uuid, boolean, text) from public, anon;
revoke execute on function public.fn_salary_structure_as_of(uuid, date) from public, anon;
revoke execute on function public.fn_payroll_my_role() from public, anon;
revoke execute on function public.fn_payroll_is_writer() from public, anon;
revoke execute on function public.fn_payroll_is_approver() from public, anon;
grant execute on function public.fn_salary_structure_decide(uuid, boolean, text) to authenticated;
grant execute on function public.fn_salary_structure_as_of(uuid, date) to authenticated;
grant execute on function public.fn_payroll_my_role() to authenticated;
grant execute on function public.fn_payroll_is_writer() to authenticated;
grant execute on function public.fn_payroll_is_approver() to authenticated;
