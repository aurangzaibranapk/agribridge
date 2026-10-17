-- Test-only stubs of live objects that 559 depends on (PGlite).
create role anon; create role authenticated; create role service_role;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create table auth.users (id uuid primary key, email text, created_at timestamptz default now());
create table auth.sessions (id uuid primary key default gen_random_uuid(), user_id uuid);
create table auth.refresh_tokens (id bigserial primary key, user_id varchar(255), token text);
create table public.profiles (id uuid primary key, full_name text, role text, is_active boolean default true, phone_number text);
create table public.farmers (id uuid primary key default gen_random_uuid(), user_id uuid, full_name text, phone_number text, phone_key text);
create function public.fn_phone_key(p text) returns text language sql immutable as $$ select nullif(right(regexp_replace(coalesce(p,''), '\D', '', 'g'), 10), '') $$;
create table public.password_reset_tokens (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
  token text not null unique, expires_at timestamptz not null, used_at timestamptz, created_at timestamptz not null default now());
alter table public.password_reset_tokens enable row level security;
