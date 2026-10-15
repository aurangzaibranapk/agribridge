-- Demand-first pipeline + kharid planning. NOT APPLIED anywhere.
-- Sirf naye nullable columns aur ek nayi table. Purana `status` aur
-- maker-checker waisa hi; koi data badla ya mitaya nahi jata (no backfill:
-- khali pipeline_status ko app purane status se map karti hai:
--   pending->new, reviewing/approved->interest_confirmed,
--   ordered/fulfilled->order_converted, rejected/cancelled->cancelled).
-- Kuch bhi purchase, stock ya ledger post nahi karta.

alter table public.farmer_product_demands
  add column if not exists category text
    check (category is null or category in ('wanda','khal','chowker','moomni','seed','pesticide','fertilizer','micronutrient')),
  add column if not exists area text check (area is null or char_length(area) <= 120),
  add column if not exists pipeline_status text
    check (pipeline_status is null or pipeline_status in
      ('new','interest_confirmed','supplier_asked','procurement_planned','stock_arrived','notified','order_converted','cancelled')),
  add column if not exists pipeline_updated_at timestamptz,
  add column if not exists pipeline_updated_by uuid references public.profiles(id),
  add column if not exists procurement_plan_id uuid,
  add column if not exists notified_at timestamptz,
  add column if not exists notified_by uuid references public.profiles(id),
  add column if not exists notify_message text,
  add column if not exists source text check (source is null or source in ('form','munshi'));

create index if not exists farmer_product_demands_pipeline_idx
  on public.farmer_product_demands (pipeline_status, created_at desc);
create index if not exists farmer_product_demands_category_idx
  on public.farmer_product_demands (category);

-- Admin ki manzoor-shuda kharid planning. Sirf planning; PO alag se banta hai.
create table if not exists public.demand_procurement_plans (
  id uuid primary key default gen_random_uuid(),
  product_key text not null,
  product_id uuid references public.products(id),
  product_name text not null,
  unit text not null,
  confirmed_quantity numeric(14,3) not null check (confirmed_quantity >= 0),
  buffer_quantity numeric(14,3) not null default 0 check (buffer_quantity >= 0),
  planned_quantity numeric(14,3) not null check (planned_quantity >= 0),
  demand_count int not null default 0,
  farmer_count int not null default 0,
  status text not null default 'planned' check (status in ('planned','stock_arrived','closed','cancelled')),
  note text,
  approved_by uuid not null references public.profiles(id),
  approved_at timestamptz not null default now(),
  stock_arrived_at timestamptz,
  stock_arrived_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists demand_procurement_plans_key_idx
  on public.demand_procurement_plans (product_key, approved_at desc);

alter table public.farmer_product_demands
  drop constraint if exists farmer_product_demands_plan_fk;
alter table public.farmer_product_demands
  add constraint farmer_product_demands_plan_fk
  foreign key (procurement_plan_id) references public.demand_procurement_plans(id);

-- Staff server actions service role se likhte hain; kisan ko ye table nahi chahiye.
alter table public.demand_procurement_plans enable row level security;
