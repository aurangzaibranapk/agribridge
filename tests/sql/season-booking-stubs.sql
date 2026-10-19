-- PGlite stubs: sirf wo tables jo 561-563 ko chahiye (live schema ka chhota roop).
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, email text);
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
do $$ begin create role anon; exception when duplicate_object then null; end $$;
do $$ begin create role service_role; exception when duplicate_object then null; end $$;
create table if not exists organizations (id uuid primary key default gen_random_uuid());
create table if not exists profiles (id uuid primary key, full_name text, role text, is_active boolean default true, organization_id uuid);
create table if not exists categories (id uuid primary key default gen_random_uuid(), name text not null, parent_category_id uuid references categories(id), category_kind text);
create table if not exists products (id uuid primary key default gen_random_uuid(), name text not null, pack_size text, unit text, category_id uuid references categories(id), is_deleted boolean default false);
create table if not exists farmers (id uuid primary key default gen_random_uuid(), user_id uuid, full_name text, organization_id uuid, branch_id uuid, phone_key text, is_deleted boolean default false);
create table if not exists farms (id uuid primary key default gen_random_uuid(), farmer_id uuid references farmers(id), name text, area_acres numeric, village text, latitude numeric, longitude numeric);
create table if not exists booking_campaigns (id uuid primary key default gen_random_uuid(), name text, crop text not null, deadline date, is_active boolean default true);
create table if not exists campaign_bookings (id uuid primary key default gen_random_uuid(), campaign_id uuid references booking_campaigns(id), farmer_id uuid references farmers(id), organization_id uuid, acres numeric, notes text, status text default 'submitted', unique (campaign_id, farmer_id));
create table if not exists farmer_product_demands (id uuid primary key default gen_random_uuid(), farmer_id uuid, product_id uuid, product_name text, quantity numeric, unit text, status text default 'pending', category text, campaign_id uuid, campaign_booking_id uuid);
