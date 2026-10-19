-- Test fixtures (har case ek transaction mein, aakhir mein ROLLBACK -- kuch nahi bachta).
-- Local schema mein 051 ka purana role check reh gaya hai (live par hr/finance roles hain).
alter table public.profiles drop constraint if exists profiles_role_check;
set local session_replication_role = replica;
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000a001','hr.t@test.local','authenticated','authenticated'),
  ('00000000-0000-0000-0000-00000000a002','admin.t@test.local','authenticated','authenticated'),
  ('00000000-0000-0000-0000-00000000a003','admin2.t@test.local','authenticated','authenticated'),
  ('00000000-0000-0000-0000-00000000b001','staff.t@test.local','authenticated','authenticated')
on conflict (id) do nothing;
set local session_replication_role = origin;
insert into public.profiles (id, full_name, role, is_active) values
  ('00000000-0000-0000-0000-00000000a001','T HR','hr',true),
  ('00000000-0000-0000-0000-00000000a002','T Admin','admin',true),
  ('00000000-0000-0000-0000-00000000a003','T Admin2','admin',true),
  ('00000000-0000-0000-0000-00000000b001','T Staff','sales_staff',true)
on conflict (id) do update set full_name = excluded.full_name, role = excluded.role, is_active = true;
insert into public.staff_details (profile_id, basic_salary, hire_date, reports_to) values
  ('00000000-0000-0000-0000-00000000a001', 50000, '2025-01-01', '00000000-0000-0000-0000-00000000a002'),
  ('00000000-0000-0000-0000-00000000a002', 90000, '2024-01-01', null),
  ('00000000-0000-0000-0000-00000000b001', 20000, '2026-01-01', '00000000-0000-0000-0000-00000000a001')
on conflict (profile_id) do nothing;
