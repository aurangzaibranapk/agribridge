-- =====================================================================
-- AgriBridge — Migration 038: Land Prep + Labor Rate Master
-- =====================================================================
-- Admin-configurable rate lists for Land Preparation activities (Hal,
-- Karahi, Rotavator, Land Leveler) and Labor types (Spray/Fertilizer/
-- Irrigation Mazdori). Crop expense entries pick from these dropdowns
-- instead of free text, so the rate auto-fills but the farmer can
-- still adjust the final amount if actual cost differed.

create table land_prep_rates (
  id uuid primary key default uuid_generate_v4(),
  activity_name text not null,
  rate_per_acre numeric(12,2) not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table labor_rates (
  id uuid primary key default uuid_generate_v4(),
  labor_type text not null,
  rate numeric(12,2) not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into land_prep_rates (activity_name, rate_per_acre) values
  ('Hal Chalana', 1500),
  ('Karahi Chalana', 1200),
  ('Rotavator Chalana', 2000),
  ('Land Leveler Chalana', 2500);

insert into labor_rates (labor_type, rate) values
  ('Spray Mazdori', 500),
  ('Khaad Mazdori', 400),
  ('Pani Lagane Ki Mazdori', 300);

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table land_prep_rates enable row level security;
alter table labor_rates enable row level security;

do $$
declare t text;
begin
  for t in select unnest(array['land_prep_rates', 'labor_rates'])
  loop
    execute format('create policy staff_all_access on %I for all using (
      exists (select 1 from profiles where id = auth.uid() and is_active = true
        and role in (''super_admin'',''admin'',''manager'',''sales_staff''))
    ) with check (
      exists (select 1 from profiles where id = auth.uid() and is_active = true
        and role in (''super_admin'',''admin'',''manager'',''sales_staff''))
    );', t);
    execute format('create policy authenticated_read on %I for select using (auth.uid() is not null);', t);
  end loop;
end $$;