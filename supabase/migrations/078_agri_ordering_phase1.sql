-- =====================================================================
-- AgriBridge — Migration 078: Agri Ordering System (Phase 1)
-- Order Creation + Product Selection + Approval Flow
-- =====================================================================

create table if not exists agri_order_counters (
  year integer primary key,
  last_number integer not null default 0
);

create table if not exists agri_orders (
  id uuid primary key default uuid_generate_v4(),
  order_number text not null unique,

  order_type text not null check (order_type in ('Fertilizer','Pesticide','Seed','Animal Feed','Veterinary Products','Agricultural Equipment','FMCG / Other')),
  order_from text not null default 'AgriBridge Company',
  order_to_type text not null check (order_to_type in ('Kisan Dukan','Agri Dealer','Kisan Partner','Branch','Warehouse','Farmer')),
  order_to_branch_id uuid references branches(id),

  partner_name text,
  partner_code text,
  shop_dealer_name text,
  location text,
  city text,
  district text,
  contact_person text,
  mobile_number text,

  subtotal numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  tax numeric(12,2) not null default 0,
  freight_charges numeric(12,2) not null default 0,
  other_charges numeric(12,2) not null default 0,
  grand_total numeric(12,2) not null default 0,

  payment_terms text not null default 'Cash' check (payment_terms in ('Cash','Bank Transfer','Credit','Advance Payment','Partial Payment')),
  credit_limit numeric(12,2) default 0,
  existing_outstanding numeric(12,2) default 0,
  available_credit numeric(12,2) default 0,
  projected_outstanding numeric(12,2) default 0,

  status text not null default 'draft' check (status in (
    'draft','submitted','sales_verified','finance_verified','approved',
    'processing','dispatched','in_transit','delivered','grn_submitted','completed','cancelled','rejected'
  )),

  requested_by uuid references profiles(id),
  sales_verified_by uuid references profiles(id),
  sales_verified_at timestamptz,
  finance_verified_by uuid references profiles(id),
  finance_verified_at timestamptz,
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  rejection_reason text,

  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists agri_order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references agri_orders(id) on delete cascade,
  product_id uuid references products(id),

  product_name text not null,
  brand text,
  category text,
  sku text,
  pack_size text,
  batch_no text,
  manufacturing_date date,
  expiry_date date,
  available_stock_snapshot numeric(10,2),

  order_qty numeric(10,2) not null,
  unit_price numeric(10,2) not null,
  discount numeric(10,2) not null default 0,
  tax numeric(10,2) not null default 0,
  net_price numeric(10,2) not null,
  line_total numeric(12,2) not null,

  -- Pesticide-specific
  active_ingredient text,
  formulation text,
  registration_no text,

  -- Seed-specific
  variety text,
  lot_no text,
  germination_percent numeric(5,2),
  production_year integer,
  treatment_status text,

  created_at timestamptz not null default now()
);

create table if not exists agri_order_timeline (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references agri_orders(id) on delete cascade,
  status text not null,
  note text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table agri_orders enable row level security;
create policy staff_manage_agri_orders on agri_orders for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager','sales_staff'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager','sales_staff'))
);

alter table agri_order_items enable row level security;
create policy staff_manage_agri_order_items on agri_order_items for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager','sales_staff'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager','sales_staff'))
);

alter table agri_order_timeline enable row level security;
create policy staff_manage_agri_order_timeline on agri_order_timeline for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager','sales_staff'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager','sales_staff'))
);

alter table agri_order_counters enable row level security;
create policy staff_manage_agri_order_counters on agri_order_counters for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager','sales_staff'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager','sales_staff'))
);