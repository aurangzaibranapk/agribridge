-- =====================================================================
-- AgriBridge — Migration 521: supplier payment request par khata + tareekh
-- =====================================================================
-- Approval-path review (10 Oct 2026): recordSupplierPayment ab seedha
-- post nahi karta, request banata hai jo Admin/Owner (doosra shakhs)
-- approve karta hai. Approve par payAndPost ko finance account chahiye,
-- jo is table mein tha hi nahi. Sirf naye nullable columns -- additive.
-- =====================================================================
alter table public.supplier_payment_requests
  add column if not exists finance_account_id uuid null,
  add column if not exists payment_date date null;

-- Purchase ke waqt "abhi diya" (paidNow) ab manzoori tak ruka rehta hai.
-- Irada yahan mehfooz hota hai; reviewPurchase approve par post karta hai.
alter table public.purchases
  add column if not exists held_payment jsonb null;
