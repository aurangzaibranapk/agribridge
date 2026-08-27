-- =====================================================================
-- AgriBridge — Migration 020: Milk Collection Module
-- =====================================================================
-- Milk collection is tracked against existing farmers (no separate
-- supplier list) so a farmer's milk supply, livestock loans, and farm
-- records all live under one profile. Rate is entered manually per
-- entry (not auto-calculated from FAT/SNF) for simplicity — FAT/SNF/LR
-- are still recorded for quality tracking and can drive an automatic
-- formula later if needed.

create table milk_entries (
  id uuid primary key default uuid_generate_v4(),
  farmer_id uuid not null references farmers(id) on delete restrict,
  entry_date date not null default current_date,
  shift text not null default 'morning' check (shift in ('morning', 'evening')),
  quantity_liters numeric(10,2) not null check (quantity_liters > 0),
  fat_percentage numeric(5,2),
  snf_percentage numeric(5,2),
  lr numeric(6,2),
  rate_per_liter numeric(10,2) not null,
  total_amount numeric(14,2) not null,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index idx_milk_entries_farmer on milk_entries(farmer_id, entry_date);
create index idx_milk_entries_date on milk_entries(entry_date);

create table milk_payments (
  id uuid primary key default uuid_generate_v4(),
  farmer_id uuid not null references farmers(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  payment_date date not null default current_date,
  payment_method text, -- cash, bank_transfer, easypaisa, jazzcash...
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index idx_milk_payments_farmer on milk_payments(farmer_id);

-- Running balance per farmer: total owed to them for milk supplied,
-- minus what's already been paid. Positive = we owe the farmer.
create view milk_farmer_balances as
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
  from milk_entries
  group by farmer_id
) entries on entries.farmer_id = f.id
left join (
  select farmer_id, sum(amount) as total_paid
  from milk_payments
  group by farmer_id
) payments on payments.farmer_id = f.id
where f.is_deleted = false;

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table milk_entries enable row level security;
alter table milk_payments enable row level security;

do $$
declare t text;
begin
  for t in select unnest(array['milk_entries', 'milk_payments'])
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

-- Farmer portal: a farmer can see their own milk entries and payments,
-- read-only (same pattern as crop_history/harvest_records etc.)
create policy farmer_own_milk_entries on milk_entries for select using (
  exists (select 1 from farmers f where f.id = milk_entries.farmer_id and f.user_id = auth.uid())
);
create policy farmer_own_milk_payments on milk_payments for select using (
  exists (select 1 from farmers f where f.id = milk_payments.farmer_id and f.user_id = auth.uid())
);