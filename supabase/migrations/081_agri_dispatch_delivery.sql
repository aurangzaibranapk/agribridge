-- =====================================================================
-- AgriBridge — Migration 081: Dispatch + Delivery Confirmation (Phase 3)
-- =====================================================================

create table if not exists agri_dispatches (
  id uuid primary key default uuid_generate_v4(),
  dispatch_number text not null unique,
  order_id uuid not null references agri_orders(id) on delete cascade,

  warehouse_id uuid references warehouses(id),
  vehicle_no text,
  driver_name text,
  driver_mobile text,
  transporter text,
  dispatch_date date not null,
  expected_delivery_date date,
  delivery_location text,

  status text not null default 'dispatched' check (status in ('dispatched','in_transit','delivered')),

  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists agri_dispatch_items (
  id uuid primary key default uuid_generate_v4(),
  dispatch_id uuid not null references agri_dispatches(id) on delete cascade,
  order_item_id uuid references agri_order_items(id),
  product_name text not null,
  batch_no text,
  expiry_date date,
  ordered_qty numeric(10,2) not null,
  dispatched_qty numeric(10,2) not null,
  short_qty numeric(10,2) not null default 0,
  damaged_qty numeric(10,2) not null default 0
);

create table if not exists agri_deliveries (
  id uuid primary key default uuid_generate_v4(),
  dispatch_id uuid not null references agri_dispatches(id) on delete cascade,
  order_id uuid not null references agri_orders(id) on delete cascade,

  delivered_date date not null,
  receiver_name text not null,
  receiver_cnic text,
  receiver_mobile text,
  vehicle_no text,

  delivered_qty numeric(10,2),
  short_qty numeric(10,2) default 0,
  damaged_qty numeric(10,2) default 0,

  delivery_photo_url text,
  delivery_challan_url text,
  receiver_signature_data text,

  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists agri_dispatch_counters (
  year integer primary key,
  last_number integer not null default 0
);

alter table agri_dispatches enable row level security;
create policy staff_manage_agri_dispatches on agri_dispatches for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager','sales_staff'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager','sales_staff'))
);

alter table agri_dispatch_items enable row level security;
create policy staff_manage_agri_dispatch_items on agri_dispatch_items for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager','sales_staff'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager','sales_staff'))
);

alter table agri_deliveries enable row level security;
create policy staff_manage_agri_deliveries on agri_deliveries for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager','sales_staff'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager','sales_staff'))
);

alter table agri_dispatch_counters enable row level security;
create policy staff_manage_agri_dispatch_counters on agri_dispatch_counters for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager','sales_staff'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager','sales_staff'))
);

insert into storage.buckets (id, name, public)
values ('agri-deliveries', 'agri-deliveries', true)
on conflict (id) do nothing;