-- Bank Management ka safha shuru se toota hua tha.
--
-- src/actions/bank-management.ts bank banate waqt finance_accounts mein
-- account_number likhta hai, aur /admin/finance/banks us column ko
-- parhta hai -- magar wo column database mein kabhi bana hi nahi tha.
--
-- Nateeja: bank add karne par error, aur banks ki fehrist hamesha khali
-- (poora select fail ho jata tha, sirf ek column ki wajah se). Ye
-- next.config ke ignoreBuildErrors ke peeche chhupa raha.
--
-- Column yahan banaya ja raha hai, hataya nahi ja raha: bank ka khata
-- number karobar mein waqai chahiye hota hai -- statement par, adaigi
-- ki parchi par, aur supplier ko number bhejte waqt.

alter table public.finance_accounts
  add column if not exists account_number text;

comment on column public.finance_accounts.account_number is
  'Bank ka khata number. Sirf account_type = bank par bharta hai; naqad aur mobile wallet par khali rehta hai.';
