-- =====================================================================
-- AgriBridge — Migration 007: AI Product Recommendations (Phase 7+)
-- =====================================================================
-- The "AI Marketplace" feature, scoped as agreed: rule-based product
-- recommendations across the site (crop-based, frequently-bought-
-- together, and trending), not a multi-vendor marketplace. This table
-- is the staff-managed knowledge base for the crop-based signal — e.g.
-- "Cotton" -> recommend this pesticide, with a reason shown to the
-- farmer. The other two signals (co-purchase, trending) are computed
-- live from existing sales/order data, no new tables needed for those.

create table crop_product_recommendations (
  id uuid primary key default uuid_generate_v4(),
  crop_name text not null,
  product_id uuid not null references products(id) on delete cascade,
  reason text,
  priority int not null default 0,
  created_at timestamptz not null default now(),
  unique (crop_name, product_id)
);
create index idx_crop_recommendations_crop on crop_product_recommendations(crop_name);

alter table crop_product_recommendations enable row level security;

create policy staff_all_access on crop_product_recommendations for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin','manager','sales_staff'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin','manager','sales_staff'))
);

-- Read-only for everyone (including anonymous) — same precedent as
-- categories/brands/products in schema.sql. This is just a recommendation
-- mapping, nothing sensitive, and the recommendation engine needs to read
-- it from farmer-facing pages.
create policy public_read_crop_recommendations on crop_product_recommendations for select using (true);
