-- =====================================================================
-- AgriBridge — Migration 042: Self Check-In/Check-Out with Location
-- =====================================================================

alter table attendance_records add column if not exists check_in_lat numeric(10,6);
alter table attendance_records add column if not exists check_in_lng numeric(10,6);
alter table attendance_records add column if not exists check_out_lat numeric(10,6);
alter table attendance_records add column if not exists check_out_lng numeric(10,6);
alter table attendance_records add column if not exists check_in_at timestamptz;
alter table attendance_records add column if not exists check_out_at timestamptz;

-- Staff can insert/update ONLY their own attendance row (self check-in),
-- separate from the existing admin_manage_attendance policy which lets
-- admin/manager mark attendance for anyone.
create policy staff_own_attendance on attendance_records for all using (
  profile_id = auth.uid()
) with check (
  profile_id = auth.uid()
);