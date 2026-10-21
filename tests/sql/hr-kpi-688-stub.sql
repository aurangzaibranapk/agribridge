-- Kam se kam schema jis par 688 chal sake (sirf LOCAL test).
create extension if not exists pgcrypto;
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
do $$ begin create role anon; exception when duplicate_object then null; end $$;
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::json->>'sub', '')::uuid $$;
create table if not exists public.profiles (id uuid primary key, full_name text, role text, is_active boolean default true);
create table if not exists public.staff_details (id uuid primary key default gen_random_uuid(), profile_id uuid unique references profiles(id), hire_date date, exit_date date, exit_reason text, is_active boolean default true);
create table if not exists public.job_applications (id uuid primary key default gen_random_uuid(), full_name text not null, status text not null default 'pending', interview_date date, created_at timestamptz not null default now());
create table if not exists public.hr_payroll_settings (id int primary key default 1);
insert into public.hr_payroll_settings values (1) on conflict do nothing;
create or replace function public.fn_hr_meetings_full_access() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and is_active and role in ('hr','admin','owner','super_admin')) $$;
create or replace function public.fn_is_any_staff() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and is_active and role <> 'farmer') $$;
grant usage on schema public, auth to authenticated, anon;
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
