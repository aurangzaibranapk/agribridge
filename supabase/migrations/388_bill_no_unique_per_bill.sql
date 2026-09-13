-- =====================================================================
-- AgriBridge — Migration 388: "Ek bill, ek purchase" ab bill ke star par
-- =====================================================================
-- Migration 289 ne rok lagayi thi: ek supplier ka ek bill number sirf
-- EK purchase bana sake -- 4 September ki Rs 315,914 wali dohri kharid
-- se bachne ke liye. Us waqt maqsad theek tha, jagah ghalat thi: rok
-- PURCHASE par lagi, jab ke us din ka asal masla ye nahi tha ke ek bill
-- se do purchase bane -- masla ye tha ke EK HI BILL do-teen dafa ALAG
-- SE UPLOAD/CHARHAYA gaya.
--
-- 10 September: 11 qataron wale bill mein sirf 1 line ready thi, purchase
-- ban gayi, baaki 10 line dheere dheere tayyar hoti rahin -- aur doosri
-- purchase banate waqt yehi purani rok (289) rasta rok kar khaRi ho gayi,
-- kyunke wo isi ek bill ki doosri, jaayaz purchase ko bhi "dohra" samajh
-- rahi thi.
--
-- Ab rok BILL ke star par hai: ek supplier ka ek bill number sirf EK
-- bill-upload (supplier_bill_reads row) se purchase bana sakta hai --
-- chahe us upload se ek purchase bane ya das, farq nahi paRta. Doosra
-- upload (alag id) wohi bill number le kar aaye to wahi rok chalti hai.
-- =====================================================================

drop index if exists public.ux_purchases_supplier_bill_no;

-- Purani qataron mein supplier_id khaali reh gaya tha (bill khud bina
-- supplier ke bani thi, form se chuna gaya tha) -- ab theek kar dete
-- hain, warna neeche wali nayi rok in par kaam nahi karegi.
update public.supplier_bill_reads sbr
set supplier_id = p.supplier_id
from public.purchases p
where sbr.purchase_id = p.id
  and sbr.supplier_id is null;

create unique index if not exists ux_bill_reads_supplier_bill_no_applied
  on public.supplier_bill_reads (supplier_id, lower(btrim(bill_number)))
  where supplier_id is not null
    and bill_number is not null
    and btrim(bill_number) <> ''
    and purchase_id is not null;
