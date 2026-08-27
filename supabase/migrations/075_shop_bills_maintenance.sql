-- =====================================================================
-- AgriBridge — Migration 075: Shop Bills & Maintenance (per Branch)
-- =====================================================================
-- Electricity, Gas, Water, Maintenance, or any other recurring shop
-- expense - tracked per branch, per month, with an amount and
-- optional receipt/bill image.

create table if not exists shop_bills (
  id uuid primary key default uuid_generate_v4(),
  branch_id uuid not null references branches(id) on delete cascade,
  bill_type text not null,
  bill_month integer not null,
  bill_year integer not null,
  amount numeric(10,2) not null,
  due_date date,
  paid_date date,
  status text not null default 'pending' check (status in ('pending','paid')),
  bill_image_url text,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table shop_bills enable row level security;
create policy staff_manage_shop_bills on shop_bills for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager'))
);

insert into storage.buckets (id, name, public)
values ('shop-bills', 'shop-bills', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('rent-agreements', 'rent-agreements', true)
on conflict (id) do nothing;