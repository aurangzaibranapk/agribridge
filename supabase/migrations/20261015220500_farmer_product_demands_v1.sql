create table if not exists public.farmer_product_demands (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id),
  branch_id uuid references public.branches(id),
  farmer_id uuid not null references public.farmers(id),
  product_id uuid references public.products(id),
  product_name text not null check (char_length(trim(product_name)) between 2 and 160),
  quantity numeric(14,3) not null check (quantity > 0),
  unit text not null default 'other',
  needed_by date,
  purpose text,
  notes text,
  status text not null default 'pending'
    check (status in ('pending','reviewing','approved','fulfilled','rejected','cancelled')),
  payment_required_at_registration boolean not null default false,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  staff_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists farmer_product_demands_farmer_idx
  on public.farmer_product_demands(farmer_id, created_at desc);
create index if not exists farmer_product_demands_product_idx
  on public.farmer_product_demands(product_id, status, created_at desc);
create index if not exists farmer_product_demands_status_idx
  on public.farmer_product_demands(status, created_at desc);

alter table public.farmer_product_demands enable row level security;

grant select, insert on public.farmer_product_demands to authenticated;

drop policy if exists "farmers can view own product demands" on public.farmer_product_demands;
create policy "farmers can view own product demands"
on public.farmer_product_demands
for select
to authenticated
using (
  exists (
    select 1 from public.farmers f
    where f.id = farmer_product_demands.farmer_id
      and f.user_id = (select auth.uid())
  )
);

drop policy if exists "farmers can create own product demands" on public.farmer_product_demands;
create policy "farmers can create own product demands"
on public.farmer_product_demands
for insert
to authenticated
with check (
  exists (
    select 1 from public.farmers f
    where f.id = farmer_product_demands.farmer_id
      and f.user_id = (select auth.uid())
  )
  and payment_required_at_registration = false
);

comment on table public.farmer_product_demands is
  'New demand-first procurement records. Keeps farmer product interest separate from legacy AI requests and orders.';
