-- 691 fixtures (har case transaction mein, aakhir mein ROLLBACK).
-- Supabase par authenticated ko auth schema ki usage hoti hai; local cluster par bhi (sirf is transaction mein).
grant usage on schema auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
alter table public.profiles drop constraint if exists profiles_role_check;
set local session_replication_role = replica;
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000c0001','hr.so@test.local','authenticated','authenticated'),
  ('00000000-0000-0000-0000-0000000c0002','adm1.so@test.local','authenticated','authenticated'),
  ('00000000-0000-0000-0000-0000000c0003','adm2.so@test.local','authenticated','authenticated'),
  ('00000000-0000-0000-0000-0000000c0004','staff.so@test.local','authenticated','authenticated'),
  ('00000000-0000-0000-0000-0000000c0005','staff2.so@test.local','authenticated','authenticated')
on conflict (id) do nothing;
set local session_replication_role = origin;
insert into public.profiles (id, full_name, role, is_active) values
  ('00000000-0000-0000-0000-0000000c0001','SO HR','hr',true),
  ('00000000-0000-0000-0000-0000000c0002','SO Admin1','admin',true),
  ('00000000-0000-0000-0000-0000000c0003','SO Owner','owner',true),
  ('00000000-0000-0000-0000-0000000c0004','Anwar Ul Hassan','sales_staff',true),
  ('00000000-0000-0000-0000-0000000c0005','Saima Bibi','sales_staff',true)
on conflict (id) do update set full_name = excluded.full_name, role = excluded.role, is_active = true;
update public.salary_components set is_active = true where code in ('HOUSE_RENT','TRAVEL','MOBILE');
insert into public.staff_details (profile_id, designation, hire_date, cnic, bank_account, bank_name, father_name) values
  ('00000000-0000-0000-0000-0000000c0004','Sales Staff', current_date - 360, '36302-0000000-1', 'PK00MSAL0000001234', 'Misaal Bank', 'Muhammad Hassan'),
  ('00000000-0000-0000-0000-0000000c0005','Accountant', current_date - 700, null, null, null, null)
on conflict (profile_id) do update set hire_date = excluded.hire_date, bank_account = excluded.bank_account, designation = excluded.designation;
insert into public.job_vacancies (id, title, designation) values ('44444444-0000-0000-0000-000000000001','Sales Staff','Sales Staff');
insert into public.job_applications (id, vacancy_id, full_name, email, expected_salary, created_profile_id) values
  ('44444444-0000-0000-0000-000000000002','44444444-0000-0000-0000-000000000001','Anwar Ul Hassan','anwar@test.local',55000,'00000000-0000-0000-0000-0000000c0004');
insert into public.job_offers (id, application_id, designation, basic, house_rent, travel, mobile, bonus, incentive_pct, joining_date) values
  ('44444444-0000-0000-0000-000000000003','44444444-0000-0000-0000-000000000002','Sales Staff',34000,8500,5000,2500,'1 basic / saal',4, current_date - 360);
