-- Test-only stubs (PGlite) of live objects that 583-588 depend on. Column
-- names match live (checked with SELECT on 19 Oct 2026).
create role anon; create role authenticated; create role service_role;
create schema auth;
grant usage on schema auth to authenticated, anon;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
grant execute on function auth.uid() to authenticated, anon;
grant usage on schema public to authenticated, anon;
create type public.user_role as enum ('owner','super_admin','admin','manager','sales_staff','farmer','customer','dealer','finance','warehouse');
create type public.wallet_owner_type as enum ('customer','farmer');
create table public.organizations (id uuid primary key default gen_random_uuid(), name text);
create table public.branches (id uuid primary key default gen_random_uuid(), name text, organization_id uuid);
create table public.shops (id uuid primary key default gen_random_uuid(), name text);
create table public.profiles (id uuid primary key, full_name text, phone_number text, role public.user_role, is_active boolean default true,
  organization_id uuid references public.organizations(id), branch_id uuid references public.branches(id), shop_id uuid references public.shops(id));
create table public.farmers (id uuid primary key default gen_random_uuid(), user_id uuid, organization_id uuid, branch_id uuid, full_name text,
  phone_number text, is_deleted boolean default false, is_active boolean default true, created_at timestamptz default now());
create table public.customers (id uuid primary key default gen_random_uuid(), user_id uuid, farmer_id uuid, name text);
create table public.categories (id uuid primary key default gen_random_uuid(), name text);
create table public.brands (id uuid primary key default gen_random_uuid(), name text);
create table public.products (id uuid primary key default gen_random_uuid(), name text, pack_size text, unit text, selling_price numeric, purchase_price numeric,
  image_url text, expiry_date date, show_expiry_to_customer boolean default true, category_id uuid, brand_id uuid, organization_id uuid,
  is_available boolean default true, is_deleted boolean default false, is_verified boolean default true);
create table public.warehouses (id uuid primary key default gen_random_uuid(), branch_id uuid, shop_id uuid);
create table public.inventory (id uuid primary key default gen_random_uuid(), product_id uuid, warehouse_id uuid, shop_id uuid, quantity_on_hand numeric);
create table public.agri_orders (id uuid primary key default gen_random_uuid(), order_number text unique, order_type text, order_from text,
  order_to_type text check (order_to_type in ('Kisan Dukan','Agri Dealer','Kisan Partner','Branch','Warehouse','Farmer')),
  order_to_branch_id uuid, partner_name text, mobile_number text, subtotal numeric, grand_total numeric,
  payment_terms text check (payment_terms in ('Cash','Bank Transfer','Credit','Advance Payment','Partial Payment')),
  status text check (status in ('draft','submitted','sales_verified','finance_verified','approved','processing','dispatched','in_transit','delivered','grn_submitted','completed','cancelled','rejected')),
  requested_by uuid references public.profiles(id), notes text, customer_id uuid,
  party_link_state text not null default 'unlinked_unknown' check (party_link_state in ('linked','unlinked_unknown','not_applicable')),
  created_at timestamptz default now());
create table public.agri_order_items (id uuid primary key default gen_random_uuid(), order_id uuid references public.agri_orders(id) on delete cascade,
  product_id uuid, product_name text, pack_size text, order_qty numeric, unit_price numeric, net_price numeric, line_total numeric, created_at timestamptz default now());
create table public.agri_order_timeline (id uuid primary key default gen_random_uuid(), order_id uuid references public.agri_orders(id) on delete cascade,
  status text, note text, created_by uuid, created_at timestamptz default now());
alter table public.agri_orders enable row level security;
alter table public.agri_order_items enable row level security;
alter table public.agri_order_timeline enable row level security;
grant select, insert, update on public.agri_orders, public.agri_order_items, public.agri_order_timeline to authenticated;
create table public.notifications (id uuid primary key default gen_random_uuid(), recipient_user_id uuid, is_read boolean default false);
create table public.v_user_feature_access (profile_id uuid, feature_key text);
create table public.dealers (id uuid primary key default gen_random_uuid(), user_id uuid, current_payable numeric, is_active boolean default true);
create table public.wallets (id uuid primary key default gen_random_uuid(), owner_type public.wallet_owner_type, owner_id uuid, balance numeric);
create table public.milk_entries (id uuid primary key default gen_random_uuid(), farmer_id uuid, entry_date date, quantity_liters numeric,
  total_amount numeric, fat_percentage numeric, snf_percentage numeric, status text);
create table public.grain_farmer_balances (farmer_id uuid, total_supplied numeric, total_paid numeric, balance_due numeric);
create table public.grain_procurement_entries (id uuid primary key default gen_random_uuid(), farmer_id uuid, entry_date date, grain_type text,
  weight_kg numeric, gross_weight_kg numeric, cut_kg numeric, bag_count numeric, rate_per_kg numeric, total_amount numeric,
  reclassified_as_sale_id uuid, created_at timestamptz default now());
create table public.grain_procurement_payments (id uuid primary key default gen_random_uuid(), farmer_id uuid, payment_date date, amount numeric,
  payment_method text, created_at timestamptz default now());
create table public.machinery_bookings (id uuid primary key default gen_random_uuid(), booking_number text, farmer_id uuid, booking_date date,
  preferred_date date, expected_harvest_date date, status text, machine_type_requested text, verified_area numeric, harvest_area_acres numeric,
  acres numeric, total_amount numeric, amount_received_from_farmer numeric, village text, vendor_payable numeric, cancelled_at timestamptz,
  created_at timestamptz default now());
create table public.machinery_payments (id uuid primary key default gen_random_uuid(), booking_id uuid, payment_date date, kind text, amount numeric,
  method text, verification_status text, finance_account_id uuid, created_at timestamptz default now());
create table public.machinery_fuel_logs (id uuid primary key default gen_random_uuid(), booking_id uuid, log_date date, paid_by text, litres numeric,
  amount numeric, verification_status text, cancelled_at timestamptz, created_at timestamptz default now());
-- 580 (live par lag chuka)
create table public.portal_account_delete_requests (
  id uuid primary key default gen_random_uuid(), target_user_id uuid not null, target_label text,
  reason text not null check (length(btrim(reason)) > 0), requested_by uuid not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  decided_by uuid, decided_at timestamptz, created_at timestamptz not null default now(),
  constraint portal_delete_maker_checker check (decided_by is null or decided_by <> requested_by));
create unique index portal_delete_one_pending on public.portal_account_delete_requests (target_user_id) where status = 'pending';
alter table public.portal_account_delete_requests enable row level security;
-- 565 (live par lag chuka) -- chhota stub: owed = khata_test.owed
create table public.khata_test (user_id uuid primary key, owed numeric);
create function public.fn_my_khata_scope(out farmer_id uuid, out customer_ids uuid[]) language plpgsql stable security definer set search_path = public as $$
declare v_f uuid; v_c uuid[];
begin
  select f.id into v_f from farmers f where f.user_id = auth.uid() order by f.created_at limit 1;
  select coalesce(array_agg(c.id), array[]::uuid[]) into v_c from customers c where c.user_id = auth.uid() or (v_f is not null and c.farmer_id = v_f);
  farmer_id := v_f; customer_ids := v_c;
end $$;
create function public.fn_my_khata_summary(p_as_of date default null) returns jsonb language sql stable security definer set search_path = public as $$
  select case when k.user_id is null then null else jsonb_build_object('owed', k.owed, 'by_category', '[]'::jsonb) end
    from (select auth.uid() u) x left join khata_test k on k.user_id = x.u $$;
