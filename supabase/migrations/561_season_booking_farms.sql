-- 561: Season Booking v2 -- har booking ke farms (acre + map pin) aur
-- product ki qisam (beej/khaad/spray) category tree se.
-- SIRF ADDITIVE: naye table/function/view. farms ke purane columns
-- (latitude/longitude/area_acres) hi istemal hote hain, kuch badla nahi.

-- 1) Campaign ki fasal ka qaida (abhi sirf gandum).
alter table public.booking_campaigns
  add column if not exists allowed_crops text[] not null default array['wheat'];

-- 2) Booking <-> farm (ek booking, kai farms; har farm ka is season ka rakba).
create table if not exists public.campaign_booking_farms (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.campaign_bookings(id) on delete cascade,
  farm_id uuid not null references public.farms(id),
  crop text not null default 'wheat' check (crop = 'wheat'),
  acres numeric(10,2) not null check (acres > 0 and acres <= 10000),
  created_at timestamptz not null default now(),
  unique (booking_id, farm_id)
);
create index if not exists campaign_booking_farms_farm_idx on public.campaign_booking_farms(farm_id);

alter table public.campaign_booking_farms enable row level security;
grant select on public.campaign_booking_farms to authenticated;
drop policy if exists "farmer views own booking farms" on public.campaign_booking_farms;
create policy "farmer views own booking farms" on public.campaign_booking_farms
  for select to authenticated using (
    exists (select 1 from public.campaign_bookings b join public.farmers f on f.id = b.farmer_id
            where b.id = campaign_booking_farms.booking_id and f.user_id = (select auth.uid()))
  );
drop policy if exists "staff views booking farms" on public.campaign_booking_farms;
create policy "staff views booking farms" on public.campaign_booking_farms
  for select to authenticated using (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_active
            and p.role::text in ('super_admin','owner','admin','manager','sales_staff'))
  );
-- Likhna sirf server action (service role) se.

-- 3) Product ki qisam: category ya us ka parent (root) Seeds/Fertilizer/Pesticide.
create or replace function public.fn_product_line_kind(p_category_id uuid)
returns text language sql stable set search_path = public as $$
  with recursive up as (
    select id, name, parent_category_id, 0 as depth from public.categories where id = p_category_id
    union all
    select c.id, c.name, c.parent_category_id, up.depth + 1
    from public.categories c join up on c.id = up.parent_category_id where up.depth < 5
  )
  select case
    when bool_or(lower(name) in ('seeds','seed','beej')) then 'seed'
    when bool_or(lower(name) in ('fertilizer','fertilizers','khaad')) then 'fertilizer'
    when bool_or(lower(name) in ('pesticide','pesticides','spray')) then 'pesticide'
  end from up;
$$;
grant execute on function public.fn_product_line_kind(uuid) to authenticated, service_role;

-- 4) Campaign ke liye products (sirf agri qisam wale, delete nahi).
create or replace view public.v_campaign_products with (security_invoker = true) as
  select p.id, p.name, p.pack_size, p.unit, p.category_id, c.name as category_name,
         public.fn_product_line_kind(p.category_id) as line_kind
  from public.products p join public.categories c on c.id = p.category_id
  where coalesce(p.is_deleted, false) = false
    and public.fn_product_line_kind(p.category_id) is not null;
grant select on public.v_campaign_products to authenticated;
