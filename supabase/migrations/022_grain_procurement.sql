-- =====================================================================
-- AgriBridge — Migration 022: Grain Procurement (Wheat/Rice/Maize)
-- =====================================================================
-- Mirrors the milk_entries/milk_payments pattern (Migration 020): buys
-- from existing farmers (no separate supplier list), rate is manual
-- entry, running balance via a view. A single grain_type column
-- distinguishes Wheat/Rice/Maize instead of three separate tables,
-- since the fields (weight, moisture, quality, rate) are identical
-- across all three. warehouse_id covers Rice's "Warehouse Entry"
-- requirement and is optional for the others.

create type grain_type as enum ('wheat', 'rice', 'maize');

create table grain_procurement_entries (
  id uuid primary key default uuid_generate_v4(),
  farmer_id uuid not null references farmers(id) on delete restrict,
  grain_type grain_type not null,
  entry_date date not null default current_date,
  weight_kg numeric(12,2) not null check (weight_kg > 0),
  moisture_percentage numeric(5,2),
  quality_grade text,
  rate_per_kg numeric(10,2) not null,
  total_amount numeric(14,2) not null,
  warehouse_id uuid references warehouses(id),
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index idx_grain_entries_farmer on grain_procurement_entries(farmer_id, entry_date);
create index idx_grain_entries_type on grain_procurement_entries(grain_type, entry_date);

create table grain_procurement_payments (
  id uuid primary key default uuid_generate_v4(),
  farmer_id uuid not null references farmers(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  payment_date date not null default current_date,
  payment_method text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index idx_grain_payments_farmer on grain_procurement_payments(farmer_id);

-- Running balance per farmer across ALL grain types combined (same
-- "one account, whatever they've sold us" logic as milk_farmer_balances).
create view grain_farmer_balances as
select
  f.id as farmer_id,
  f.full_name,
  f.farmer_code,
  f.phone_number,
  coalesce(entries.total_supplied, 0) as total_supplied,
  coalesce(payments.total_paid, 0) as total_paid,
  coalesce(entries.total_supplied, 0) - coalesce(payments.total_paid, 0) as balance_due
from farmers f
left join (
  select farmer_id, sum(total_amount) as total_supplied
  from grain_procurement_entries
  group by farmer_id
) entries on entries.farmer_id = f.id
left join (
  select farmer_id, sum(amount) as total_paid
  from grain_procurement_payments
  group by farmer_id
) payments on payments.farmer_id = f.id
where f.is_deleted = false;

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table grain_procurement_entries enable row level security;
alter table grain_procurement_payments enable row level security;

do $$
declare t text;
begin
  for t in select unnest(array['grain_procurement_entries', 'grain_procurement_payments'])
  loop
    execute format('create policy staff_all_access on %I for all using (
      exists (select 1 from profiles where id = auth.uid() and is_active = true
        and role in (''super_admin'',''admin'',''manager'',''sales_staff''))
    ) with check (
      exists (select 1 from profiles where id = auth.uid() and is_active = true
        and role in (''super_admin'',''admin'',''manager'',''sales_staff''))
    );', t);
  end loop;
end $$;

create policy farmer_own_grain_entries on grain_procurement_entries for select using (
  exists (select 1 from farmers f where f.id = grain_procurement_entries.farmer_id and f.user_id = auth.uid())
);
create policy farmer_own_grain_payments on grain_procurement_payments for select using (
  exists (select 1 from farmers f where f.id = grain_procurement_payments.farmer_id and f.user_id = auth.uid())
);