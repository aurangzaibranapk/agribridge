-- =====================================================================
-- AgriBridge — Migration 314: Khate ki poori pehchaan
-- =====================================================================
-- Malik ka kehna (5 September):
--
--   "maine yahan par account add kiya, hona to ye chahiye: bank name,
--    account title kya hai, aur account no kya. Is se pata chalta hai
--    ke kis kis account mein kitna balance hai — sirf name hi kyun?"
--
-- Bilkul theek. Ek hi bank mein do khate hon (ek karobar ka, ek dukan
-- ka) to sirf "UBL" likha dekh kar koi nahi bata sakta ke ye kaun sa
-- hai. Aur jab paisa bhejna ho, ya bank ki statement se milan karna ho,
-- to naam se kaam nahi chalta -- title aur number chahiye.
--
-- `account_number` ka khana pehle se maujood tha magar form use poochta
-- hi nahi tha. Do naye khane jur rahe hain:
--
--   bank_name      -- kis bank ka (UBL, Alfalah, HBL...)
--   account_title  -- khata kis ke naam par hai
--
-- Teenon KHALI reh sakte hain: cash box ka koi bank nahi hota, aur
-- purane khaton par ye tafseel abhi likhi hi nahi. Khali ko "maloom
-- nahi" hi rehna chahiye -- us jagah kuch bana kar likh dena is project
-- mein pehle bhi ghalat adad de chuka hai.
-- =====================================================================

alter table public.finance_accounts
  add column if not exists bank_name     text,
  add column if not exists account_title text;

comment on column public.finance_accounts.bank_name is
  'Kis bank ka khata (UBL, Alfalah...). Cash box par khali rehta hai.';
comment on column public.finance_accounts.account_title is
  'Khata kis ke naam par hai -- bank ki statement se milan ke liye.';

-- Ek hi bank mein ek hi number do dafa nahi ho sakta. Number khali ho to
-- rok nahi lagti (cash box, ya wo khate jin ka number abhi likha nahi).
create unique index if not exists uq_finance_account_number
  on public.finance_accounts (bank_name, account_number)
  where account_number is not null and bank_name is not null;
