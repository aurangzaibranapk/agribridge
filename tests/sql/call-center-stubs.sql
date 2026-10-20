-- PGlite stubs for 624/625. Live shape ki chhoti nakal. Live DB nahi.
create role anon;
create role authenticated;
create role service_role;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('test.uid', true), '')::uuid
$$;
grant usage on schema public to authenticated, anon;
grant usage on schema auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;

create type public.user_role as enum (
  'owner', 'super_admin', 'admin', 'finance', 'sales_staff', 'milk_collection',
  'warehouse', 'customer', 'farmer', 'admin_assistant', 'manager'
);

create table public.organizations (id uuid primary key);
create table public.profiles (
  id uuid primary key,
  role public.user_role not null,
  extra_roles public.user_role[] not null default '{}',
  full_name text,
  is_active boolean not null default true,
  organization_id uuid references public.organizations(id),
  phone_number text
);
alter table public.profiles add constraint profiles_role_check
  check (role::text in ('owner','super_admin','admin','finance','sales_staff','milk_collection','warehouse','customer','farmer','admin_assistant','manager'));
grant select on public.profiles to authenticated;

create function public.fn_is_any_staff() returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
     where p.id = auth.uid() and p.is_active
       and p.role::text in ('owner','super_admin','admin','finance','sales_staff','milk_collection','warehouse','manager')
  );
$$;

create table public.farmers (
  id uuid primary key,
  full_name text,
  phone_number text,
  farmer_code text,
  village text,
  organization_id uuid,
  is_deleted boolean not null default false
);
create table public.customers (
  id uuid primary key,
  name text,
  phone_number text,
  address text,
  organization_id uuid,
  is_deleted boolean not null default false,
  current_balance numeric not null default 0
);
create table public.dealers (
  id uuid primary key,
  business_name text,
  phone_number text,
  dealer_code text,
  district text,
  organization_id uuid,
  is_active boolean not null default true
);
create table public.milk_entries (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid,
  entry_date date,
  quantity_liters numeric,
  total_amount numeric,
  rate_per_liter numeric,
  created_at timestamptz not null default now()
);
create table public.milk_payments (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid,
  payment_date date,
  amount numeric,
  payment_method text,
  notes text
);
create table public.farmer_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid,
  ledger_type text,
  amount numeric,
  source_type text,
  notes text,
  created_at timestamptz not null default now(),
  balance_after numeric
);
create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  entry_number text,
  entry_date date,
  description text,
  source_module text,
  created_at timestamptz not null default now()
);
create table public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid references public.journal_entries(id),
  account_code text,
  debit numeric default 0,
  credit numeric default 0,
  party_type text,
  party_id uuid,
  memo text
);
create table public.categories (id uuid primary key, name text);
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text,
  selling_price numeric,
  is_deleted boolean not null default false,
  category_id uuid
);

grant select, insert, update, delete on public.journal_lines to authenticated;
grant select, insert, update, delete on public.journal_entries to authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update, delete on public.customers to authenticated;
alter table public.journal_lines enable row level security;
alter table public.journal_entries enable row level security;
alter table public.products enable row level security;
alter table public.customers enable row level security;
create policy jl_staff on public.journal_lines for all using (public.fn_is_any_staff()) with check (public.fn_is_any_staff());
create policy je_staff on public.journal_entries for all using (public.fn_is_any_staff()) with check (public.fn_is_any_staff());
-- Jaise koi purani policy bahut khuli ho: RLS ijazat de, trigger phir bhi agent ko roke.
create policy prod_open on public.products for all using (true) with check (true);
create policy cust_open on public.customers for all using (true) with check (true);

create table public.features (
  key text primary key,
  label text,
  label_en text,
  label_ur text,
  description text,
  description_en text,
  description_ur text,
  route text,
  icon text,
  is_sensitive boolean,
  is_active boolean
);
create table public.dashboards (
  key text primary key,
  label text not null,
  sort_order int not null,
  is_active boolean not null
);
create table public.dashboard_features (
  dashboard_key text references public.dashboards(key),
  feature_key text references public.features(key),
  section text,
  section_order int,
  sort_order int,
  primary key (dashboard_key, feature_key)
);
create table public.role_feature_permissions (
  role text not null,
  feature_key text not null references public.features(key),
  actions text[] not null default '{}',
  data_scope text not null default 'all',
  primary key (role, feature_key)
);
create table public.role_page_permissions (
  role text primary key,
  allowed_pages text[] not null default '{}'
);
create table public.feature_help (
  feature_key text references public.features(key),
  lang text,
  purpose text,
  who_uses text,
  when_use text,
  how_steps text[],
  next_step text,
  mistakes text[],
  primary key (feature_key, lang)
);
