-- Safe manual costing average correction.
-- Existing purchase data and the original costing view remain unchanged.
create table if not exists public.product_costing_overrides (
  product_id uuid primary key references public.products(id) on delete cascade,
  override_average numeric(14,2) not null check (override_average >= 0),
  reason text not null check (length(btrim(reason)) >= 5),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

alter table public.product_costing_overrides enable row level security;

create or replace view public.v_product_costing_with_override as
  select
    c.product_id,
    c.name,
    c.pack_size,
    c.reference_rate,
    c.selling_price,
    c.total_qty,
    c.total_cost,
    coalesce(o.override_average, c.weighted_avg) as weighted_avg,
    c.weighted_avg as calculated_avg,
    c.purchase_count,
    c.last_purchase_date,
    o.override_average,
    o.reason as override_reason,
    o.updated_at as override_updated_at
  from public.v_product_costing c
  left join public.product_costing_overrides o on o.product_id = c.product_id;

comment on table public.product_costing_overrides is
  'Manual costing average corrections; calculated purchase average and old entries remain unchanged.';
