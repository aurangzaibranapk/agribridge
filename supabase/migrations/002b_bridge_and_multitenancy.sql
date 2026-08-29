-- =====================================================================
-- AgriBridge — Migration 002b: Multi-tenancy + Dealers, Investors,
-- Bridge Orders. Run 002a_new_roles.sql first, in its own query, then
-- run this file in a separate query.
-- =====================================================================

-- ---------------------------------------------------------------------
-- MULTI-TENANCY FOUNDATION
-- ---------------------------------------------------------------------
-- Named `organizations` (not `companies`) to avoid colliding with the
-- existing `companies` table, which means something different here —
-- a brand/supplier company (Engro, Bayer, ...) whose products we sell.
-- `organizations` is the tenant: the business running on this platform.
-- Al Rana Traders is seeded as the first (and today, only) tenant.
create table organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table branches (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  district text,
  tehsil text,
  address text,
  is_main_branch boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into organizations (name, slug) values ('Al Rana Traders', 'al-rana-traders');
insert into branches (organization_id, name, is_main_branch)
  select id, 'Main Branch', true from organizations where slug = 'al-rana-traders';

-- Convenience function: every default below reads from this instead of a
-- hardcoded UUID, so the seed data stays the single source of truth.
create or replace function fn_default_organization_id() returns uuid as $$
  select id from organizations where slug = 'al-rana-traders' limit 1;
$$ language sql stable;

create or replace function fn_default_branch_id() returns uuid as $$
  select id from branches where is_main_branch = true limit 1;
$$ language sql stable;

-- Scope master/header tables to a tenant + branch. Detail/child tables
-- (sale_items, purchase_items, ledger rows, stock_movements, ...) are
-- intentionally left alone — they inherit their scope through their
-- parent's foreign key, which is the standard multi-tenant pattern and
-- keeps this migration from touching every single table in the schema.
do $$
declare t text;
begin
  for t in select unnest(array['companies','suppliers','products','farmers','customers','sales','purchases'])
  loop
    execute format('alter table %I add column if not exists organization_id uuid references organizations(id)', t);
    execute format('alter table %I add column if not exists branch_id uuid references branches(id)', t);
    execute format('update %I set organization_id = fn_default_organization_id(), branch_id = fn_default_branch_id()', t);
    execute format('alter table %I alter column organization_id set not null', t);
    execute format('alter table %I alter column organization_id set default fn_default_organization_id()', t);
    execute format('alter table %I alter column branch_id set default fn_default_branch_id()', t);
    execute format('create index idx_%I_org on %I(organization_id)', t, t);
  end loop;
end $$;

alter table organizations enable row level security;
alter table branches enable row level security;
create policy staff_all_access on organizations for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin','manager','sales_staff'))
);
create policy staff_all_access on branches for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin','manager','sales_staff'))
);

-- ---------------------------------------------------------------------
-- PLATFORM SETTINGS — small key/value table so figures like the bridge
-- commission rate can change from a data update, not a code deploy.
-- ---------------------------------------------------------------------
create table platform_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
insert into platform_settings (key, value) values ('bridge_commission_rate', '0.01');

alter table platform_settings enable row level security;
create policy staff_all_access on platform_settings for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin','manager','sales_staff'))
);
create policy public_read_settings on platform_settings for select using (true);

