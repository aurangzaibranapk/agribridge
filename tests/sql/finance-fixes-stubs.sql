-- PGlite stubs for migrations 640-642. Not applied to any remote database.
create role anon;
create role authenticated;
create role service_role;
alter role service_role bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select nullif(current_setting('test.role', true), '')::text $$;
grant usage on schema public to authenticated, anon, service_role;
grant usage on schema auth to authenticated, anon, service_role;
grant execute on function auth.uid() to authenticated, anon, service_role;
grant execute on function auth.role() to authenticated, anon, service_role;

create table public.organizations (id uuid primary key);
create table public.profiles (
  id uuid primary key,
  role text,
  is_active boolean default true,
  branch_id uuid
);
create function public.fn_is_any_staff() returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active is true
      and p.role in ('owner','super_admin','admin','manager','sales_staff','finance')
  );
$$;
create function public.fn_current_user_organization_id() returns uuid language sql stable as $$
  select '11111111-1111-1111-1111-111111111111'::uuid;
$$;

create table public.gl_accounts (
  code text primary key,
  name text,
  account_type text,
  normal_side text,
  sort_order int
);
create table public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  name text,
  organization_id uuid,
  account_type text,
  opening_balance numeric default 0,
  is_active boolean default true
);
create table public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.finance_accounts(id),
  transaction_type text,
  category text,
  amount numeric,
  related_transfer_id uuid
);
create table public.company_expense_requests (
  id uuid primary key default gen_random_uuid(),
  status text default 'pending',
  amount numeric
);
create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  description text,
  is_reversal boolean default false,
  reversal_of uuid
);
create table public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid,
  account_code text,
  debit numeric default 0,
  credit numeric default 0,
  party_type text,
  party_id uuid
);
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text,
  current_balance numeric default 0
);
create table public.dealers (
  id uuid primary key default gen_random_uuid(),
  business_name text,
  current_payable numeric default 0
);
create table public.cash_closings (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid,
  close_date date,
  difference numeric default 0,
  journal_entry_id uuid,
  corrects_id uuid,
  counted_by uuid
);
create table public.dealer_payments (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid,
  amount numeric,
  payment_date date,
  direction text,
  created_by uuid,
  notes text
);
create table public.buyer_payments (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid,
  amount numeric,
  payment_date date,
  direction text,
  created_by uuid,
  notes text
);

alter table public.finance_accounts enable row level security;
alter table public.finance_transactions enable row level security;
alter table public.company_expense_requests enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_lines enable row level security;
alter table public.customers enable row level security;
alter table public.dealer_payments enable row level security;
alter table public.buyer_payments enable row level security;
alter table public.dealers enable row level security;

grant select, insert, update, delete on all tables in schema public to authenticated, service_role;

-- Live par staff read + update dono hain. SELECT grant ke sath bina SELECT
-- policy ke UPDATE qataar nahi dhoondta, is liye balance trigger chalta hi nahi.
create policy customer_staff_read on public.customers
  for select using (public.fn_is_any_staff());
create policy customer_staff_update on public.customers
  for update using (public.fn_is_any_staff())
  with check (public.fn_is_any_staff());
create policy dealer_staff_read on public.dealers
  for select using (public.fn_is_any_staff());
create policy dealer_staff_update on public.dealers
  for update using (public.fn_is_any_staff())
  with check (public.fn_is_any_staff());
