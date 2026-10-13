-- Policies already exist on these public tables, but RLS was never enabled.
-- Enabling it makes the existing organization/staff policies enforceable.
alter table public.cycle_count_settings enable row level security;
alter table public.shop_product_cycles enable row level security;
