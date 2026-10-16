-- Milk Control Center extension
-- Collectors (Ladke) and better Chillar tracking

create table if not exists milk_collectors (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  phone text,
  assigned_chillar text,
  route text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists milk_chillars (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  location text,
  in_charge text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Link entries to collector and chillar
alter table milk_entries
  add column if not exists collector_id uuid references milk_collectors(id),
  add column if not exists chillar_id uuid references milk_chillars(id);

-- Indexes
create index if not exists idx_milk_collectors_active on milk_collectors(is_active);
create index if not exists idx_milk_chillars_active on milk_chillars(is_active);
create index if not exists idx_milk_entries_collector on milk_entries(collector_id);
create index if not exists idx_milk_entries_chillar on milk_entries(chillar_id);

-- RLS
alter table milk_collectors enable row level security;
alter table milk_chillars enable row level security;

create policy staff_manage_collectors on milk_collectors for all
  using (public.fn_is_any_staff()) with check (public.fn_is_any_staff());

create policy staff_manage_chillars on milk_chillars for all
  using (public.fn_is_any_staff()) with check (public.fn_is_any_staff());
