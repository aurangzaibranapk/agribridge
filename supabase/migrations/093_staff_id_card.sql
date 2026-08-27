-- =====================================================================
-- AgriBridge — Migration 093: Staff ID Card (Photo + Emergency Info)
-- =====================================================================

alter table staff_details add column if not exists photo_url text;
alter table staff_details add column if not exists blood_group text;
alter table staff_details add column if not exists emergency_contact_name text;
alter table staff_details add column if not exists emergency_contact_phone text;
alter table staff_details add column if not exists employee_code text;

insert into storage.buckets (id, name, public)
values ('staff-photos', 'staff-photos', true)
on conflict (id) do nothing;