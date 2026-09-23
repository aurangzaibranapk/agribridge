-- Machinery ki adaigi mein JazzCash aur Easypaisa.
--
-- Malik ke mockup (14 September, Hissa B.1): "Add Payment" ke andar
-- Cash/Bank ke sath JazzCash aur Easypaisa bhi hone chahiye.
--
-- Ye dono pehle se `finance_accounts` mein maujood hain (migration 330 ne
-- banaye the -- "JazzCash (merchant)" gl 1015, "Easypaisa (merchant)" gl
-- 1016), aur `payment_method_account_map` mein bhi. Yani POS par ye
-- raaste pehle se chal rahe hain -- sirf machinery ki adaigi un ko mana
-- karti thi, kyunke `chk_machinery_payment_method` ki fehrist mein ye do
-- naam the hi nahi.
--
-- Is liye yahan koi naya khata nahi banta aur `rules.ts` mein koi
-- tabdeeli nahi: `postMachineryPayment` pehle se `finance_account_id` se
-- GL nikalta hai, method ka naam us ke liye maani nahi rakhta. Sirf wohi
-- ek-lakeer wala kaam jo migration 394 ne Waseela Card ke liye kiya tha.

alter table machinery_payments drop constraint if exists chk_machinery_payment_method;
alter table machinery_payments add constraint chk_machinery_payment_method
  check (method = any (array['cash', 'bank', 'wallet', 'khata', 'other', 'vendor_collected', 'lifter_collected', 'waseela_card', 'jazzcash', 'easypaisa']));
