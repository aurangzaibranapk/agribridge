-- Extra test-only stubs for 574-578 (on top of portal-dairy-stubs.sql).
alter table public.milk_entries add column total_amount numeric;
alter table public.farmers add column farmer_code text, add column village text;
alter table public.profiles add column is_active_dummy int;
create schema storage;
grant usage on schema storage to authenticated, anon;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
alter table storage.objects enable row level security;
grant select, insert, update on storage.objects to authenticated;
create table public.customers (id uuid primary key default gen_random_uuid(), farmer_id uuid, name text);
create table public.shops (id uuid primary key default gen_random_uuid(), name text, business_type text);
create table public.categories (id uuid primary key default gen_random_uuid(), name text);
create table public.products (id uuid primary key default gen_random_uuid(), name text, category_id uuid);
create table public.pos_sales (id uuid primary key default gen_random_uuid(), shop_id uuid, customer_id uuid, created_at timestamptz default now());
create table public.pos_sale_items (id uuid primary key default gen_random_uuid(), sale_id uuid, product_id uuid, quantity numeric, unit_price numeric, subtotal numeric);
create table public.milk_payments (id uuid primary key default gen_random_uuid(), farmer_id uuid, amount numeric, payment_date date);
