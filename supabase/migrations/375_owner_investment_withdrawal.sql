-- =====================================================================
-- AgriBridge — Migration 375: Owner Investment/Withdrawal (Phase 2C)
-- =====================================================================
-- Malik ka usool (8 September, raat): "Investment/Withdrawal ke liye
-- agar existing accounting/money-trail tables suitable hain to unhi ko
-- reuse karein. Nayi parallel ledger/table sirf isliye na banayein ke
-- Shop-360 ko number chahiye."
--
-- Is liye koi nayi table nahi -- Paisa & Khata (`company_expense_requests`)
-- ki 'kind' fehrist mein sirf do naye kind ADD hote hain
-- (`src/lib/kharche.ts`, KHARCHA_QISMEIN). Fayda: shop_id, approval
-- chain, aur ledger posting (`postJournal`) sab pehle se bane bane
-- milte hain. `ACC.ownerCapital` (3000) aur `ACC.ownerDrawings` (3100)
-- pehle kabhi istemal nahi hue the (dead code) -- ab pehli dafa asal
-- mein postenge.
-- =====================================================================

alter table public.company_expense_requests drop constraint if exists chk_kharcha_kind;
alter table public.company_expense_requests add constraint chk_kharcha_kind
  check (kind = any (array[
    'kharcha', 'supplier_ko_diya', 'staff_ko_advance', 'kisan_ko_advance',
    'mazdoor_ko_advance', 'mazdoori_ki_adaigi', 'customer_se_wasooli',
    'staff_se_wapas', 'kisan_se_wapas', 'aamdani',
    'malik_ne_nikala', 'malik_ka_sarmaya'
  ]));
