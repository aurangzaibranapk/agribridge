-- 535: Gandum Season 2026 (Kisan Eco Mahabali) -- booking campaign,
-- farmer self-signup approval, CNIC match, milk-supplier flag.
-- SIRF ADDITIVE: naye tables/columns/views/functions. Koi purana column
-- badla ya hataya nahi jata, koi ledger/stock posting nahi.

-- 1) Self-signup approval. NULL = purana / staff ka banaya kisan (approved samjho).
alter table public.farmers
  add column if not exists signup_approval_status text
    check (signup_approval_status in ('pending','approved','rejected')),
  add column if not exists signup_reviewed_by uuid references public.profiles(id),
  add column if not exists signup_reviewed_at timestamptz;

create index if not exists farmers_signup_pending_idx
  on public.farmers(created_at desc) where signup_approval_status = 'pending';

-- 2) CNIC se kisan dhoondna -- sirf hindse milao (35202-1234567-1 == 3520212345671).
create or replace function public.fn_find_farmer_by_cnic(p_cnic text)
returns table (id uuid, farmer_code text, full_name text, phone_number text)
language sql stable security definer set search_path = public as $$
  select f.id, f.farmer_code, f.full_name, f.phone_number
  from public.farmers f
  where coalesce(f.is_deleted, false) = false
    and length(regexp_replace(coalesce(p_cnic, ''), '\D', '', 'g')) = 13
    and regexp_replace(coalesce(f.cnic, ''), '\D', '', 'g') = regexp_replace(p_cnic, '\D', '', 'g')
  limit 1;
$$;
revoke all on function public.fn_find_farmer_by_cnic(text) from public, anon, authenticated;
grant execute on function public.fn_find_farmer_by_cnic(text) to service_role;

-- 3) Booking campaigns (configurable).
create table if not exists public.booking_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id),
  name text not null check (char_length(trim(name)) between 3 and 120),
  crop text not null,
  deadline date not null,
  is_active boolean not null default true,
  description text,
  eligibility text not null default 'milk_suppliers_and_registered_farmers',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists booking_campaigns_name_uniq on public.booking_campaigns(lower(name));

alter table public.booking_campaigns enable row level security;
grant select on public.booking_campaigns to authenticated;
drop policy if exists "authenticated can view active campaigns" on public.booking_campaigns;
create policy "authenticated can view active campaigns" on public.booking_campaigns
  for select to authenticated using (is_active = true);

insert into public.booking_campaigns (name, crop, deadline, is_active, description)
values ('Gandum Season 2026', 'wheat', date '2026-10-20', true,
  'Kisan Eco Mahabali: beej, khaad aur spray udhaar par (doodh supplier + registered kisan); kataai par gandum market rate par kharidi jayegi. Demand-first, booking par koi payment nahi.')
on conflict do nothing;

-- 4) Kisan ki booking (ek campaign, ek kisan, ek booking -- dobara bhejne par update).
create table if not exists public.campaign_bookings (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.booking_campaigns(id),
  farmer_id uuid not null references public.farmers(id),
  organization_id uuid references public.organizations(id),
  acres numeric(10,2) not null check (acres > 0 and acres <= 10000),
  notes text,
  status text not null default 'submitted' check (status in ('submitted','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, farmer_id)
);
create index if not exists campaign_bookings_campaign_idx on public.campaign_bookings(campaign_id, created_at desc);

alter table public.campaign_bookings enable row level security;
grant select on public.campaign_bookings to authenticated;
drop policy if exists "farmers can view own campaign bookings" on public.campaign_bookings;
create policy "farmers can view own campaign bookings" on public.campaign_bookings
  for select to authenticated using (
    exists (select 1 from public.farmers f where f.id = campaign_bookings.farmer_id and f.user_id = (select auth.uid()))
  );
-- Likhna sirf server action (service role) se, auth + deadline check ke baad.

-- 5) Demand Center se jor: har product line ek farmer_product_demands qatar.
alter table public.farmer_product_demands
  add column if not exists campaign_id uuid references public.booking_campaigns(id),
  add column if not exists campaign_booking_id uuid references public.campaign_bookings(id);
create index if not exists farmer_product_demands_campaign_idx
  on public.farmer_product_demands(campaign_id, product_id) where campaign_id is not null;

-- 6) Doodh supplier ka flag (sirf dekhne ke liye; udhaar adjustment baad mein).
create or replace view public.v_farmer_milk_supplier
with (security_invoker = true) as
select f.id as farmer_id,
       (coalesce(f.milk_financing_enabled, false)
        or f.milk_collection_type is not null
        or exists (select 1 from public.milk_entries m
                   where m.farmer_id = f.id and m.entry_date >= current_date - 90)) as is_milk_supplier,
       (select max(m.entry_date) from public.milk_entries m where m.farmer_id = f.id) as last_milk_entry_date
from public.farmers f
where coalesce(f.is_deleted, false) = false;

-- 7) Campaign ka product-wise jama (cancelled/rejected chhor kar).
create or replace view public.v_campaign_demand_totals
with (security_invoker = true) as
select d.campaign_id,
       d.product_id,
       min(d.product_name) as product_name,
       d.unit,
       sum(d.quantity) as total_quantity,
       count(distinct d.farmer_id) as farmer_count
from public.farmer_product_demands d
where d.campaign_id is not null and d.status not in ('rejected','cancelled')
group by d.campaign_id, d.product_id, d.unit;

comment on table public.booking_campaigns is 'Seasonal booking campaigns (e.g. Gandum Season 2026). Demand-first, no payment (535).';
comment on table public.campaign_bookings is 'Farmer booking header per campaign; product lines live in farmer_product_demands (535).';
