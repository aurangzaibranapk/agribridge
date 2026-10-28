-- Test-only stubs of live objects that 621 depends on (PGlite). Not a migration.
create role anon; create role authenticated; create role service_role;
create schema auth;
create table auth.users (id uuid primary key, email text, encrypted_password text default '', created_at timestamptz default now());
create table public.profiles (id uuid primary key, full_name text, role text, is_active boolean default true, phone_number text);
create table public.staff_details (id uuid primary key default gen_random_uuid(), profile_id uuid, phone text, is_active boolean default true);
create table public.dealers (id uuid primary key default gen_random_uuid(), user_id uuid, phone_number text, is_active boolean default true);
create table public.machinery_vendors (id uuid primary key default gen_random_uuid(), user_id uuid, phone text, is_active boolean default true);
create table public.farmers (id uuid primary key default gen_random_uuid(), user_id uuid, full_name text, phone_number text, phone_key text,
  email text, username text, registration_source text, is_deleted boolean default false);
create table public.customers (id uuid primary key default gen_random_uuid(), user_id uuid, full_name text, phone_number text, email text, is_deleted boolean default false);
create function public.fn_phone_key(p text) returns text language sql immutable as $$ select nullif(right(regexp_replace(coalesce(p,''), '\D', '', 'g'), 10), '') $$;
create table public.farmer_login_otps (id uuid primary key default gen_random_uuid(), phone_key text not null, code_hash text not null,
  sent_via text check (sent_via in ('whatsapp','sms')), send_error text, attempts int not null default 0, expires_at timestamptz not null,
  consumed_at timestamptz, created_at timestamptz not null default now());
