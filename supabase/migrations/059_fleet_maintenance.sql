-- =====================================================================
-- AgriBridge — Migration 059: Fleet & Asset Maintenance (Phase 4)
-- =====================================================================
-- Service reminders every X km, maintenance cost logs, and a
-- Rs 25,000/month motorcycle replacement reserve fund (calculated
-- automatically from elapsed months since a start date, minus any
-- withdrawals when a bike actually gets replaced).

alter table vehicles add column if not exists last_service_km numeric(10,1) not null default 0;
alter table vehicles add column if not exists service_interval_km numeric(10,1) not null default 1000;

create table if not exists maintenance_logs (
  id uuid primary key default uuid_generate_v4(),
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  service_date date not null,
  km_at_service numeric(10,1) not null,
  description text not null,
  cost numeric(10,2) not null default 0,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists replacement_fund_settings (
  id uuid primary key default uuid_generate_v4(),
  monthly_contribution numeric(10,2) not null default 25000,
  fund_start_date date not null default current_date
);
insert into replacement_fund_settings (monthly_contribution, fund_start_date)
select 25000, current_date
where not exists (select 1 from replacement_fund_settings);

create table if not exists replacement_fund_withdrawals (
  id uuid primary key default uuid_generate_v4(),
  withdrawal_date date not null,
  amount numeric(10,2) not null,
  reason text not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table maintenance_logs enable row level security;
create policy staff_manage_maintenance_logs on maintenance_logs for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager'))
);

alter table replacement_fund_settings enable row level security;
create policy staff_manage_fund_settings on replacement_fund_settings for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin'))
);

alter table replacement_fund_withdrawals enable row level security;
create policy staff_manage_fund_withdrawals on replacement_fund_withdrawals for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin'))
);