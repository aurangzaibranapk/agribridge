-- 157: Vendor ka apna login
--
-- Vendor portal bana hua tha magar us tak pohanchne ka koi rasta nahi
-- tha: safha machinery_vendors.user_id dekhta hai, aur wo khana kabhi
-- bharta hi nahi tha. Yani portal maujood tha aur khali.
--
-- Vendor hamara mulazim nahi -- wo doosri taraf ka bandobast hai. Is
-- liye us ka apna darja hai (machinery_vendor), staff wala nahi. Ye
-- farq ahem hai: staff ke darje /admin ka darwaza kholte hain, aur
-- vendor ko wahan kabhi nahi jana chahiye.
--
-- Ek vendor = ek login. Do login ka matlab hota do log ek hi khate ka
-- kaam karein aur baad mein pata na chale ke kis ne kya bheja.

create unique index if not exists uq_vendor_user
  on public.machinery_vendors(user_id)
  where user_id is not null;

comment on column public.machinery_vendors.user_id is
  'Is vendor ka apna login. Yehi wo kari hai jis se /vendor safha us ka apna khata dikhata hai.';

-- ---------------------------------------------------------------
-- Vendor apni tafseel khud parh sake
--
-- Sirf apni. Doosre vendors ka naam, phone ya kaam us ka maamla nahi.
-- ---------------------------------------------------------------
drop policy if exists machinery_vendors_own_read on public.machinery_vendors;
create policy machinery_vendors_own_read on public.machinery_vendors
  for select using (user_id = auth.uid() or fn_is_any_staff());

-- Booking bhi wahi jo us ki machine ki ho.
drop policy if exists machinery_bookings_vendor_read on public.machinery_bookings;
create policy machinery_bookings_vendor_read on public.machinery_bookings
  for select using (
    vendor_id in (select v.id from public.machinery_vendors v where v.user_id = auth.uid())
  );

drop policy if exists machinery_bills_vendor_read on public.machinery_bills;
create policy machinery_bills_vendor_read on public.machinery_bills
  for select using (
    booking_id in (
      select b.id from public.machinery_bookings b
      join public.machinery_vendors v on v.id = b.vendor_id
      where v.user_id = auth.uid()
    )
  );

-- Payments par vendor ka haq jaan boojh kar NAHI diya gaya.
--
-- Kisan ne kab, kaise, kitna diya -- ye kisan aur hamare darmiyan ka
-- maamla hai. Vendor ko sirf ye jaanna chahiye ke US ka kitna bana aur
-- kitna mila; wo us ke apne khate (v_machinery_vendor_ledger) se
-- milta hai.
