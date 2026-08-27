-- =====================================================================
-- AgriBridge — Migration 080: Agri Order Payment Verification (Phase 2)
-- =====================================================================

create table if not exists agri_order_payments (
  id uuid primary key default uuid_generate_v4(),
  payment_number text not null unique,
  order_id uuid not null references agri_orders(id) on delete cascade,

  payment_method text not null check (payment_method in ('Bank Transfer','Cash','Online Payment','Cheque','Credit')),
  bank_name text,
  transaction_id text,
  payment_date date,
  paid_amount numeric(12,2) not null,
  receipt_url text,

  status text not null default 'pending_verification' check (status in ('pending_verification','verified','partially_verified','rejected')),
  rejection_reason text,
  verified_by uuid references profiles(id),
  verified_at timestamptz,

  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists agri_payment_counters (
  year integer primary key,
  last_number integer not null default 0
);

alter table agri_order_payments enable row level security;
create policy staff_manage_agri_order_payments on agri_order_payments for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager','sales_staff'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager','sales_staff'))
);

alter table agri_payment_counters enable row level security;
create policy staff_manage_agri_payment_counters on agri_payment_counters for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager','sales_staff'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager','sales_staff'))
);

insert into storage.buckets (id, name, public)
values ('agri-order-payments', 'agri-order-payments', true)
on conflict (id) do nothing;