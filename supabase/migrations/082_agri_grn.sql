-- =====================================================================
-- AgriBridge — Migration 082: GRN (Goods Receiving Note) + QC (Phase 4)
-- =====================================================================

create table if not exists agri_grns (
  id uuid primary key default uuid_generate_v4(),
  grn_number text not null unique,
  order_id uuid not null references agri_orders(id) on delete cascade,
  dispatch_id uuid references agri_dispatches(id),

  receiving_date date not null,

  ordered_value numeric(12,2) not null default 0,
  received_value numeric(12,2) not null default 0,
  shortage_amount numeric(12,2) not null default 0,
  damage_amount numeric(12,2) not null default 0,
  discount_adjustment numeric(12,2) not null default 0,
  payable_amount numeric(12,2) not null default 0,

  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists agri_grn_items (
  id uuid primary key default uuid_generate_v4(),
  grn_id uuid not null references agri_grns(id) on delete cascade,
  order_item_id uuid references agri_order_items(id),

  product_name text not null,
  batch_no text,
  expiry_date date,
  manufacturing_date date,
  unit_price numeric(10,2) not null default 0,

  ordered_qty numeric(10,2) not null,
  received_qty numeric(10,2) not null,
  difference_qty numeric(10,2) not null default 0,
  difference_type text not null default 'None' check (difference_type in ('Short','Excess','Damaged','Wrong Product','Expired','Batch Issue','None')),

  seal_condition text,
  packaging_condition text,
  quality_status text not null default 'Accepted' check (quality_status in ('Accepted','Accepted with Difference','Rejected')),
  rejection_reason text
);

create table if not exists agri_grn_counters (
  year integer primary key,
  last_number integer not null default 0
);

alter table agri_orders add column if not exists order_id_display text;

alter table agri_grns enable row level security;
create policy staff_manage_agri_grns on agri_grns for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager','sales_staff'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager','sales_staff'))
);

alter table agri_grn_items enable row level security;
create policy staff_manage_agri_grn_items on agri_grn_items for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager','sales_staff'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager','sales_staff'))
);

alter table agri_grn_counters enable row level security;
create policy staff_manage_agri_grn_counters on agri_grn_counters for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager','sales_staff'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager','sales_staff'))
);