-- ---------------------------------------------------------------------
-- DEALERS
-- ---------------------------------------------------------------------
create table dealers (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null default fn_default_organization_id() references organizations(id),
  user_id uuid references auth.users(id) on delete set null,
  dealer_code text not null unique,
  business_name text not null,
  contact_person text,
  phone_number text not null,
  cnic text,
  district text,
  tehsil text,
  address text,
  current_payable numeric(14,2) not null default 0, -- what AgriBridge owes this dealer, awaiting payout
  verification_status text not null default 'pending', -- pending / verified / rejected
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Which districts/tehsils a dealer can fulfil orders for — used by the
-- Phase 4 auto-routing engine to match a farmer's order to a dealer.
create table dealer_service_areas (
  id uuid primary key default uuid_generate_v4(),
  dealer_id uuid not null references dealers(id) on delete cascade,
  district text not null,
  tehsil text
);
create index idx_dealer_areas_district on dealer_service_areas(district, tehsil);

-- ---------------------------------------------------------------------
-- INVESTORS
-- ---------------------------------------------------------------------
create table investors (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null default fn_default_organization_id() references organizations(id),
  user_id uuid references auth.users(id) on delete set null,
  investor_code text not null unique,
  full_name text not null,
  cnic text,
  phone_number text,
  address text,
  total_invested numeric(14,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create type investment_deal_type as enum ('product_investment', 'corporation_deal', 'dairy_investment', 'franchise');
create type investment_deal_status as enum ('active', 'recovered', 'closed');

create table investment_deals (
  id uuid primary key default uuid_generate_v4(),
  investor_id uuid not null references investors(id) on delete restrict,
  deal_type investment_deal_type not null,
  linked_product_id uuid references products(id) on delete set null, -- used for product_investment
  amount_invested numeric(14,2) not null,
  profit_share_percentage numeric(5,2) not null,
  status investment_deal_status not null default 'active',
  started_at date not null default current_date,
  ended_at date,
  notes text,
  created_at timestamptz not null default now()
);

create type investment_ledger_entry_type as enum ('investment_in', 'profit_credit', 'recovery_out');

-- Append-only, mirrors the customer_ledger pattern already in the schema:
-- this table is the source of truth, investment_deals.amount_invested is
-- a convenience snapshot only.
create table investment_ledger (
  id uuid primary key default uuid_generate_v4(),
  deal_id uuid not null references investment_deals(id) on delete restrict,
  entry_type investment_ledger_entry_type not null,
  amount numeric(14,2) not null,
  balance_after numeric(14,2) not null,
  reference_type text,
  reference_id uuid,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index idx_investment_ledger_deal on investment_ledger(deal_id, created_at);

-- Investor-funded stock stays inside the normal inventory tables (per
-- Section 8's decision), tagged with which deal funded it. A batch with
-- this set is investor stock; sales against it flow through the same
-- sales/bridge_orders tables as everything else — investor reporting is
-- just a filtered view on the same data, not a parallel system.
alter table stock_batches add column if not exists investment_deal_id uuid references investment_deals(id);

-- Running balance for a deal, same mechanism as fn_apply_ledger_entry
-- for customers: investment_in and profit_credit increase the investor's
-- balance, recovery_out decreases it (money paid back to the investor).
create or replace function fn_apply_investment_ledger_entry() returns trigger as $$
declare
  v_prior numeric(14,2);
  v_delta numeric(14,2);
begin
  select coalesce(balance_after, 0) into v_prior from investment_ledger
    where deal_id = new.deal_id order by created_at desc limit 1;

  v_delta := case when new.entry_type = 'recovery_out' then -new.amount else new.amount end;
  new.balance_after := coalesce(v_prior, 0) + v_delta;

  if new.entry_type = 'investment_in' then
    update investors set total_invested = total_invested + new.amount
      where id = (select investor_id from investment_deals where id = new.deal_id);
  end if;

  return new;
end;
$$ language plpgsql;

create trigger trg_investment_ledger_apply
  before insert on investment_ledger
  for each row execute function fn_apply_investment_ledger_entry();

-- ---------------------------------------------------------------------
-- BRIDGE ORDERS — the core engine: Farmer places an order, AgriBridge
-- routes it to a Dealer, verifies it, pays the dealer, then delivers to
-- the farmer under the AgriBridge identity. Neither side ever sees the
-- other's identity directly (see the RLS policies below).
-- ---------------------------------------------------------------------
create type bridge_order_status as enum (
  'placed', 'assigned', 'dealer_accepted', 'dealer_rejected',
  'staff_verified', 'dealer_dispatched', 'delivered', 'settled', 'cancelled'
);

create table bridge_orders (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null default fn_default_organization_id() references organizations(id),
  order_number text not null unique,
  farmer_id uuid not null references farmers(id) on delete restrict,
  assigned_dealer_id uuid references dealers(id) on delete set null,
  status bridge_order_status not null default 'placed',
  district text not null,   -- used for routing; NOT the farmer's exact address
  tehsil text,
  subtotal numeric(14,2) not null default 0,
  commission_rate_applied numeric(6,4),   -- snapshot of platform_settings.bridge_commission_rate at order time
  commission_amount numeric(14,2) not null default 0,
  dealer_payout_amount numeric(14,2) not null default 0,
  delivery_dispute boolean not null default false, -- flips true if a delivered/dealer_dispatched order is disputed after payout
  placed_at timestamptz not null default now(),
  verified_at timestamptz,
  delivered_at timestamptz,
  created_by uuid references auth.users(id)
);
create index idx_bridge_orders_dealer on bridge_orders(assigned_dealer_id);
create index idx_bridge_orders_farmer on bridge_orders(farmer_id);
create index idx_bridge_orders_routing on bridge_orders(district, tehsil, status);

create table bridge_order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references bridge_orders(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  quantity numeric(14,3) not null,
  unit_price numeric(14,2) not null,
  line_total numeric(14,2) not null
);

create type dealer_payout_status as enum ('pending', 'paid', 'clawed_back');

create table dealer_payouts (
  id uuid primary key default uuid_generate_v4(),
  dealer_id uuid not null references dealers(id) on delete restrict,
  order_id uuid not null references bridge_orders(id) on delete restrict,
  amount numeric(14,2) not null,
  status dealer_payout_status not null default 'pending',
  paid_at timestamptz,
  clawed_back_at timestamptz,
  clawback_reason text,
  created_at timestamptz not null default now()
);
create index idx_dealer_payouts_dealer on dealer_payouts(dealer_id, status);

-- Auto-compute commission + dealer payout amount from subtotal whenever an
-- order's subtotal is set, using the live platform_settings rate — same
-- role as the existing sales-profit auto-calculation, just for orders.
create or replace function fn_apply_bridge_order_commission() returns trigger as $$
declare
  v_rate numeric(6,4);
begin
  select (value #>> '{}')::numeric into v_rate from platform_settings where key = 'bridge_commission_rate';
  new.commission_rate_applied := coalesce(v_rate, 0.01);
  new.commission_amount := round(new.subtotal * new.commission_rate_applied, 2);
  new.dealer_payout_amount := new.subtotal - new.commission_amount;
  return new;
end;
$$ language plpgsql;

create trigger trg_bridge_order_commission
  before insert or update of subtotal on bridge_orders
  for each row execute function fn_apply_bridge_order_commission();

-- Per Section 8's decision: payout is released the moment staff verifies
-- the order — before delivery, not after — so this creates the payout
-- row automatically the instant status flips to staff_verified.
create or replace function fn_create_payout_on_verification() returns trigger as $$
begin
  if new.status = 'staff_verified' and old.status is distinct from 'staff_verified' then
    new.verified_at := now();
    insert into dealer_payouts (dealer_id, order_id, amount, status)
      values (new.assigned_dealer_id, new.id, new.dealer_payout_amount, 'pending');
  end if;
  if new.status = 'delivered' and old.status is distinct from 'delivered' then
    new.delivered_at := now();
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_bridge_order_status_change
  before update of status on bridge_orders
  for each row execute function fn_create_payout_on_verification();

-- =====================================================================
-- ROW LEVEL SECURITY for the new tables
-- =====================================================================
alter table dealers enable row level security;
alter table dealer_service_areas enable row level security;
alter table investors enable row level security;
alter table investment_deals enable row level security;
alter table investment_ledger enable row level security;
alter table bridge_orders enable row level security;
alter table bridge_order_items enable row level security;
alter table dealer_payouts enable row level security;

do $$
declare t text;
begin
  for t in select unnest(array[
    'dealers','dealer_service_areas','investors','investment_deals',
    'investment_ledger','bridge_orders','bridge_order_items','dealer_payouts'
  ])
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

-- Dealer portal: a dealer can see/update their own dealer profile.
create policy dealer_own_profile on dealers for select using (user_id = auth.uid());
create policy dealer_update_own_profile on dealers for update using (user_id = auth.uid());

create policy dealer_own_service_areas on dealer_service_areas for all using (
  exists (select 1 from dealers d where d.id = dealer_service_areas.dealer_id and d.user_id = auth.uid())
) with check (
  exists (select 1 from dealers d where d.id = dealer_service_areas.dealer_id and d.user_id = auth.uid())
);

-- THE MASKING: a dealer can see orders assigned to them, and can update
-- status while it's in their hands — but bridge_orders never stores the
-- farmer's name/phone/address (only district/tehsil for routing), and
-- farmers' RLS policy (in 001_schema.sql) only lets a farmer see their
-- OWN row. A dealer role has no policy granting them access to `farmers`
-- at all, so joining bridge_orders.farmer_id -> farmers from a dealer
-- session returns nothing. The masking is structural, not just hidden
-- columns — there is no query a dealer can run that resolves a farmer's
-- identity, by design.
create policy dealer_own_assigned_orders on bridge_orders for select using (
  exists (select 1 from dealers d where d.id = bridge_orders.assigned_dealer_id and d.user_id = auth.uid())
);
create policy dealer_update_own_assigned_orders on bridge_orders for update using (
  exists (select 1 from dealers d where d.id = bridge_orders.assigned_dealer_id and d.user_id = auth.uid())
);
create policy dealer_own_order_items on bridge_order_items for select using (
  exists (select 1 from bridge_orders o join dealers d on d.id = o.assigned_dealer_id
          where o.id = bridge_order_items.order_id and d.user_id = auth.uid())
);
create policy dealer_own_payouts on dealer_payouts for select using (
  exists (select 1 from dealers d where d.id = dealer_payouts.dealer_id and d.user_id = auth.uid())
);

-- Farmer portal: a farmer can place and see their own orders. Same
-- masking logic in reverse — bridge_orders.assigned_dealer_id is a raw
-- UUID with no name attached, and a farmer has no policy granting them
-- access to the `dealers` table, so the dealer's identity never resolves.
create policy farmer_own_bridge_orders on bridge_orders for select using (
  exists (select 1 from farmers f where f.id = bridge_orders.farmer_id and f.user_id = auth.uid())
);
create policy farmer_create_bridge_orders on bridge_orders for insert with check (
  exists (select 1 from farmers f where f.id = bridge_orders.farmer_id and f.user_id = auth.uid())
);
create policy farmer_own_order_items on bridge_order_items for select using (
  exists (select 1 from bridge_orders o join farmers f on f.id = o.farmer_id
          where o.id = bridge_order_items.order_id and f.user_id = auth.uid())
);

-- Investor portal: an investor sees their own profile, deals, and ledger.
create policy investor_own_profile on investors for select using (user_id = auth.uid());
create policy investor_own_deals on investment_deals for select using (
  exists (select 1 from investors i where i.id = investment_deals.investor_id and i.user_id = auth.uid())
);
create policy investor_own_ledger on investment_ledger for select using (
  exists (select 1 from investors i join investment_deals d on d.investor_id = i.id
          where d.id = investment_ledger.deal_id and i.user_id = auth.uid())
);
