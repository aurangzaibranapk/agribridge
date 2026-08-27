-- =====================================================================
-- AgriBridge — Migration 031: Produce Marketplace (Sell Side, Phase 3)
-- =====================================================================
-- Mirrors the Bridge Order Engine (Migration 002b) but reversed: here
-- the FARMER is the seller and a BUYER (company/trader) is the
-- purchaser. AgriBridge still mediates - identity masking both ways,
-- staff verification, and commission-based payout to the farmer -
-- using the same platform_settings.bridge_commission_rate.

create table buyers (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null default fn_default_organization_id() references organizations(id),
  user_id uuid references auth.users(id) on delete set null,
  buyer_code text not null unique,
  business_name text not null,
  contact_person text,
  phone_number text not null,
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create type listing_status as enum ('active', 'sold_out', 'expired', 'cancelled');

create table produce_listings (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null default fn_default_organization_id() references organizations(id),
  farmer_id uuid not null references farmers(id) on delete restrict,
  crop_name text not null,
  quantity_available numeric(14,2) not null check (quantity_available > 0),
  unit text not null default 'kg',
  asking_price_per_unit numeric(10,2) not null,
  quality_grade text,
  harvest_id uuid references harvest_records(id) on delete set null,
  status listing_status not null default 'active',
  notes text,
  created_at timestamptz not null default now()
);
create index idx_produce_listings_status on produce_listings(status);
create index idx_produce_listings_crop on produce_listings(crop_name);

create type produce_order_status as enum (
  'placed', 'farmer_accepted', 'farmer_rejected', 'staff_verified', 'delivered', 'settled', 'cancelled'
);

create table produce_orders (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null default fn_default_organization_id() references organizations(id),
  order_number text not null unique,
  listing_id uuid not null references produce_listings(id) on delete restrict,
  farmer_id uuid not null references farmers(id) on delete restrict,
  buyer_id uuid not null references buyers(id) on delete restrict,
  quantity numeric(14,2) not null check (quantity > 0),
  unit_price numeric(10,2) not null,
  subtotal numeric(14,2) not null,
  commission_rate_applied numeric(6,4),
  commission_amount numeric(14,2) not null default 0,
  farmer_payout_amount numeric(14,2) not null default 0,
  status produce_order_status not null default 'placed',
  placed_at timestamptz not null default now(),
  verified_at timestamptz,
  delivered_at timestamptz,
  created_by uuid references auth.users(id)
);
create index idx_produce_orders_farmer on produce_orders(farmer_id);
create index idx_produce_orders_buyer on produce_orders(buyer_id);

create type farmer_payout_status as enum ('pending', 'paid');

create table farmer_produce_payouts (
  id uuid primary key default uuid_generate_v4(),
  farmer_id uuid not null references farmers(id) on delete restrict,
  order_id uuid not null references produce_orders(id) on delete restrict,
  amount numeric(14,2) not null,
  status farmer_payout_status not null default 'pending',
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

-- Auto-compute commission + farmer payout from subtotal, same pattern
-- as fn_apply_bridge_order_commission.
create or replace function fn_apply_produce_order_commission() returns trigger as $$
declare
  v_rate numeric(6,4);
begin
  new.subtotal := new.quantity * new.unit_price;
  select (value #>> '{}')::numeric into v_rate from platform_settings where key = 'bridge_commission_rate';
  new.commission_rate_applied := coalesce(v_rate, 0.01);
  new.commission_amount := round(new.subtotal * new.commission_rate_applied, 2);
  new.farmer_payout_amount := new.subtotal - new.commission_amount;
  return new;
end;
$$ language plpgsql;

create trigger trg_produce_order_commission
  before insert or update of quantity, unit_price on produce_orders
  for each row execute function fn_apply_produce_order_commission();

-- Release farmer payout the moment staff verifies (same "pay before
-- delivery" pattern as Bridge Orders).
create or replace function fn_create_farmer_payout_on_verification() returns trigger as $$
begin
  if new.status = 'staff_verified' and old.status is distinct from 'staff_verified' then
    new.verified_at := now();
    insert into farmer_produce_payouts (farmer_id, order_id, amount, status)
      values (new.farmer_id, new.id, new.farmer_payout_amount, 'pending');
  end if;
  if new.status = 'delivered' and old.status is distinct from 'delivered' then
    new.delivered_at := now();
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_produce_order_status_change
  before update of status on produce_orders
  for each row execute function fn_create_farmer_payout_on_verification();

-- Decrement listing quantity when an order is placed against it.
create or replace function fn_apply_listing_quantity() returns trigger as $$
begin
  update produce_listings
    set quantity_available = quantity_available - new.quantity,
        status = case when quantity_available - new.quantity <= 0 then 'sold_out'::listing_status else status end
    where id = new.listing_id;
  return new;
end;
$$ language plpgsql;

create trigger trg_produce_order_insert
  after insert on produce_orders
  for each row execute function fn_apply_listing_quantity();

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table buyers enable row level security;
alter table produce_listings enable row level security;
alter table produce_orders enable row level security;
alter table farmer_produce_payouts enable row level security;

do $$
declare t text;
begin
  for t in select unnest(array['buyers', 'produce_listings', 'produce_orders', 'farmer_produce_payouts'])
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

-- Buyer portal: a buyer can see/update their own profile.
create policy buyer_own_profile on buyers for select using (user_id = auth.uid());
create policy buyer_update_own_profile on buyers for update using (user_id = auth.uid());

-- Buyers can browse ALL active listings (public marketplace, but only
-- logged-in buyers - no farmer identity is exposed on the listing itself).
create policy buyer_view_active_listings on produce_listings for select using (
  status = 'active' or exists (select 1 from buyers b where b.user_id = auth.uid())
);

-- A buyer can place orders and see their own orders - never the farmer's identity.
create policy buyer_create_orders on produce_orders for insert with check (
  exists (select 1 from buyers b where b.id = produce_orders.buyer_id and b.user_id = auth.uid())
);
create policy buyer_own_orders on produce_orders for select using (
  exists (select 1 from buyers b where b.id = produce_orders.buyer_id and b.user_id = auth.uid())
);

-- Farmer portal: a farmer manages their own listings and sees orders
-- against them - never the buyer's identity.
create policy farmer_own_listings on produce_listings for all using (
  exists (select 1 from farmers f where f.id = produce_listings.farmer_id and f.user_id = auth.uid())
) with check (
  exists (select 1 from farmers f where f.id = produce_listings.farmer_id and f.user_id = auth.uid())
);
create policy farmer_own_produce_orders on produce_orders for select using (
  exists (select 1 from farmers f where f.id = produce_orders.farmer_id and f.user_id = auth.uid())
);
create policy farmer_update_own_produce_orders on produce_orders for update using (
  exists (select 1 from farmers f where f.id = produce_orders.farmer_id and f.user_id = auth.uid())
);
create policy farmer_own_produce_payouts on farmer_produce_payouts for select using (
  exists (select 1 from farmers f where f.id = farmer_produce_payouts.farmer_id and f.user_id = auth.uid())
);