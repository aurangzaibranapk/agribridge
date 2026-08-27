-- =====================================================================
-- AgriBridge — Migration 035: Credit Requests (Seed/Fertilizer/Pesticide)
-- =====================================================================
-- Farmer selects a product + quantity, system computes cost using MRP
-- (not the cash selling_price), a configurable credit margin is added,
-- admin reviews/adjusts, farmer accepts/rejects, and acceptance feeds
-- straight into the farmer_credit_ledger built in Migration 034.

alter table products add column if not exists mrp_price numeric(14,2);

-- Admin-configurable per-category limits (Seed/Fertilizer/Pesticide only
-- - Machinery has no limit and isn't MRP-based, so it's excluded here).
create table credit_category_limits (
  category credit_source_type primary key,
  max_amount numeric(14,2),
  notes text,
  updated_at timestamptz not null default now()
);
insert into credit_category_limits (category, max_amount) values
  ('seed', 20000),
  ('fertilizer', 30000),
  ('pesticide', 15000)
on conflict (category) do nothing;

create type credit_request_status as enum (
  'pending', 'admin_approved', 'farmer_accepted', 'farmer_rejected', 'admin_rejected'
);

create table credit_requests (
  id uuid primary key default uuid_generate_v4(),
  farmer_id uuid not null references farmers(id) on delete restrict,
  category credit_source_type not null,
  product_id uuid not null references products(id) on delete restrict,
  quantity numeric(14,2) not null check (quantity > 0),
  mrp_rate numeric(14,2) not null,
  base_amount numeric(14,2) not null,
  margin_percentage numeric(6,2) not null default 5,
  total_amount numeric(14,2) not null,
  admin_comments text,
  status credit_request_status not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  created_by uuid references auth.users(id)
);
create index idx_credit_requests_farmer on credit_requests(farmer_id, created_at);

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table credit_category_limits enable row level security;
alter table credit_requests enable row level security;

create policy staff_all_access on credit_category_limits for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true
    and role in ('super_admin','admin','manager','sales_staff'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true
    and role in ('super_admin','admin','manager','sales_staff'))
);
create policy public_read_credit_limits on credit_category_limits for select using (true);

create policy staff_all_access on credit_requests for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true
    and role in ('super_admin','admin','manager','sales_staff'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true
    and role in ('super_admin','admin','manager','sales_staff'))
);

create policy farmer_own_credit_requests on credit_requests for select using (
  exists (select 1 from farmers f where f.id = credit_requests.farmer_id and f.user_id = auth.uid())
);
create policy farmer_create_credit_requests on credit_requests for insert with check (
  exists (select 1 from farmers f where f.id = credit_requests.farmer_id and f.user_id = auth.uid())
);
create policy farmer_respond_credit_requests on credit_requests for update using (
  exists (select 1 from farmers f where f.id = credit_requests.farmer_id and f.user_id = auth.uid())
);