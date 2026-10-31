-- =====================================================================
-- AgriBridge — Migration 734: Doodh kis ne uthaya (carrier)
-- =====================================================================
-- Har dispatch par ek carrier: Wasela Pakistan, vendor, hum khud, ya
-- koi aur. Naya naam bhi yahin se jurta hai. Rate us carrier ko diya
-- gaya (Rs per adjusted L). Amount = adjusted × rate, dikhata hai view.
-- Rollback: 734_milk_carrier.rollback.sql
-- =====================================================================

create table if not exists public.milk_carriers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'vendor',
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint milk_carriers_name check (char_length(btrim(name)) between 2 and 120),
  constraint milk_carriers_kind check (kind in ('wasela', 'vendor', 'self', 'other'))
);

create unique index if not exists milk_carriers_active_name
  on public.milk_carriers (lower(btrim(name)))
  where is_active;

comment on table public.milk_carriers is
  'Doodh uthane wale: Wasela Pakistan, vendor, hum khud, ya aur (734).';

alter table public.milk_carriers enable row level security;

drop policy if exists milk_carriers_select on public.milk_carriers;
create policy milk_carriers_select on public.milk_carriers
  for select to authenticated
  using (public.fn_is_any_staff());

drop policy if exists milk_carriers_write on public.milk_carriers;
create policy milk_carriers_write on public.milk_carriers
  for all to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active and p.role in ('owner', 'super_admin', 'admin', 'manager')
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active and p.role in ('owner', 'super_admin', 'admin', 'manager')
  ));

revoke all on public.milk_carriers from public, anon;
grant select, insert, update on public.milk_carriers to authenticated;

insert into public.milk_carriers (name, kind)
select 'Wasela Pakistan', 'wasela'
where not exists (select 1 from public.milk_carriers where lower(btrim(name)) = 'wasela pakistan');

alter table public.milk_dispatches
  add column if not exists carrier_id uuid references public.milk_carriers(id),
  add column if not exists carrier_rate numeric(12,2);

alter table public.milk_dispatches drop constraint if exists milk_dispatches_carrier_rate;
alter table public.milk_dispatches add constraint milk_dispatches_carrier_rate
  check (carrier_rate is null or (carrier_rate >= 0 and carrier_rate <= 100000));

comment on column public.milk_dispatches.carrier_id is 'Doodh kis ne uthaya (734).';
comment on column public.milk_dispatches.carrier_rate is 'Carrier ko diya gaya rate, Rs per adjusted L (734).';
