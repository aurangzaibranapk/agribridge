-- =====================================================================
-- AgriBridge — Migration 055: Route & Fuel Optimization (Phase 3)
-- =====================================================================
-- Motorcycle registry + daily fuel/mileage logs. Links to a route
-- collection date so we can compute "fuel cost per litre of milk
-- collected" - the key efficiency metric.

create table if not exists vehicles (
  id uuid primary key default uuid_generate_v4(),
  vehicle_name text not null,
  registration_no text,
  assigned_rider text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists fuel_logs (
  id uuid primary key default uuid_generate_v4(),
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  log_date date not null,
  opening_km numeric(10,1) not null,
  closing_km numeric(10,1),
  km_travelled numeric(10,1),
  fuel_liters_purchased numeric(8,2),
  fuel_cost numeric(10,2),
  km_per_liter numeric(8,2),
  route_name text,
  milk_volume_collected numeric(10,2),
  fuel_cost_per_liter_milk numeric(8,2),
  is_anomaly boolean not null default false,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table vehicles enable row level security;
create policy staff_manage_vehicles on vehicles for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager'))
);

alter table fuel_logs enable row level security;
create policy staff_manage_fuel_logs on fuel_logs for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager'))
);