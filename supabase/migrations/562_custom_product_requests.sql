-- 562: Kisan ki "apni product" (catalog mein nahi). Admin review kar ke
-- maujooda product se jor sakta hai. SIRF ADDITIVE.

create table if not exists public.custom_product_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id),
  farmer_id uuid not null references public.farmers(id),
  campaign_id uuid references public.booking_campaigns(id),
  campaign_booking_id uuid references public.campaign_bookings(id) on delete set null,
  line_kind text not null check (line_kind in ('seed','fertilizer','pesticide')),
  name text not null check (char_length(trim(name)) between 2 and 120),
  quantity numeric(14,3) check (quantity is null or quantity > 0),
  unit text,
  status text not null default 'pending' check (status in ('pending','mapped','rejected')),
  mapped_product_id uuid references public.products(id),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  -- maker-checker: jis ne banayi wo khud review nahi karega
  constraint custom_product_requests_no_self_review check (reviewed_by is null or created_by is null or reviewed_by <> created_by)
);
create index if not exists custom_product_requests_pending_idx
  on public.custom_product_requests(created_at desc) where status = 'pending';

alter table public.custom_product_requests enable row level security;
grant select on public.custom_product_requests to authenticated;
drop policy if exists "farmer views own custom products" on public.custom_product_requests;
create policy "farmer views own custom products" on public.custom_product_requests
  for select to authenticated using (
    exists (select 1 from public.farmers f where f.id = custom_product_requests.farmer_id and f.user_id = (select auth.uid()))
  );
drop policy if exists "staff views custom products" on public.custom_product_requests;
create policy "staff views custom products" on public.custom_product_requests
  for select to authenticated using (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_active
            and p.role::text in ('super_admin','owner','admin','manager','sales_staff'))
  );

alter table public.farmer_product_demands
  add column if not exists custom_request_id uuid references public.custom_product_requests(id);
