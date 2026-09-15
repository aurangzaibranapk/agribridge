-- =====================================================================
-- AgriBridge — Migration 255: Purchase par adaigi ki shartein
-- =====================================================================
-- Naqshe (docs/AI-PURCHASE-PIPELINE.md) ka qadam B.
--
-- Purchase banate waqt ye sawal ab tak poochha hi nahi jata tha: paisa
-- diya ya udhaar? Kab tak dena hai? Is liye "agle hafte kis ko kitna
-- dena hai" ka jawab kahin nahi tha -- finance ko supplier se phone
-- par poochhna paRta.
--
-- ---------------------------------------------------------------------
-- Adaigi ka ek hi darwaza rehta hai
-- ---------------------------------------------------------------------
-- "Kharidte waqt Rs 200,000 diye" -- ye adad purchase par nahi likha
-- jata. Wo supplier_payments mein jata hai, bilkul waise jaise koi bhi
-- adaigi jati hai (139). Purchase par sirf ye likha rehta hai ke SHART
-- kya thi. Wajah: supplier ka dena purchases minus supplier_payments se
-- banta hai; agar adaigi purchase par bhi likhi jaye aur payments mein
-- bhi, to ek din do jagah ka adad alag nikalta hai.
--
-- supplier_payments par purchase ka link is liye hai ke "ye adaigi kis
-- kharid ki thi" ka jawab mile -- hisaab us se nahi badalta.
--
-- ---------------------------------------------------------------------
-- Due date, pending par bhi
-- ---------------------------------------------------------------------
-- Purchase pending ho (maal abhi nahi aaya) to bhi due date rehti hai
-- -- supplier ne 30 din kharid ki tareekh se gine hain, receive ki
-- tareekh se nahi. Calendar mein wo bhi dikhti hai, alag nishan ke
-- sath.
-- =====================================================================

alter table purchases
  add column if not exists payment_terms text not null default 'credit',
  add column if not exists credit_days integer,
  add column if not exists due_date date;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_purchase_payment_terms') then
    alter table purchases
      add constraint chk_purchase_payment_terms
      check (payment_terms in ('paid', 'partial', 'credit'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_purchase_credit_days') then
    alter table purchases
      add constraint chk_purchase_credit_days
      check (credit_days is null or credit_days >= 0);
  end if;
end;
$$;

create index if not exists idx_purchases_due
  on purchases (due_date) where due_date is not null and status <> 'cancelled';

comment on column purchases.payment_terms is
  'paid = poora diya, partial = kuch diya, credit = udhaar. Adaigi ka adad yahan NAHI -- supplier_payments mein (255).';

alter table supplier_payments
  add column if not exists purchase_id uuid references purchases(id) on delete set null;

create index if not exists idx_supplier_payments_purchase
  on supplier_payments (purchase_id) where purchase_id is not null;

comment on column supplier_payments.purchase_id is
  'Ye adaigi kis kharid ki thi -- sirf hawale ke liye. Dena supplier ke kul se banta hai (255).';

-- ---------------------------------------------------------------------
-- Adaigi ka calendar
-- ---------------------------------------------------------------------
-- Har purchase ke saamne us ki apni adaigi (purchase_id se juRi hui)
-- aur supplier ka kul dena. Purchase ka apna "baqi" is liye NAHI likha
-- jata ke adaigi supplier ke khate par hoti hai, kisi ek bill par nahi
-- -- ek bill ka "baqi" ginna wo adad banana hai jo asal mein hai hi
-- nahi.
create or replace view v_supplier_due_calendar as
select
  p.id as purchase_id,
  p.purchase_number,
  p.purchase_date,
  p.due_date,
  p.status,
  p.payment_terms,
  p.credit_days,
  p.total_amount,
  p.supplier_id,
  s.name as supplier_name,
  coalesce((select sum(sp.amount) from supplier_payments sp where sp.purchase_id = p.id), 0) as paid_on_this,
  fn_supplier_true_payable(p.supplier_id) as supplier_payable,
  (p.due_date - current_date) as days_left
from purchases p
join suppliers s on s.id = p.supplier_id
where p.due_date is not null
  and p.status <> 'cancelled'
  and fn_is_any_staff();

comment on view v_supplier_due_calendar is
  'Kis purchase ki adaigi kab tak hai. paid_on_this = is purchase se juRi adaigi; supplier_payable = supplier ka kul dena (255).';
