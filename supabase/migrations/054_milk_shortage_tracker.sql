-- =====================================================================
-- AgriBridge — Migration 054: Milk Shortage/Red Alert Tracker (Phase 2)
-- =====================================================================
-- Field collectors log what they collected on their route; chiller
-- operators log what actually arrived. A gap bigger than the
-- threshold (default 0.5%) flags a Red Alert on that route/rider.

create table if not exists milk_route_collections (
  id uuid primary key default uuid_generate_v4(),
  route_name text not null,
  rider_name text,
  collection_date date not null,
  shift text not null default 'morning' check (shift in ('morning', 'evening')),
  field_collected_volume numeric(10,2) not null,
  chiller_received_volume numeric(10,2),
  shortage_liters numeric(10,2),
  shortage_percentage numeric(6,3),
  is_red_alert boolean not null default false,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table milk_rate_settings add column if not exists shortage_alert_threshold numeric(6,3) not null default 0.5;

alter table milk_route_collections enable row level security;
create policy staff_manage_route_collections on milk_route_collections for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager'))
);