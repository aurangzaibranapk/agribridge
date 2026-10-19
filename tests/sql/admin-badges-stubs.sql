-- Test-only stubs for 582 (PGlite). Sirf wo cheezen jo 582 parhta hai.
create role anon; create role authenticated; create role service_role;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
grant usage on schema public to authenticated, anon;
grant usage on schema auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
create table public.profiles (id uuid primary key, role text, branch_id uuid, full_name text);
grant select on public.profiles to authenticated;
create function public.fn_is_any_staff() returns boolean language sql stable as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role not in ('farmer','customer')) $$;
-- Teen source tables (baqi jaan boojh kar nahi -> readable=false).
create table public.pos_returns (id uuid primary key default gen_random_uuid(), return_number text, branch_id uuid,
  total_amount numeric, created_by uuid, admin_review_status text, created_at timestamptz default now());
create table public.leave_requests (id uuid primary key default gen_random_uuid(), profile_id uuid, manager_id uuid,
  leave_type text, status text, created_at timestamptz default now());
create table public.data_health_findings (id uuid primary key default gen_random_uuid(), title text, amount numeric,
  status text, detected_at timestamptz default now());
alter table public.pos_returns enable row level security;
alter table public.leave_requests enable row level security;
alter table public.data_health_findings enable row level security;
create policy pr_read on public.pos_returns for select to authenticated using (public.fn_is_any_staff());
-- leave: sirf manager / khud
create policy lr_read on public.leave_requests for select to authenticated using (manager_id = auth.uid() or profile_id = auth.uid()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner','admin')));
create policy dh_read on public.data_health_findings for select to authenticated using (public.fn_is_any_staff());
grant select on public.pos_returns, public.leave_requests, public.data_health_findings to authenticated;
