-- =====================================================================
-- AgriBridge — Migration 737: Chiller ki master list (har branch)
-- =====================================================================
-- Chiller ke naam ab ek master list se aate hain. Default 1 se 5.
-- Sirf Owner, Super Admin, Admin naam badal sakte hain. Staff sirf chun sakta hai.
-- Rollback: 737_milk_chiller_master.rollback.sql
-- =====================================================================

create table if not exists public.milk_chiller_master (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id),
  sort_no integer not null,
  name text not null,
  is_active boolean not null default true,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  constraint milk_chiller_master_name check (char_length(btrim(name)) between 1 and 40),
  constraint milk_chiller_master_sort check (sort_no > 0)
);

create unique index if not exists milk_chiller_master_one
  on public.milk_chiller_master (branch_id, sort_no);

create unique index if not exists milk_chiller_master_name
  on public.milk_chiller_master (branch_id, lower(btrim(name)))
  where is_active;

comment on table public.milk_chiller_master is
  'Har branch ke chiller. Default 1 se 5. Naam sirf Owner/Super Admin/Admin badal sakte hain (737).';

alter table public.milk_chiller_master enable row level security;

drop policy if exists milk_chiller_master_select on public.milk_chiller_master;
create policy milk_chiller_master_select on public.milk_chiller_master
  for select to authenticated
  using (public.fn_is_any_staff());

drop policy if exists milk_chiller_master_write on public.milk_chiller_master;
create policy milk_chiller_master_write on public.milk_chiller_master
  for all to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active and p.role in ('owner', 'super_admin', 'admin')
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active and p.role in ('owner', 'super_admin', 'admin')
  ));

revoke all on public.milk_chiller_master from public, anon;
grant select on public.milk_chiller_master to authenticated;
grant insert, update on public.milk_chiller_master to authenticated;

-- Har branch ke liye 1 se 5 tak default chiller (pehle se hon to kuch nahi).
insert into public.milk_chiller_master (branch_id, sort_no, name)
select b.id, n.sort_no, n.sort_no::text
from public.branches b
cross join (values (1), (2), (3), (4), (5)) as n(sort_no)
on conflict (branch_id, sort_no) do nothing;
