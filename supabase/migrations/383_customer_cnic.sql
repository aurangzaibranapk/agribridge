-- =====================================================================
-- AgriBridge — Migration 383: Customer ka CNIC bhi
-- =====================================================================
-- Malik (10 September): POS par customer mobile number, CNIC number, ya
-- naam -- teenon se dhoonda ja sakna chahiye.
--
-- `staff_details.cnic` ki tarah saada text -- format par koi sakht rok
-- nahi (dash ke sath ya bina, jo bhi likha jaye chal jata hai).
-- =====================================================================

alter table public.customers
  add column if not exists cnic text;

comment on column public.customers.cnic is
  'Customer ka CNIC -- marzi se, POS ki customer talaash mein naam/mobile ke sath istemal hota hai.';
