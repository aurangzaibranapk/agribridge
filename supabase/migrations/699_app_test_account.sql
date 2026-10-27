-- 699: Mobile test account. FILE ONLY — Live par mat chalana.
-- Pehle backup, phir owner ki manzoori. Auth user ye file nahi banati.
-- Sab izafa hai. Purani qatarein nahi badalti (is_test default false).

alter table public.profiles
  add column if not exists is_test_account boolean not null default false;

comment on column public.profiles.is_test_account is
  'Sirf app ka Role badlo. Asal staff/admin par false rehta hai.';

alter table public.farmers add column if not exists is_test boolean not null default false;
alter table public.customers add column if not exists is_test boolean not null default false;
alter table public.staff_details add column if not exists is_test boolean not null default false;
alter table public.milk_entries add column if not exists is_test boolean not null default false;
alter table public.milk_route_collections add column if not exists is_test boolean not null default false;
alter table public.attendance_records add column if not exists is_test boolean not null default false;
alter table public.agri_orders add column if not exists is_test boolean not null default false;

comment on column public.farmers.is_test is
  'TEST prefix wali qatarein. Business reports inhen jodna nahi chahiye.';
comment on column public.milk_entries.is_test is
  'TEST doodh. Portal ke kul litre mein tab tak aa sakta hai jab tak report is_test = false na lagaye. Mobile admin pehle se chhupata hai.';

create index if not exists farmers_is_test_idx on public.farmers (id) where is_test;
create index if not exists milk_entries_is_test_idx on public.milk_entries (entry_date) where is_test;
create index if not exists attendance_records_is_test_idx on public.attendance_records (attendance_date) where is_test;

create table if not exists public.app_test_accounts (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.app_test_links (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.app_test_accounts(profile_id) on delete cascade,
  role text not null check (role in ('admin', 'farmer', 'customer', 'mca', 'mco', 'vet', 'staff')),
  record_table text not null,
  record_id uuid,
  label text not null,
  unique (account_id, role)
);

alter table public.app_test_accounts enable row level security;
alter table public.app_test_links enable row level security;
revoke all on public.app_test_accounts from public, anon, authenticated;
revoke all on public.app_test_links from public, anon, authenticated;
grant select on public.app_test_accounts to authenticated;
grant select on public.app_test_links to authenticated;

create or replace function public.fn_is_app_test_account()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select p.is_test_account
      from public.profiles p
     where p.id = auth.uid()
       and p.is_active
  ), false);
$$;

revoke all on function public.fn_is_app_test_account() from public, anon;
grant execute on function public.fn_is_app_test_account() to authenticated, service_role;

comment on function public.fn_is_app_test_account() is
  'App test login. Select policies isi se TEST qatarein kholti hain. Likhai nahi.';

drop policy if exists app_test_accounts_read_own on public.app_test_accounts;
create policy app_test_accounts_read_own on public.app_test_accounts
  for select to authenticated
  using (profile_id = (select auth.uid()) and (select public.fn_is_app_test_account()));

drop policy if exists app_test_links_read_own on public.app_test_links;
create policy app_test_links_read_own on public.app_test_links
  for select to authenticated
  using (account_id = (select auth.uid()) and (select public.fn_is_app_test_account()));

drop policy if exists farmers_test_read on public.farmers;
create policy farmers_test_read on public.farmers
  for select to authenticated
  using (is_test and (select public.fn_is_app_test_account()));

drop policy if exists customers_test_read on public.customers;
create policy customers_test_read on public.customers
  for select to authenticated
  using (is_test and (select public.fn_is_app_test_account()));

drop policy if exists milk_entries_test_read on public.milk_entries;
create policy milk_entries_test_read on public.milk_entries
  for select to authenticated
  using (is_test and (select public.fn_is_app_test_account()));

drop policy if exists milk_route_test_read on public.milk_route_collections;
create policy milk_route_test_read on public.milk_route_collections
  for select to authenticated
  using (is_test and (select public.fn_is_app_test_account()));

drop policy if exists attendance_test_read on public.attendance_records;
create policy attendance_test_read on public.attendance_records
  for select to authenticated
  using (
    is_test
    and profile_id = (select auth.uid())
    and (select public.fn_is_app_test_account())
  );

drop policy if exists agri_orders_test_read on public.agri_orders;
create policy agri_orders_test_read on public.agri_orders
  for select to authenticated
  using (is_test and (select public.fn_is_app_test_account()));

drop policy if exists staff_details_test_read on public.staff_details;
create policy staff_details_test_read on public.staff_details
  for select to authenticated
  using (
    is_test
    and profile_id = (select auth.uid())
    and (select public.fn_is_app_test_account())
  );
