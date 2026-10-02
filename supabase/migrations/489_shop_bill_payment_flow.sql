-- Migration 489: Shop Bill Payment Flow
--
-- Har bill ke liye payment method track karo:
--   shop_cash    → shop ne khud diya (seedha paid)
--   finance      → finance department ne diya
--   pending      → abhi request nahi hui
--
-- Finance request: bill ko 'finance_requested' status pe bhejo.
-- Jab finance pay kare, wo 'paid' kar de aur pay_method = 'finance' lagaye.

alter table public.shop_bills
  add column if not exists pay_method      text check (pay_method in ('shop_cash','finance')) default null,
  add column if not exists paid_by         uuid references profiles(id) default null,
  add column if not exists finance_requested_at  timestamptz default null,
  add column if not exists finance_requested_by  uuid references profiles(id) default null;

-- Status mein 'finance_requested' bhi allowed ho
alter table public.shop_bills
  drop constraint if exists shop_bills_status_check;

alter table public.shop_bills
  add constraint shop_bills_status_check
    check (status in ('pending','finance_requested','paid'));

-- Finance role bhi bills update kar sake (pay karne ke liye)
create policy "shop_bills_finance_pay" on public.shop_bills
  for update
  using  (exists (select 1 from profiles p where p.id = auth.uid() and p.is_active and p.role in ('owner','super_admin','admin','manager','finance')))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_active and p.role in ('owner','super_admin','admin','manager','finance')));

comment on column public.shop_bills.pay_method is 'shop_cash = shop ne diya, finance = finance dept ne diya (489)';
comment on column public.shop_bills.finance_requested_at is 'Jab finance ko request ki gayi (489)';
