-- Test-only stubs (PGlite) of live objects that 580 depends on.
create role anon; create role authenticated; create role service_role;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create table auth.users (id uuid primary key, email text, phone text, created_at timestamptz default now(), last_sign_in_at timestamptz, banned_until timestamptz);
create type public.user_role as enum ('owner','super_admin','admin','sales_staff','farmer','customer','dealer','machinery_vendor','investor','company_rep','hr');
create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, full_name text, role public.user_role, is_active boolean default true, phone_number text);
create table public.farmers (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete set null, full_name text, farmer_code text, phone_number text);
create table public.customers (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete set null, name text, phone_number text);
create table public.dealers (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete set null, business_name text, dealer_code text, phone_number text);
create table public.machinery_vendors (id uuid primary key default gen_random_uuid(), user_id uuid, vendor_name text, phone text);
