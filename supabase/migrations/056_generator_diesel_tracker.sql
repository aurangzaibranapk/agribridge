-- =====================================================================
-- AgriBridge — Migration 056: Generator Diesel Tracker (Phase 5)
-- =====================================================================
create table if not exists generator_logs (
  id uuid primary key default uuid_generate_v4(),
  log_date date not null,
  opening_hours numeric(10,1) not null,
  closing_hours numeric(10,1),
  hours_run numeric(10,1),
  diesel_liters_purchased numeric(8,2),
  diesel_cost numeric(10,2),
  liters_per_hour numeric(8,2),
  electricity_units numeric(10,2),
  milk_volume_chilled numeric(10,2),
  is_anomaly boolean not null default false,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table generator_logs enable row level security;
create policy staff_manage_generator_logs on generator_logs for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager'))
);