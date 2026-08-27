-- =====================================================================
-- AgriBridge — Migration 058: Meter Reading Photos
-- =====================================================================
alter table fuel_logs add column if not exists meter_photo_url text;
alter table generator_logs add column if not exists meter_photo_url text;

insert into storage.buckets (id, name, public)
values ('meter-readings', 'meter-readings', true)
on conflict (id) do nothing;