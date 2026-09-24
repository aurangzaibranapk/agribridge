-- Adaigi ki slips purchase ke sath (malik, 19 September): "stock
-- purchase bane to payment ke end par pooche, aur agar paid hai to
-- wahan hum slip upload karein... ek slip mein 10 hazar, doosri mein
-- kitni, kis date ko" -- har slip apni raqam aur tareekh ke sath.
--
-- Slip SABOOT hai, hisaab nahi: supplier ka asal dena/adaigi
-- supplier_payments se hi chalta hai (139). Yahan sirf kaghaz ki
-- tasveer, raqam aur tareekh mehfooz hoti hai taake baad mein supplier
-- se baat par kaghaz saamne ho.

create table if not exists purchase_payment_slips (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references purchases(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  paid_on date not null,
  image_url text not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_purchase_payment_slips_purchase
  on purchase_payment_slips (purchase_id, paid_on);

comment on table purchase_payment_slips is
  'Purchase ki adaigi ki slips: har slip par raqam, tareekh, tasveer (436). Saboot hai, hisaab supplier_payments mein hai.';

alter table purchase_payment_slips enable row level security;

drop policy if exists purchase_payment_slips_read on purchase_payment_slips;
create policy purchase_payment_slips_read on purchase_payment_slips
  for select to authenticated using (public.fn_is_any_staff());

drop policy if exists purchase_payment_slips_insert on purchase_payment_slips;
create policy purchase_payment_slips_insert on purchase_payment_slips
  for insert to authenticated
  with check (public.fn_is_any_staff() and created_by = auth.uid());

-- Delete sirf Admin/Owner (deletePurchase cascade ke liye bhi yehi
-- kaafi hai kyunki wahan bhi wahi role chala raha hota hai).
drop policy if exists purchase_payment_slips_delete on purchase_payment_slips;
create policy purchase_payment_slips_delete on purchase_payment_slips
  for delete to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role in ('owner', 'super_admin', 'admin')
        and p.is_active
    )
  );
