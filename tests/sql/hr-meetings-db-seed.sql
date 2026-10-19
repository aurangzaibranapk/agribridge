-- HR meetings test fixtures (har case transaction mein, aakhir mein ROLLBACK).
alter table public.profiles drop constraint if exists profiles_role_check;
set local session_replication_role = replica;
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000a001','hr.m@test.local','authenticated','authenticated'),
  ('00000000-0000-0000-0000-00000000b001','staff1.m@test.local','authenticated','authenticated'),
  ('00000000-0000-0000-0000-00000000b002','staff2.m@test.local','authenticated','authenticated')
on conflict (id) do nothing;
set local session_replication_role = origin;
insert into public.profiles (id, full_name, role, is_active) values
  ('00000000-0000-0000-0000-00000000a001','M HR','hr',true),
  ('00000000-0000-0000-0000-00000000b001','M Staff1','sales_staff',true),
  ('00000000-0000-0000-0000-00000000b002','M Staff2','sales_staff',true)
on conflict (id) do update set full_name = excluded.full_name, role = excluded.role, is_active = true;
insert into public.hr_meetings (id, title, starts_at, duration_min, organizer_id, meet_url) values
  ('22222222-0000-0000-0000-000000000001','Payroll October', now() + interval '1 day', 60,
   '00000000-0000-0000-0000-00000000a001','https://meet.google.com/pay-oct-26');
insert into public.hr_meeting_attendees (meeting_id, profile_id) values
  ('22222222-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000b001');
insert into public.hr_meeting_action_items (id, meeting_id, title, owner_id, due_date) values
  ('33333333-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001','Hazri gaps verify',
   '00000000-0000-0000-0000-00000000b001', current_date + 2);
