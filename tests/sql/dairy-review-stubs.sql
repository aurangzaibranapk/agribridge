-- Test-only stubs for dairy review migrations 650-656 (PGlite). Live DB nahi.
create role anon;
create role authenticated;
create schema auth;
grant usage on schema auth to anon, authenticated;

create function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('test.uid', true), '')::uuid
$$;

create type public.user_role as enum (
  'owner', 'super_admin', 'admin', 'manager', 'sales_staff', 'finance', 'hr', 'milk_collection'
);

create or replace function public.fn_has_dept(p_roles public.user_role[])
returns boolean
language sql
stable
as $$
  select coalesce(nullif(current_setting('test.staff_role', true), ''), '') = any (
    select r::text from unnest(p_roles) as r
  )
$$;

create or replace function public.fn_is_any_staff()
returns boolean
language sql
stable
as $$
  select public.fn_has_dept(array[
    'owner','super_admin','admin','manager','sales_staff','finance','hr','milk_collection'
  ]::public.user_role[])
$$;

create table public.farmers (
  id uuid primary key default gen_random_uuid(),
  full_name text,
  phone_number text,
  farmer_code text,
  milk_collection_type text,
  is_deleted boolean not null default false
);

create table public.milk_entries (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.farmers(id),
  entry_date date not null default current_date,
  shift text not null default 'morning',
  quantity_liters numeric not null check (quantity_liters > 0),
  fat_percentage numeric,
  snf_percentage numeric,
  lr numeric,
  rate_per_liter numeric,
  total_amount numeric,
  ts_value numeric,
  adjusted_volume numeric,
  status text not null default 'pending_fat',
  collection_number text,
  client_uuid uuid,
  collected_at timestamptz,
  branch_id uuid,
  created_by uuid,
  fat_by_profile_id uuid,
  fat_at timestamptz,
  verified_by_profile_id uuid,
  possible_duplicate_of uuid,
  created_at timestamptz not null default now(),
  constraint chk_milk_priced_complete check (
    status in ('pending_fat', 'rejected')
    or (fat_percentage is not null and rate_per_liter is not null and total_amount is not null)
  )
);
create unique index idx_milk_entries_client_uuid on public.milk_entries (client_uuid) where client_uuid is not null;
create unique index idx_milk_entries_collection_number on public.milk_entries (collection_number) where collection_number is not null;

create table public.milk_collection_counters (
  year int primary key,
  last_number int not null default 0
);

create table public.milk_payments (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.farmers(id),
  amount numeric not null check (amount > 0),
  payment_method text,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table public.farmer_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null,
  source_type text not null,
  ledger_type text not null,
  amount numeric not null check (amount > 0),
  balance_after numeric not null,
  reference_id uuid,
  notes text,
  created_by uuid
);

create or replace function public.fn_apply_farmer_credit_entry()
returns trigger
language plpgsql
as $$
declare
  v_current numeric;
begin
  select coalesce(sum(case when ledger_type = 'debit' then amount else -amount end), 0)
    into v_current
  from public.farmer_credit_ledger
  where farmer_id = new.farmer_id;
  new.balance_after := v_current + (case when new.ledger_type = 'debit' then new.amount else -new.amount end);
  return new;
end $$;

create trigger trg_farmer_credit_entry
  before insert on public.farmer_credit_ledger
  for each row execute function public.fn_apply_farmer_credit_entry();

create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  owner_type text,
  owner_id uuid,
  balance numeric not null default 0
);

create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets(id),
  type text,
  direction text,
  amount numeric not null,
  balance_after numeric,
  reference_type text,
  reference_id uuid,
  notes text,
  created_by uuid
);

create or replace function public.fn_apply_wallet_transaction()
returns trigger
language plpgsql
as $$
declare
  bal numeric;
begin
  select balance into bal from public.wallets where id = new.wallet_id for update;
  if new.direction = 'credit' then
    bal := coalesce(bal, 0) + new.amount;
  elsif new.direction = 'debit' then
    bal := coalesce(bal, 0) - new.amount;
  else
    raise exception 'wallet direction %', new.direction;
  end if;
  new.balance_after := bal;
  update public.wallets set balance = bal where id = new.wallet_id;
  return new;
end $$;

create trigger trg_apply_wallet
  before insert on public.wallet_transactions
  for each row execute function public.fn_apply_wallet_transaction();

create table public.test_journal_mode (fail boolean not null default false);
insert into public.test_journal_mode values (false);
create table public.test_journal_calls (
  id serial primary key,
  payload jsonb not null
);

create or replace function public.post_journal_atomic(payload jsonb)
returns jsonb
language plpgsql
as $$
begin
  if coalesce((select fail from public.test_journal_mode limit 1), false) then
    raise exception 'journal down';
  end if;
  if (payload->>'entryDate')::date < (now() at time zone 'Asia/Karachi')::date
     and nullif(payload->>'backdateReason', '') is null then
    raise exception 'backdate reason missing';
  end if;
  insert into public.test_journal_calls(payload) values (payload);
  return jsonb_build_object('ok', true);
end $$;

create table public.milk_rate_settings (
  id uuid primary key default gen_random_uuid(),
  standard_rate numeric,
  self_dropoff_incentive numeric,
  snf_constant numeric,
  reference_ts numeric
);

create table public.fuel_rate_settings (
  id uuid primary key default gen_random_uuid(),
  petrol_rate numeric,
  diesel_rate numeric,
  margin numeric
);

create table public.company_billing_settings (
  id uuid primary key default gen_random_uuid(),
  company_name text,
  service_rate_per_liter numeric
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid()
);

create table public.fuel_logs (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid,
  log_date date,
  fuel_cost numeric,
  approval_status text,
  meter_photo_url text
);

create table public.generator_logs (
  id uuid primary key default gen_random_uuid(),
  log_date date,
  diesel_cost numeric,
  approval_status text,
  branch_id uuid
);

create table public.maintenance_logs (
  id uuid primary key default gen_random_uuid(),
  service_date date,
  cost numeric,
  status text,
  branch_id uuid
);

create table public.milk_dispatches (
  id uuid primary key default gen_random_uuid(),
  dispatch_date date not null default current_date,
  shift text not null default 'morning',
  branch_id uuid,
  dispatched_liters numeric not null check (dispatched_liters > 0),
  received_liters numeric,
  received_at timestamptz,
  notes text,
  created_by uuid
);

create table public.milk_route_collections (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid,
  collection_date date,
  shortage_liters numeric
);

create table public.salary_payments (
  id uuid primary key default gen_random_uuid(),
  pay_month int,
  pay_year int,
  net_salary numeric
);

create table public.monthly_expenses (
  id uuid primary key default gen_random_uuid(),
  expense_month int,
  expense_year int,
  amount numeric,
  category text,
  branch_id uuid
);

create schema if not exists storage;
create table storage.buckets (
  id text primary key,
  name text,
  public boolean
);
insert into storage.buckets (id, name, public) values ('meter-readings', 'meter-readings', true);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
