-- =====================================================================
-- AgriBridge — Migration 086: Supplier Payments (for Statement tracking)
-- =====================================================================

create table if not exists supplier_payments (
  id uuid primary key default uuid_generate_v4(),
  supplier_id uuid not null references suppliers(id) on delete cascade,
  amount numeric(12,2) not null,
  payment_date date not null,
  payment_method text,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table supplier_payments enable row level security;
create policy staff_manage_supplier_payments on supplier_payments for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager'))
);