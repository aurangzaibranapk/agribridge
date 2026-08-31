-- =====================================================================
-- Migration 199: Due date ki buniyad
-- =====================================================================
-- Score engine ko "der se diya" kehna hai. Magar aaj poore nizam mein
-- ye baat kahi hi nahi ja sakti -- kyunke jis cheez ka due date hi
-- nahi, us ke bare mein "der" ka sawal paida nahi hota.
--
-- Poori talash ke baad jo mila:
--
--   shop_bills.due_date                    -- asal tareekh, magar ye
--                                             hamara apna bill hai
--   shop_rent_agreements.due_day           -- mahine ka din; qist ki
--                                             tareekh isi se nikalti hai
--   machinery_bookings.payment_promise_date -- KISAN KA APNA WAADA.
--                                             Kis ne kab darj kiya wo
--                                             bhi likha hai. Ye sab se
--                                             saaf due date hai jo
--                                             hamare paas pehle se hai.
--
-- Baqi har jagah kuch nahi. Ye migration wo khali jagah bharti hai --
-- magar sirf AAGE ke liye.
--
-- PURANI QATAREIN CHHUI NAHI JATIN.
--
-- Ye sab se ahem baat hai. Purane bill par aaj koi tareekh daalna --
-- chahe "bill ke tees din baad" jaisa maqool qaida laga kar hi kyun na
-- ho -- ek aisi baat likhna hai jo us waqt hui hi nahi thi. Us ke baad
-- nizam kisi kisan ko "der karne wala" keh dega, aur us ke paas us
-- ilzam ka koi jawab nahi hoga, kyunke us se wo tareekh kabhi kahi hi
-- nahi gayi thi.
--
-- Is liye: koi backfill nahi. Purani qatarein khali rahengi, aur khali
-- rehna un ka sach hai. Score un par waqt ki pabandi ka factor lagata
-- hi nahi -- wo un ke liye N/A rehta hai. Na "waqt par", na "der se".
-- ---------------------------------------------------------------

-- ---------------------------------------------------------------
-- 1) Machinery ka bill
-- ---------------------------------------------------------------
-- terms_days alag se rakha ja raha hai. Sirf due_date rakhte to baad
-- mein ye sawal ka jawab na hota ke "ye tareekh aayi kahan se" -- kisi
-- ne haath se daali thi, ya bill ke qaide se bani thi.
alter table machinery_bills
  add column if not exists due_date   date,
  add column if not exists terms_days int;

comment on column machinery_bills.due_date is
  'Kab tak dena hai. Khali = tay hi nahi hua tha; is par lateness ka hisaab nahi lagta.';

-- ---------------------------------------------------------------
-- 2) Order ki adaigi
-- ---------------------------------------------------------------
-- customers.payment_due_days pehle se maujood hai aur agri_orders mein
-- payment_terms ka matn bhi. Magar in dono se aaj tak koi TAREEKH nahi
-- banti thi -- aur jab tak tareekh na ho, hisaab har dafa naya lagta
-- hai aur har jagah alag nikalta hai. Ab wo order banate waqt ek dafa
-- likh di jayegi.
alter table agri_orders
  add column if not exists payment_due_date date;

comment on column agri_orders.payment_due_date is
  'Order ke waqt customer ki terms se bhara jata hai. Purane order par hamesha khali.';

-- ---------------------------------------------------------------
-- 3) Qarz ki qistein
-- ---------------------------------------------------------------
-- farmer_loans mein weekly_installment ka khana hai, magar SCHEDULE
-- kahin nahi. Yani ye to likha hai ke "har hafte itna", magar ye nahi
-- ke "kaunse haftey, kis tareekh ko". Us se ye kaha ja sakta hai ke
-- kitna baqi hai -- ye nahi ke koi qist reh gayi.
--
-- due_date yahan LAZMI hai, aur ye jaan boojh kar hai: qist ka wujood
-- hi apni tareekh se hai. Bina tareekh ke wo qist nahi, sirf raqam hai
-- -- aur raqam pehle se outstanding_balance mein maujood hai.
create table if not exists loan_installments (
  id           uuid primary key default uuid_generate_v4(),
  loan_type    text not null check (loan_type in ('farmer', 'livestock')),
  loan_id      uuid not null,
  seq          int  not null,
  due_date     date not null,
  amount_due   numeric(14,2) not null check (amount_due > 0),
  amount_paid  numeric(14,2) not null default 0,
  paid_at      timestamptz,
  -- Phase 18 (multi-tenant) ke liye. Aaj khali chalega, magar baad mein
  -- table dobara banani nahi paregi.
  organization_id uuid,
  created_by   uuid references profiles(id),
  created_at   timestamptz not null default now(),
  unique (loan_type, loan_id, seq)
);

create index if not exists idx_loan_installments_due
  on loan_installments (due_date)
  where paid_at is null;

create index if not exists idx_loan_installments_loan
  on loan_installments (loan_type, loan_id);

-- ---------------------------------------------------------------
-- 4) Overdue dhoondne ke liye
-- ---------------------------------------------------------------
create index if not exists idx_machinery_bills_due
  on machinery_bills (due_date)
  where due_date is not null;

create index if not exists idx_agri_orders_due
  on agri_orders (payment_due_date)
  where payment_due_date is not null;
