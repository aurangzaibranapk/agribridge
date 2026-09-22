-- 432: pos_sales.payment_mode ka check constraint 42 migrations se
-- purana reh gaya tha -- sirf 'cash','khata','split','bank','kisan_card'
-- allow karta tha.
--
-- POS client (pos-client.tsx) ek hi payment line ho to us method ka
-- ASAL naam seedha bhejta hai ('split' sirf tab jab do ya zyada lines
-- hon) -- aur asal naam 'bank_transfer', 'card', 'jazzcash',
-- 'easypaisa', 'qr', 'waseela_card' hain, 'bank'/'kisan_card' nahi.
-- `pos_sale_payment_details` (090, 394) ka apna constraint pehle hi
-- theek tha -- yehi ek table peeche reh gayi thi.
--
-- Nateeja: JazzCash/Easypaisa/QR/Waseela Card/Bank Transfer se akeli
-- (split na ho) koi bhi bikri checkout par "violates check constraint
-- pos_sales_payment_mode_check" de kar rukk jati thi (18 September,
-- malik ka live report -- Waseela Card se).
--
-- Purane 'bank'/'kisan_card' hata nahi rahe -- purani qatarein isi
-- naam se pari hain, unhen tootne se bachana hai.
alter table pos_sales drop constraint if exists pos_sales_payment_mode_check;
alter table pos_sales add constraint pos_sales_payment_mode_check
  check (payment_mode = any (array[
    'cash', 'khata', 'split',
    'bank', 'kisan_card',                              -- purana (backward-compat)
    'bank_transfer', 'card', 'jazzcash', 'easypaisa', 'qr', 'waseela_card'  -- asal naam jo POS bhejta hai
  ]::text[]));
