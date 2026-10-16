-- Test-only stubs of live objects the 551-558 migrations depend on.
create role anon; create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create table public.profiles (id uuid primary key, full_name text, role text, is_active boolean default true);
create table public.staff_details (id uuid primary key default gen_random_uuid(), profile_id uuid unique references public.profiles(id),
  hire_date date, probation_start_date date, basic_salary numeric(12,2), is_active boolean default true, branch_id uuid, exit_date date);
create function public.fn_is_any_staff() returns boolean language sql stable as $$ select true $$;
create table public.test_attendance (profile_id uuid, y int, m int, present int, half int, paid_leave int, unpaid_leave int, absent int, missing int, open_items int, finalized boolean);
create function public.fn_attendance_month_summary(p_profile uuid, p_year int, p_month int)
returns table(working_days int, present_days int, half_days int, paid_leave_days int, unpaid_leave_days int, absent_days int,
  missing_days int, holiday_days int, off_days int, late_count int, late_minutes_total int, worked_minutes_total int, open_items int, is_finalized boolean)
language sql stable as $$ select 30, present, half, paid_leave, unpaid_leave, absent, missing, 0, 0, 0, 0, 0, open_items, finalized
  from public.test_attendance where profile_id = p_profile and y = p_year and m = p_month $$;
create table public.salary_payments (id uuid primary key default gen_random_uuid(), profile_id uuid, pay_month int, pay_year int,
  basic_salary numeric, bonus numeric, deductions numeric, advance_deduction numeric, net_salary numeric, status text, paid_date date, notes text,
  unique(profile_id, pay_month, pay_year));
create table public.gl_accounts (code text primary key, name text, account_type text, normal_side text, is_active boolean, sort_order int);
create table public.features (key text primary key, label text, label_en text, label_ur text, route text, icon text, description text, is_active boolean default true);
create table public.dashboard_features (dashboard_key text, feature_key text, sort_order int, section text, section_order int, primary key (dashboard_key, feature_key));
create table public.role_feature_permissions (role text, feature_key text, actions text[], primary key (role, feature_key));
create table public.feature_help (feature_key text, lang text, purpose text, who_uses text, when_use text, how_steps text[], next_step text, mistakes text[], primary key (feature_key, lang));
