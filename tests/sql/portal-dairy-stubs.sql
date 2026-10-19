-- Test-only stubs of live objects that 566-568 depend on (PGlite).
create role anon; create role authenticated;
create schema auth;
grant usage on schema auth to anon, authenticated;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create table public.farmers (id uuid primary key default gen_random_uuid(), user_id uuid, full_name text, cow_count int default 0, buffalo_count int default 0);
create table public.farms (id uuid primary key default gen_random_uuid(), farmer_id uuid, name text);
create table public.profiles (id uuid primary key, role text, is_active boolean default true);
create table public.milk_entries (id uuid primary key default gen_random_uuid(), farmer_id uuid, entry_date date, shift text, quantity_liters numeric, rate_per_liter numeric);
create function public.fn_is_staff(p_user_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = p_user_id and is_active and role in ('super_admin','admin','manager','sales_staff')) $$;
grant usage on schema public to anon, authenticated;
