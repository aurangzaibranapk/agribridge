-- =====================================================================
-- AgriBridge — Migration 060: Company Billing + P&L Dashboard (Phase 6)
-- =====================================================================
-- Service rate to bill the company per litre (admin-adjustable), plus
-- a simple monthly-expenses table for costs that aren't otherwise
-- auto-tracked (Electricity bill, Chiller Maintenance) so the P&L
-- dashboard can pull EVERY deduction category from one consistent
-- place.

create table if not exists company_billing_settings (
  id uuid primary key default uuid_generate_v4(),
  company_name text not null default 'Wasela Pakistan',
  service_rate_per_liter numeric(8,2) not null default 10,
  updated_at timestamptz not null default now()
);
insert into company_billing_settings (company_name, service_rate_per_liter)
select 'Wasela Pakistan', 10
where not exists (select 1 from company_billing_settings);

create table if not exists monthly_expenses (
  id uuid primary key default uuid_generate_v4(),
  expense_month integer not null,
  expense_year integer not null,
  category text not null,
  amount numeric(10,2) not null,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (expense_month, expense_year, category)
);

alter table company_billing_settings enable row level security;
create policy staff_manage_billing_settings on company_billing_settings for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin'))
);

alter table monthly_expenses enable row level security;
create policy staff_manage_monthly_expenses on monthly_expenses for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin'))
);