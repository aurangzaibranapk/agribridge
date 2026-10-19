-- Test-only stubs of live objects that 560 depends on (PGlite).
create role anon; create role authenticated; create role service_role;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb, created_at timestamptz default now());
create type public.user_role as enum ('super_admin','admin','manager','sales_staff','farmer','customer','dealer','investor','company_rep','finance','warehouse','admin_assistant','owner','hr','procurement','milk_collection','ai_assistant','agronomist','machinery','machinery_vendor');
create table public.organizations (id uuid primary key);
insert into public.organizations values ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000a2');
create function public.fn_default_organization_id() returns uuid language sql stable as $$ select '00000000-0000-0000-0000-0000000000a1'::uuid $$;
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null, phone_number text,
  role public.user_role not null default 'sales_staff', is_active boolean not null default true,
  created_at timestamptz not null default now(), branch_id uuid,
  organization_id uuid not null default public.fn_default_organization_id(),
  status text not null default 'active', status_reason text, status_changed_at timestamptz, shop_id uuid);
create table public.farmers (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id), full_name text, phone_number text, is_deleted boolean default false, organization_id uuid, branch_id uuid, signup_approval_status text);
create table public.customers (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id), name text, business_name text, phone_number text, is_deleted boolean default false, organization_id uuid, branch_id uuid, shop_id uuid);
create table public.machinery_vendors (id uuid primary key default gen_random_uuid(), user_id uuid, vendor_name text, phone text);
create table public.dealers (id uuid primary key default gen_random_uuid(), user_id uuid, business_name text, phone_number text, organization_id uuid);
create table public.buyers (id uuid primary key default gen_random_uuid(), user_id uuid, business_name text, phone_number text, organization_id uuid);
create table public.investors (id uuid primary key default gen_random_uuid(), user_id uuid, full_name text, phone_number text, organization_id uuid);
create table public.company_reps (id uuid primary key default gen_random_uuid(), user_id uuid, full_name text, phone_number text);
