-- =====================================================================
-- AgriBridge — Migration 241: "Trade rate abhi maloom nahi" ka khana
-- =====================================================================
-- products.purchase_price NOT NULL hai aur us ka default SIFAR hai.
-- Ye us waqt tak theek tha jab product ek ek kar ke haath se banta tha
-- aur rate likhe baghair form aage baRhta hi nahi tha.
--
-- Ab do naye raaste khul rahe hain jahan rate SHURU MEIN NAHI HOTA:
--   1. CSV se poora catalogue ek dafa mein charhta hai -- naam aur sale
--      rate to hain, trade rate supplier ke bill se baad mein aayega.
--   2. Supplier ka bill parh kar rate bharne wala kaam.
--
-- Aur yahin wo ghalti khaRi hoti hai jis se ye project bachta aaya hai:
-- purchase_price = 0 ka matlab hai "ye cheez muft aayi thi", yani us par
-- munafa SAU FEESAD. Aur ye adad kisi report mein laal nishan nahi
-- banata -- wo chup chaap munafe mein juRta rehta hai.
--
-- "Sifar" aur "hisaab nahi rakha gaya" ek cheez nahi. Is liye ek alag
-- khana: trade_rate_pending. Jab tak ye TRUE hai, purchase_price ko
-- asal lagat nahi samjha jata -- safhe par "trade rate abhi nahi"
-- likha aata hai, Rs 0 nahi.
--
-- purchase_price ko nullable banana zyada saaf hota, magar wo khana 79
-- jagah parha jata hai. Un sab ko ek din mein badalna wo qism ka kaam
-- hai jis mein ek jagah chhoot jati hai -- aur wohi jagah tankhwah ya
-- munafe ka hisaab bana rahi hoti hai.
-- =====================================================================

alter table products
  add column if not exists trade_rate_pending boolean not null default false;

comment on column products.trade_rate_pending is
  'TRUE = trade rate abhi maloom nahi (purchase_price ko lagat na samjha jaye). Sifar aur "pata nahi" ek cheez nahi (241).';

-- Purane sab products ka rate maloom hai -- un par nishan nahi lagta.
-- Sirf wo qatarein jin ka rate waqai sifar hai, un par sawal banta
-- hai; magar unhen khud se badalna bhi ghalat hoga, kyunke ho sakta
-- hai wo waqai muft mila ho (sample, tohfa).
update products
   set trade_rate_pending = false
 where trade_rate_pending is null;

create index if not exists idx_products_trade_rate_pending
  on products (trade_rate_pending)
  where trade_rate_pending;

-- ---------------------------------------------------------------------
-- Kin ka trade rate baqi hai
-- ---------------------------------------------------------------------
-- Ye fehrist na ho to nishan lag kar bhool jata hai, aur mahine baad
-- munafa ghalat nikalta hai bina kisi ke jaane.
create or replace view v_products_trade_rate_baqi as
select
  p.id,
  p.name,
  p.pack_size,
  p.barcode,
  p.selling_price,
  p.mrp_price,
  c.name as category_name,
  b.name as brand_name,
  p.created_at
from products p
left join categories c on c.id = p.category_id
left join brands b on b.id = p.brand_id
where p.trade_rate_pending
  and not p.is_deleted;

comment on view v_products_trade_rate_baqi is
  'Jin products ka trade rate abhi bharna hai. Nishan lag kar bhool jane se bachne ke liye (241).';
