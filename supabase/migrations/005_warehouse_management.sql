-- =====================================================================
-- AgriBridge — Migration 005: Warehouse Management (Phase 7)
-- =====================================================================
-- Retrofits location tracking onto the existing `inventory` table rather
-- than replacing it: inventory today is keyed by (product, batch) with
-- no concept of WHERE that stock physically sits. This adds warehouses
-- and bins, and extends inventory's uniqueness to (product, batch,
-- warehouse) so the same product/batch can exist in more than one
-- warehouse. stock_movement_type already has transfer_in/transfer_out
-- values (see schema.sql) — this migration is the first thing that
-- actually uses them.

create table warehouses (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null default fn_default_organization_id() references organizations(id),
  branch_id uuid not null references branches(id),
  name text not null,
  code text not null,
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (branch_id, code)
);

create table warehouse_bins (
  id uuid primary key default uuid_generate_v4(),
  warehouse_id uuid not null references warehouses(id) on delete cascade,
  bin_code text not null,
  description text,
  unique (warehouse_id, bin_code)
);

-- Seed a "Main Warehouse" for every existing branch (today, just the one
-- from Migration 002b) so existing inventory has somewhere to belong.
insert into warehouses (branch_id, name, code)
  select id, 'Main Warehouse', 'MAIN' from branches
  on conflict (branch_id, code) do nothing;

alter table inventory add column warehouse_id uuid references warehouses(id);
alter table inventory add column bin_id uuid references warehouse_bins(id);

-- Backfill: every existing inventory row belongs to its product's
-- branch's Main Warehouse (there's only one branch today, so this is
-- unambiguous — if a second branch/warehouse existed at migration time,
-- this would need a manual reassignment pass instead).
update inventory i
  set warehouse_id = w.id
  from products p
  join warehouses w on w.branch_id = p.branch_id and w.code = 'MAIN'
  where i.product_id = p.id and i.warehouse_id is null;

alter table inventory alter column warehouse_id set not null;

-- The old (product_id, batch_id) constraint assumed one location per
-- batch; now the same batch can sit in more than one warehouse.
alter table inventory drop constraint inventory_product_id_batch_id_key;
alter table inventory add constraint inventory_product_batch_warehouse_key unique (product_id, batch_id, warehouse_id);

-- ---------------------------------------------------------------------
-- STOCK TRANSFERS between warehouses
-- ---------------------------------------------------------------------
create type stock_transfer_status as enum ('pending', 'in_transit', 'completed', 'cancelled');

create table stock_transfers (
  id uuid primary key default uuid_generate_v4(),
  transfer_number text not null unique,
  from_warehouse_id uuid not null references warehouses(id) on delete restrict,
  to_warehouse_id uuid not null references warehouses(id) on delete restrict,
  product_id uuid not null references products(id) on delete restrict,
  batch_id uuid references stock_batches(id),
  quantity numeric(14,3) not null check (quantity > 0),
  status stock_transfer_status not null default 'pending',
  notes text,
  requested_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check (from_warehouse_id <> to_warehouse_id)
);

-- Moving stock on transfer completion: decrement the source inventory
-- row, upsert (create-or-increment) the destination row, and write both
-- sides of the movement to stock_movements — same append-only-ledger
-- pattern as every other stock change in this schema, just routed
-- through two inventory rows instead of one.
create or replace function fn_apply_stock_transfer() returns trigger as $$
declare
  v_source_inventory_id uuid;
  v_dest_inventory_id uuid;
  v_source_balance numeric(14,3);
  v_dest_balance numeric(14,3);
begin
  if new.status <> 'completed' or old.status = 'completed' then
    return new;
  end if;

  select id, quantity_on_hand into v_source_inventory_id, v_source_balance
    from inventory where product_id = new.product_id and batch_id is not distinct from new.batch_id and warehouse_id = new.from_warehouse_id
    for update;

  if v_source_inventory_id is null or v_source_balance < new.quantity then
    raise exception 'Insufficient stock at source warehouse for this transfer';
  end if;

  update inventory set quantity_on_hand = quantity_on_hand - new.quantity, updated_at = now()
    where id = v_source_inventory_id;

  insert into stock_movements (inventory_id, movement_type, quantity, balance_after, reference_type, reference_id, created_by)
    values (v_source_inventory_id, 'transfer_out', new.quantity, v_source_balance - new.quantity, 'stock_transfer', new.id, new.requested_by);

  select id into v_dest_inventory_id from inventory
    where product_id = new.product_id and batch_id is not distinct from new.batch_id and warehouse_id = new.to_warehouse_id
    for update;

  if v_dest_inventory_id is null then
    insert into inventory (product_id, batch_id, warehouse_id, quantity_on_hand)
      values (new.product_id, new.batch_id, new.to_warehouse_id, new.quantity)
      returning id, quantity_on_hand into v_dest_inventory_id, v_dest_balance;
  else
    update inventory set quantity_on_hand = quantity_on_hand + new.quantity, updated_at = now()
      where id = v_dest_inventory_id
      returning quantity_on_hand into v_dest_balance;
  end if;

  insert into stock_movements (inventory_id, movement_type, quantity, balance_after, reference_type, reference_id, created_by)
    values (v_dest_inventory_id, 'transfer_in', new.quantity, v_dest_balance, 'stock_transfer', new.id, new.requested_by);

  new.completed_at := now();
  return new;
end;
$$ language plpgsql;

create trigger trg_stock_transfer_apply
  before update of status on stock_transfers
  for each row execute function fn_apply_stock_transfer();

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table warehouses enable row level security;
alter table warehouse_bins enable row level security;
alter table stock_transfers enable row level security;

do $$
declare t text;
begin
  for t in select unnest(array['warehouses', 'warehouse_bins', 'stock_transfers'])
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
