-- Minimal tables for 629/630. Not the live schema.
create role anon;
create role authenticated;
create role service_role;
create type purchase_status as enum ('draft', 'pending', 'received', 'cancelled');
create type stock_movement_type as enum ('purchase_in', 'sale_out', 'adjustment_increase', 'adjustment_decrease');

create table purchases (
  id uuid primary key default gen_random_uuid(),
  purchase_number text not null,
  supplier_id uuid not null,
  branch_id uuid,
  purchase_date date,
  supplier_bill_no text,
  warehouse_id uuid,
  status purchase_status not null default 'pending',
  review_status text not null default 'submitted',
  total_amount numeric not null default 0,
  invoice_total numeric,
  discount_amount numeric,
  tax_amount numeric,
  tax_label text,
  payment_terms text not null default 'credit',
  credit_days integer,
  due_date date,
  notes text,
  payment_proof_url text,
  created_by uuid,
  held_payment jsonb,
  grn_photo_url text,
  grn_note text,
  received_at timestamptz,
  received_by uuid,
  created_at timestamptz not null default now()
);

create table purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references purchases(id),
  product_id uuid not null,
  batch_id uuid,
  quantity numeric not null,
  unit_cost numeric not null,
  line_total numeric not null,
  received_qty numeric,
  damaged_qty numeric not null default 0,
  short_qty numeric not null default 0,
  grn_note text
);

create table stock_batches (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null,
  warehouse_id uuid,
  batch_number text not null,
  manufacture_date date,
  expiry_date date,
  initial_quantity numeric not null,
  remaining_quantity numeric,
  unit_cost numeric,
  unique (product_id, batch_number)
);

create table inventory (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null,
  warehouse_id uuid not null,
  batch_id uuid,
  quantity_on_hand numeric not null default 0
);

create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  inventory_id uuid not null references inventory(id),
  movement_type stock_movement_type not null,
  quantity numeric not null,
  balance_after numeric,
  reference_type text,
  reference_id uuid,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table agri_grns (
  id uuid primary key default gen_random_uuid(),
  grn_number text not null unique,
  order_id uuid not null,
  dispatch_id uuid,
  receiving_date date not null,
  ordered_value numeric not null default 0,
  received_value numeric not null default 0,
  shortage_amount numeric not null default 0,
  damage_amount numeric not null default 0,
  discount_adjustment numeric not null default 0,
  additional_charges numeric,
  payable_amount numeric not null default 0,
  notes text,
  discrepancy_status text,
  created_by uuid
);

create table agri_grn_items (
  id uuid primary key default gen_random_uuid(),
  grn_id uuid not null references agri_grns(id),
  order_item_id uuid,
  product_name text not null,
  batch_no text,
  expiry_date date,
  manufacturing_date date,
  unit_price numeric not null default 0,
  ordered_qty numeric not null,
  received_qty numeric not null,
  damaged_qty numeric not null default 0,
  difference_qty numeric not null default 0,
  difference_type text not null default 'None',
  seal_condition text,
  packaging_condition text,
  quality_status text not null default 'Accepted',
  rejection_reason text
);

create table supplier_bill_reads (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid,
  bill_number text,
  purchase_id uuid
);
