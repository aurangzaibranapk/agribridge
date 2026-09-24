-- =====================================================================
-- AgriBridge — Migration 245: Wholesale rate
-- =====================================================================
-- Ab tak product par teen adad the:
--   purchase_price -- hum ne kitne ka liya (trade rate)
--   selling_price  -- dukan par kitne ka bikta hai (retail)
--   mrp_price      -- dabbe par kya chhapa hai
--
-- Malik ka nizam ek aur maangta hai: koi banda THOK (wholesale) par
-- lene aaye to us par alag rate lagta hai.
--
-- ---------------------------------------------------------------------
-- Ye khana NULL rakha ja sakta hai -- aur sifar se ALAG hai
-- ---------------------------------------------------------------------
-- Har cheez thok par nahi milti. Jis par nahi milti, us ka khana KHALI
-- rehta hai -- sifar nahi. Sifar ka matlab "muft" hota, aur ek din wo
-- adad kisi bill par chala jata.
--
-- Is liye ye khana nullable hai, aur POS ko usi tarah parhna chahiye:
-- NULL = is par thok ka rate nahi hai (retail lagega), 0 = waqai muft.
--
-- ---------------------------------------------------------------------
-- Rok nahi lagai gayi -- jaan boojh kar
-- ---------------------------------------------------------------------
-- Soch ye thi ke wholesale hamesha retail se kam aur trade se zyada
-- hona chahiye. Magar dono soortein waqai hoti hain:
--   * purana maal nikalna ho to thok ka rate lagat se bhi kam lagta hai
--   * kisi cheez par thok aur retail ek hi rate hota hai
-- Is liye database rokta nahi. Safha KHABARDAR karta hai -- faisla
-- bande ka rehta hai, aur wo faisla soch kar hota hai.
-- =====================================================================

alter table products
  add column if not exists wholesale_price numeric(12,2);

alter table products drop constraint if exists chk_wholesale_price_sane;
alter table products add constraint chk_wholesale_price_sane
  check (wholesale_price is null or wholesale_price >= 0);

comment on column products.wholesale_price is
  'Thok (wholesale) ka rate. NULL = is par thok nahi milta (retail lagega). Sifar aur NULL ek cheez nahi (245).';

-- Maal andar lene wale safhe par bhi wohi khana.
alter table product_intake_items
  add column if not exists wholesale_price numeric(12,2);

alter table product_intake_items drop constraint if exists chk_intake_wholesale_sane;
alter table product_intake_items add constraint chk_intake_wholesale_sane
  check (wholesale_price is null or wholesale_price >= 0);

-- ---------------------------------------------------------------------
-- Kin par thok ka rate abhi nahi
-- ---------------------------------------------------------------------
-- Ye fehrist is liye hai ke khana khali chhoR dena aasan hai, aur phir
-- thok wala gahak aane par pata chalta hai ke rate hai hi nahi.
create or replace view v_products_wholesale_baqi as
select
  p.id,
  p.name,
  p.pack_size,
  p.barcode,
  p.purchase_price,
  p.trade_rate_pending,
  p.selling_price,
  c.name as category_name,
  b.name as brand_name
from products p
left join categories c on c.id = p.category_id
left join brands b on b.id = p.brand_id
where p.wholesale_price is null
  and not p.is_deleted
  and p.is_available;

comment on view v_products_wholesale_baqi is
  'Jin par thok ka rate darj nahi. Thok wala gahak aane se PEHLE ye fehrist dekhi jani chahiye (245).';
