-- =====================================================================
-- AgriBridge — Migration 733: Chiller din ka farmer ko kul dena (Rs)
-- =====================================================================
-- Farmer ki har entry abhi system mein nahi hoti. Statement bahar bana
-- kar us din ka KUL farmer ko dena (Rs) yahan hath se likha jata hai.
-- Ek din, ek branch = ek qatar. Ye raqam maaloom karne ke liye hai, paise
-- ki adaigi yahan se nahi hoti (wo fn_record_milk_payment se hoti hai).
--
-- Rollback: 733_milk_day_farmer_payable.rollback.sql
-- =====================================================================

create table if not exists public.milk_day_farmer_payables (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id),
  entry_date date not null,
  amount numeric(14,2) not null,
  note text,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint milk_day_farmer_payables_amount check (amount >= 0 and amount <= 100000000),
  constraint milk_day_farmer_payables_note check (note is null or char_length(note) <= 255)
);

create unique index if not exists milk_day_farmer_payables_one
  on public.milk_day_farmer_payables (branch_id, entry_date);

comment on table public.milk_day_farmer_payables is
  'Chiller din ka farmer ko kul dena (Rs), hath se likha hua. Farmer ki alag qatar nahi (733).';

alter table public.milk_day_farmer_payables enable row level security;

-- Parhna: koi bhi staff (control room dekhne ke liye).
drop policy if exists milk_day_farmer_payables_select on public.milk_day_farmer_payables;
create policy milk_day_farmer_payables_select on public.milk_day_farmer_payables
  for select to authenticated
  using (public.fn_is_any_staff());

-- Likhna: sirf Owner, Super Admin, Admin, Manager (active).
drop policy if exists milk_day_farmer_payables_write on public.milk_day_farmer_payables;
create policy milk_day_farmer_payables_write on public.milk_day_farmer_payables
  for all to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active and p.role in ('owner', 'super_admin', 'admin', 'manager')
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active and p.role in ('owner', 'super_admin', 'admin', 'manager')
  ));

revoke all on public.milk_day_farmer_payables from public, anon;
grant select, insert, update on public.milk_day_farmer_payables to authenticated;
