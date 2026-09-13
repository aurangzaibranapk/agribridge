-- =====================================================================
-- AgriBridge — Migration 247: Karyana ke khane aur zarai ke khane
-- =====================================================================
-- Product ka form zarai maal ke liye bana tha: Active Ingredient,
-- Composition, Dose, Usage Instructions, Safety Information. Khaad,
-- zeher aur wanda par ye khane LAZMI hain -- bina in ke wo maal bechna
-- theek nahi.
--
-- Magar biscuit ke dabbe par in mein se ek bhi nahi hota. Karyana ka
-- banda form kholta hai aur paanch khali khane dekhta hai jinka us ke
-- maal se koi taalluq nahi. Wo khane bhare nahi jate, aur jo form aadha
-- khali bhara jata ho us ke baqi khane bhi halke ho jate hain.
--
-- ---------------------------------------------------------------------
-- Faisla qism (category) par rakha gaya, product par nahi
-- ---------------------------------------------------------------------
-- Do aur raaste the:
--   * form par ek switch "zarai hai ya karyana" -- har product par wohi
--     sawal dobara, aur ek din koi ghalat chun deta.
--   * naam se andaza ("pesticide" likha ho to zarai) -- ye us din
--     tootta hai jis din qism ka naam Urdu mein likha jaye.
--
-- Qism par likhne se faisla EK DAFA hota hai: "Khaad" zarai hai, "Chai"
-- karyana. Us ke baad har product apni qism se khud jaan leta hai ke us
-- par kaun se khane chahiyen.
--
-- ---------------------------------------------------------------------
-- Purani qismein 'agri' likhi ja rahi hain
-- ---------------------------------------------------------------------
-- Abhi tak ka poora catalogue zarai hai (khaad, zeher, beej). Un ko
-- 'karyana' likh dena un ke maujooda khane (dose, safety) chhupa deta
-- -- aur wo maal aisa hai jis par safety ka na dikhna waqai khatra hai.
--
-- Nayi qismein (karyana wali) default se 'karyana' banengi, yani saada
-- form.
-- =====================================================================

alter table categories
  add column if not exists category_kind text not null default 'karyana';

alter table categories drop constraint if exists chk_category_kind;
alter table categories add constraint chk_category_kind
  check (category_kind in ('karyana', 'agri'));

-- Jo qismein pehle se hain, wo sab zarai hain.
update categories set category_kind = 'agri' where category_kind = 'karyana';

comment on column categories.category_kind is
  'agri = khaad/zeher/wanda -- form par dose, composition, safety ke khane aate hain. karyana = saada form (247).';

-- ---------------------------------------------------------------------
-- Karyana mein stock ki hadd 50
-- ---------------------------------------------------------------------
-- Malik ka usool: karyana mein sab par 50. Ye khana khali chhoR dena
-- aasan hai, aur phir "kam stock" ki koi khabar aati hi nahi -- maal
-- khatam hone ka pata gahak ke poochhne par chalta hai.
--
-- Ye DEFAULT hai, taala nahi: kisi cheez par alag hadd chahiye to form
-- par badal di ja sakti hai.
alter table categories
  add column if not exists default_min_stock numeric(14,3);

comment on column categories.default_min_stock is
  'Is qism ke naye product par "kam stock" ki hadd khud bhar jati hai. Karyana par 50 (247).';

update categories
   set default_min_stock = 50
 where category_kind = 'karyana'
   and default_min_stock is null;
