-- =====================================================================
-- AgriBridge — Migration 256: Maal ginna -- kitna aaya, kitna toota, kitna kam
-- =====================================================================
-- Naqshe (docs/AI-PURCHASE-PIPELINE.md) ka qadam C.
--
-- Ab tak "Receive" ka matlab tha: invoice par jitna likha hai, utna hi
-- aa gaya. Asal duniya mein aisa kabhi nahi hota -- 50 likhe, 48 aaye,
-- 1 toota hua, 1 aaya hi nahi. Us farq ko likhne ki koi jagah nahi thi,
-- is liye ya to warehouse wala 50 likh deta (aur 2 ka stock hawa mein
-- khaRa rehta, jo ginti ke din nikalta), ya bill ruka rehta.
--
-- ---------------------------------------------------------------------
-- Teen adad, aur teenon ka jorh invoice ke barabar
-- ---------------------------------------------------------------------
-- received + damaged + short = quantity. Ye database par lagi rok hai,
-- form par nahi. Warna kisi din 48 + 1 + 0 likh kar 1 chup chaap gum ho
-- jata -- aur wo "gum" hi wo cheez hai jo pakaRni thi.
--
-- ---------------------------------------------------------------------
-- Supplier ka dena utne ka jitna maal THEEK aaya
-- ---------------------------------------------------------------------
-- Payable purchases.total_amount se banta hai (139). Receive par
-- total_amount = received x cost ho jata hai; invoice ka asal kul
-- invoice_total mein mehfooz rehta hai. Toota hua aur kam -- dono ka
-- paisa nahi banta. Ye faisla jaan boojh kar supplier ke khilaaf hai:
-- zyada de dena aur baad mein wapas maangna, kam dena aur baad mein
-- poora karna se kahin mushkil hai. Farq invoice_total - total_amount
-- mein saaf nazar aata hai, chhupta nahi.
-- =====================================================================

alter table purchase_items
  add column if not exists received_qty numeric(14,3),
  add column if not exists damaged_qty numeric(14,3) not null default 0,
  add column if not exists short_qty numeric(14,3) not null default 0,
  add column if not exists grn_note text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_grn_qty_nonneg') then
    alter table purchase_items
      add constraint chk_grn_qty_nonneg
      check (
        (received_qty is null or received_qty >= 0)
        and damaged_qty >= 0 and short_qty >= 0
      );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_grn_adds_up') then
    alter table purchase_items
      add constraint chk_grn_adds_up
      check (received_qty is null or received_qty + damaged_qty + short_qty = quantity);
  end if;
end;
$$;

comment on column purchase_items.received_qty is
  'Kitna THEEK aaya. NULL = abhi gina nahi. received + damaged + short = quantity (256).';

alter table purchases
  add column if not exists invoice_total numeric(12,2),
  add column if not exists grn_photo_url text,
  add column if not exists grn_note text,
  add column if not exists received_at timestamptz,
  add column if not exists received_by uuid references profiles(id);

comment on column purchases.invoice_total is
  'Invoice par likha kul. total_amount receive par received x cost ho jata hai; farq yahin se nazar aata hai (256).';

-- Farq wali purchases ek nazar mein
create or replace view v_purchase_discrepancies as
select
  p.id as purchase_id,
  p.purchase_number,
  p.purchase_date,
  p.received_at,
  s.name as supplier_name,
  p.invoice_total,
  p.total_amount as accepted_total,
  (coalesce(p.invoice_total, 0) - coalesce(p.total_amount, 0)) as farq,
  (select sum(pi.damaged_qty) from purchase_items pi where pi.purchase_id = p.id) as damaged_units,
  (select sum(pi.short_qty) from purchase_items pi where pi.purchase_id = p.id) as short_units,
  p.grn_photo_url,
  p.grn_note
from purchases p
join suppliers s on s.id = p.supplier_id
where p.status = 'received'
  and p.invoice_total is not null
  and p.invoice_total <> p.total_amount
  and fn_is_any_staff();

comment on view v_purchase_discrepancies is
  'Wo purchases jahan aaya hua maal invoice se kam tha -- toota ya kam (256).';
