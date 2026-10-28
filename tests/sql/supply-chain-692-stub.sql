-- Sirf test ke liye: 692 jin tables par khari hai un ka chhota dhancha.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
end $$;
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
create type public.purchase_status as enum ('draft','pending','received','cancelled');
create table public.branches (id uuid primary key, name text);
create table public.warehouses (id uuid primary key, branch_id uuid);
create table public.categories (id uuid primary key, name text);
create table public.suppliers (id uuid primary key, name text);
create table public.products (id uuid primary key, name text, category_id uuid, min_stock_threshold numeric, purchase_price numeric, is_deleted boolean default false);
create table public.inventory (id uuid primary key default gen_random_uuid(), product_id uuid, warehouse_id uuid, quantity_on_hand numeric);
create table public.purchases (id uuid primary key, purchase_number text, purchase_date date, received_at timestamptz, branch_id uuid, supplier_id uuid, status public.purchase_status, total_amount numeric);
create table public.purchase_items (id uuid primary key default gen_random_uuid(), purchase_id uuid, product_id uuid, quantity numeric, received_qty numeric, short_qty numeric default 0, damaged_qty numeric default 0);
create table public.sales (id uuid primary key, sale_date date, branch_id uuid, status text);
create table public.sale_items (id uuid primary key default gen_random_uuid(), sale_id uuid, product_id uuid, line_purchase_value numeric);
create table public.features (key text primary key, label text, label_en text, label_ur text, description text, description_en text, description_ur text, route text, icon text, is_sensitive boolean, is_active boolean);
create table public.dashboard_features (dashboard_key text, feature_key text, section text, section_order int, sort_order int, primary key (dashboard_key, feature_key));
