-- =====================================================================
-- AgriBridge — Migration 052: Milk Dual-Rate System (Phase 1)
-- =====================================================================
-- Self Drop-off farmers get Standard Rate + Incentive; Field Collection
-- farmers get Standard Rate only. Tracks farmer type + a migration log
-- so switches (and the resulting savings) are auditable.

alter table farmers add column if not exists milk_collection_type text not null default 'field_collection' check (milk_collection_type in ('self_dropoff', 'field_collection'));

create table if not exists milk_rate_settings (
  id uuid primary key default uuid_generate_v4(),
  standard_rate numeric(10,2) not null default 145,
  self_dropoff_incentive numeric(10,2) not null default 10,
  updated_at timestamptz not null default now()
);
insert into milk_rate_settings (standard_rate, self_dropoff_incentive)
  select 145, 10
  where not exists (select 1 from milk_rate_settings);

create table if not exists milk_type_migrations (
  id uuid primary key default uuid_generate_v4(),
  farmer_id uuid not null references farmers(id) on delete cascade,
  old_type text not null,
  new_type text not null,
  changed_by uuid references profiles(id),
  changed_at timestamptz not null default now()
);

alter table milk_rate_settings enable row level security;
alter table milk_type_migrations enable row level security;

create policy staff_manage_milk_rate_settings on milk_rate_settings for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin'))
);

create policy staff_view_milk_migrations on milk_type_migrations for select using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager'))
);
create policy staff_insert_milk_migrations on milk_type_migrations for insert with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager'))
);