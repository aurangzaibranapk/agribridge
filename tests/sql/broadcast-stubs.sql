-- Test-only stubs (PGlite) for 589-599. Live DB nahi.
create role anon; create role authenticated; create role service_role;
create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create table public.profiles (id uuid primary key, role text, is_active boolean default true, full_name text);
create table public.features (key text primary key, label text, label_en text, label_ur text, description text, description_en text, description_ur text, route text, icon text, is_sensitive boolean, is_active boolean);
create table public.dashboard_features (dashboard_key text, feature_key text, section text, section_order int, sort_order int, primary key (dashboard_key, feature_key));
grant usage on schema public to anon, authenticated, service_role;
grant select on public.profiles to authenticated;
