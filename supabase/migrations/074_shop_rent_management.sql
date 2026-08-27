-- =====================================================================
-- AgriBridge — Migration 074: Shop Rent Management
-- =====================================================================
-- Each Branch (shop) can have its own rent agreement with its own
-- landlord, rent amount, and due date. Monthly payment tracking is
-- separate so partial/late payments can be recorded per month.

create table if not exists shop_rent_agreements (
  id uuid primary key default uuid_generate_v4(),
  branch_id uuid not null references branches(id) on delete cascade,
  landlord_name text not null,
  landlord_contact text,
  landlord_cnic text,
  monthly_rent numeric(10,2) not null,
  due_day integer not null default 5 check (due_day between 1 and 31),
  agreement_start_date date not null,
  agreement_end_date date,
  agreement_document_url text,
  status text not null default 'active' check (status in ('active','terminated')),
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists shop_rent_payments (
  id uuid primary key default uuid_generate_v4(),
  agreement_id uuid not null references shop_rent_agreements(id) on delete cascade,
  payment_month integer not null,
  payment_year integer not null,
  amount_due numeric(10,2) not null,
  amount_paid numeric(10,2) not null default 0,
  paid_date date,
  payment_method text,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (agreement_id, payment_month, payment_year)
);

alter table shop_rent_agreements enable row level security;
create policy staff_manage_rent_agreements on shop_rent_agreements for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin'))
);

alter table shop_rent_payments enable row level security;
create policy staff_manage_rent_payments on shop_rent_payments for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin'))
);