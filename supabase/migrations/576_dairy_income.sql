-- 576: Dairy aamdani (ghar ka doodh, janwar bikri, deegar). Centre ka doodh yahan
-- NAHI likha jata -- ERP se sirf parha jata hai (fn_my_centre_milk_income).
create table if not exists public.dairy_income (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.farmers(id),
  income_date date not null default current_date,
  kind text not null check (kind in ('home_milk','animal_sale','other')),
  qty numeric(12,3) check (qty is null or qty > 0),
  rate numeric(12,2) check (rate is null or rate >= 0),
  amount numeric(14,2) not null check (amount > 0 and amount <= 10000000),
  animal_id uuid references public.dairy_animals(id),
  buyer text check (buyer is null or length(buyer) <= 80),
  note text check (note is null or length(note) <= 300),
  voided boolean not null default false,
  void_reason text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (qty is null or rate is null or amount = round(qty * rate, 2)),
  check (not voided or length(coalesce(void_reason,'')) >= 3)
);
create index if not exists ix_dairy_income_farmer_date on public.dairy_income (farmer_id, income_date);
drop trigger if exists trg_dairy_income_guard on public.dairy_income;
create trigger trg_dairy_income_guard before insert or update or delete on public.dairy_income
  for each row execute function public.fn_dairy_money_guard();

alter table public.dairy_income enable row level security;
revoke all on public.dairy_income from anon;
grant select, insert, update on public.dairy_income to authenticated;
revoke delete on public.dairy_income from authenticated;
drop policy if exists dairy_income_own_select on public.dairy_income;
create policy dairy_income_own_select on public.dairy_income for select to authenticated
  using (farmer_id = public.fn_dairy_my_farmer_id() or public.fn_is_staff(auth.uid()));
drop policy if exists dairy_income_own_insert on public.dairy_income;
create policy dairy_income_own_insert on public.dairy_income for insert to authenticated
  with check (farmer_id = public.fn_dairy_my_farmer_id());
drop policy if exists dairy_income_own_update on public.dairy_income;
create policy dairy_income_own_update on public.dairy_income for update to authenticated
  using (farmer_id = public.fn_dairy_my_farmer_id()) with check (farmer_id = public.fn_dairy_my_farmer_id());

-- Andar ka helper: kisi farmer ka centre doodh (litre, qeemat, adaigi). Portal se seedha nahi.
create or replace function public.fn_dairy_centre_for(p_farmer uuid, p_from date, p_to date)
returns table (litres numeric, value numeric, paid numeric)
language sql stable security definer set search_path = public as $$
  select coalesce((select sum(e.quantity_liters) from milk_entries e where e.farmer_id = p_farmer and e.entry_date between p_from and p_to), 0),
         coalesce((select sum(coalesce(e.total_amount, e.quantity_liters * e.rate_per_liter, 0)) from milk_entries e where e.farmer_id = p_farmer and e.entry_date between p_from and p_to), 0),
         coalesce((select sum(m.amount) from milk_payments m where m.farmer_id = p_farmer and m.payment_date between p_from and p_to), 0);
$$;
revoke all on function public.fn_dairy_centre_for(uuid, date, date) from public, anon, authenticated;

create or replace function public.fn_my_centre_milk_income(p_from date, p_to date)
returns table (litres numeric, value numeric, paid numeric)
language sql stable security definer set search_path = public as $$
  select * from public.fn_dairy_centre_for(public.fn_dairy_my_farmer_id(), coalesce(p_from, current_date - 29), coalesce(p_to, current_date))
   where public.fn_dairy_my_farmer_id() is not null;
$$;
revoke all on function public.fn_my_centre_milk_income(date, date) from public, anon;
grant execute on function public.fn_my_centre_milk_income(date, date) to authenticated;
