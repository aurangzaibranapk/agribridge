create table if not exists public.grain_pack_rules (
  grain_type text primary key check (grain_type in ('wheat','rice','maize')),
  is_bag_based boolean not null default true,
  bag_weight_kg numeric null check (bag_weight_kg is null or (bag_weight_kg > 0 and bag_weight_kg <= 1000)),
  default_cut_kg numeric not null default 0 check (default_cut_kg >= 0 and default_cut_kg <= 999),
  default_cut_grams integer not null default 0 check (default_cut_grams >= 0 and default_cut_grams <= 999),
  default_chungi_kg numeric not null default 0 check (default_chungi_kg >= 0 and default_chungi_kg <= 999),
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id)
);

insert into public.grain_pack_rules(grain_type,is_bag_based,bag_weight_kg)
values ('wheat',true,100),('rice',true,60),('maize',false,null)
on conflict (grain_type) do nothing;

alter table public.grain_pack_rules enable row level security;
drop policy if exists "staff read grain pack rules" on public.grain_pack_rules;
create policy "staff read grain pack rules" on public.grain_pack_rules for select
using (public.fn_is_any_staff());
drop policy if exists "admin manage grain pack rules" on public.grain_pack_rules;
create policy "admin manage grain pack rules" on public.grain_pack_rules for all
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active=true and p.role in ('owner','super_admin','admin')))
with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active=true and p.role in ('owner','super_admin','admin')));
grant select on public.grain_pack_rules to authenticated;
grant insert,update on public.grain_pack_rules to authenticated;
grant all on public.grain_pack_rules to service_role;

alter table public.grain_procurement_entries add column if not exists bag_weight_kg numeric null;
alter table public.grain_procurement_entries add column if not exists bag_count numeric null;
alter table public.grain_procurement_entries add column if not exists cut_per_bag_kg numeric null;
alter table public.grain_procurement_entries add column if not exists chungi_per_bag_kg numeric null;
alter table public.grain_procurement_entries add column if not exists bag_calculation_basis text null
  check (bag_calculation_basis is null or bag_calculation_basis in ('per_bag','total_weight','percentage'));
