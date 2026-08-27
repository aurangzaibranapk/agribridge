-- =====================================================================
-- AgriBridge — Migration 057: Fuel/Diesel Rate + Expected Efficiency
-- =====================================================================
-- Admin sets today's Petrol/Diesel rate once, system adds a margin
-- automatically. Also lets admin set an "expected" efficiency baseline
-- per vehicle (km/L) and for the generator (hours/L) so anomaly
-- detection compares against a real, admin-known number instead of a
-- generic guess range.

alter table vehicles add column if not exists expected_km_per_liter numeric(6,2) not null default 45;

create table if not exists fuel_rate_settings (
  id uuid primary key default uuid_generate_v4(),
  petrol_rate numeric(8,2) not null default 280,
  diesel_rate numeric(8,2) not null default 290,
  margin numeric(6,2) not null default 5,
  generator_expected_hours_per_liter numeric(6,2) not null default 2.17,
  updated_at timestamptz not null default now()
);
insert into fuel_rate_settings (petrol_rate, diesel_rate, margin, generator_expected_hours_per_liter)
select 280, 290, 5, 2.17
where not exists (select 1 from fuel_rate_settings);

alter table fuel_rate_settings enable row level security;
create policy staff_manage_fuel_rate_settings on fuel_rate_settings for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin'))
);
create policy public_read_fuel_rate_settings on fuel_rate_settings for select using (true);