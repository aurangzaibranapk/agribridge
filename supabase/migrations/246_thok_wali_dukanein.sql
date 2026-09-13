-- =====================================================================
-- AgriBridge — Migration 246: Thok wali dukanein
-- =====================================================================
-- 245 mein product par thok ka rate to aa gaya, magar wo rate KAB
-- lagega, ye tay nahi hua tha. Malik ka faisla: "wholesale customer par
-- jab karenge" -- aur us ki wazahat: "jahan par hum shops ko add karein
-- jinko hum stock provide karenge, unko hum wholesale ka rate lagayenge".
--
-- Yani thok ka rate BILL par nahi chunna, GAHAK par likha hota hai.
--
-- ---------------------------------------------------------------------
-- Rate bill par kyun nahi chuna jata
-- ---------------------------------------------------------------------
-- Aasan raasta ye tha ke counter par ek button ho: "thok" ya "retail".
-- Us raaste mein rate us bande ki marzi par aa jata hai jo counter par
-- khaRa hai -- aur mahine baad ye sawal ka koi jawab nahi hota ke falan
-- bill par thok ka rate KYUN laga tha.
--
-- Gahak ke record par likha ho to jawab hamesha maujood rehta hai: wo
-- dukan hai jise hum maal dete hain. Aur us par faisla ek dafa hota
-- hai, har bill par nahi.
--
-- ---------------------------------------------------------------------
-- Alag table kyun nahi banaya
-- ---------------------------------------------------------------------
-- "Shops jinko hum supply karte hain" ke liye naya table banane ka
-- khayal aaya tha. Magar customers ka table pehle se wohi cheez hai:
-- naam, phone, pata, udhaar ki hadd (credit_limit), aur us par chalta
-- hua khata (current_balance). Naya table banane ka matlab hota ke
-- udhaar do jagah chalta -- aur ek din dono adad alag ho jate.
--
-- NOTE: `shops` wala table HAMARI apni dukanon ka hai (us par
-- organization_id aur branch_id hai). Us mein bahar wali dukanein
-- daalna do bilkul alag cheezon ko ek jagah rakh dena hota.
-- =====================================================================

alter table customers
  add column if not exists customer_type text not null default 'retail';

alter table customers drop constraint if exists chk_customer_type;
alter table customers add constraint chk_customer_type
  check (customer_type in ('retail', 'wholesale_shop'));

comment on column customers.customer_type is
  'retail = aam gahak (retail rate). wholesale_shop = wo dukan jise hum maal dete hain -- us par thok ka rate lagta hai (246).';

create index if not exists idx_customers_wholesale
  on customers (customer_type)
  where customer_type = 'wholesale_shop';

-- ---------------------------------------------------------------------
-- Thok wali dukanon ki fehrist
-- ---------------------------------------------------------------------
create or replace view v_wholesale_shops as
select
  c.id,
  c.name,
  c.contact_person,
  c.phone_number,
  c.address,
  c.credit_limit,
  c.current_balance,
  c.payment_due_days,
  c.is_active,
  c.created_at
from customers c
where c.customer_type = 'wholesale_shop'
  and not c.is_deleted;

comment on view v_wholesale_shops is
  'Wo dukanein jinhen hum maal dete hain. In par thok ka rate khud lagta hai (246).';
