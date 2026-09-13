-- =====================================================================
-- AgriBridge — Migration 250: Sidebar ke baghair dashboards
-- =====================================================================
-- Malik ka faisla (locked): Master Admin ko poori ERP navigation, baqi
-- sab ko "Mera Kaam" ka safha. Koi permanent sidebar nahi. Jis cheez ki
-- ijazat nahi, us ka card nahi. Card → us kaam ka safha → wapas Mera
-- Kaam.
--
-- Do cheezein yahan bharti hain:
--
-- ---------------------------------------------------------------------
-- 1) features.description -- card ka doosra jumla
-- ---------------------------------------------------------------------
-- Ab tak cards DEPARTMENT ke darje par the (Milk, Finance, Machinery),
-- aur doosra jumla dashboards ke paas tha. Naqsha cards ko FEATURE ke
-- darje par le jata hai -- POS, Orders, Customers, Returns -- aur wahan
-- doosra jumla features ke paas hona chahiye.
--
-- Sirf "POS" likha card kaam nahi karta. Naya banda "POS" parh kar ye
-- nahi jaanta ke andar kya milega; "POS — Bikri aur bill" parh kar jaan
-- jata hai. Ye jumla teen zabanon mein rehta hai, bilkul labels ki
-- tarah.
--
-- ---------------------------------------------------------------------
-- 2) Ek switch, taake wapas mur-na ek line ka kaam ho
-- ---------------------------------------------------------------------
-- Sidebar hata dena har us bande ka raasta badal deta hai jo Master
-- Admin nahi. Faisla ho chuka hai, magar agar us din counter par kuch
-- ulajh jaye to poora build wapas karna sahi hal nahi hota.
--
--   update platform_settings
--      set value = '{"enabled": false}'::jsonb
--    where key = 'sidebar_free_dashboards';
--
-- Itna kehne par purani sidebar wapas aa jati hai, bina deploy ke.
-- Ye peechhe hatne ka darwaza hai, faisle par shak nahi.
-- =====================================================================

alter table features
  add column if not exists description text,
  add column if not exists description_en text,
  add column if not exists description_ur text;

comment on column features.description is
  'Card ka doosra jumla -- "Bikri aur bill". Roman hamesha bhara, baqi do khali ho sakte hain (250).';

-- ---------------------------------------------------------------------
-- Roz chalne wale safhon ke doosre jumle
-- ---------------------------------------------------------------------
-- Sab features ke nahi likhe ja rahe -- sirf wo jin par staff roz jata
-- hai. Jahan jumla nahi, wahan card par sirf naam aata hai; khali jagah
-- par kuch bana bana kar likhna us se bura hota, kyunke ghalat jumla
-- bande ko ghalat safhe par bhejta hai.
update features set
  description    = coalesce(v.rm, features.description),
  description_en = coalesce(v.en, features.description_en),
  description_ur = coalesce(v.ur, features.description_ur)
from (values
  ('pos',                'Bikri aur bill',                    'Sales & billing',            'فروخت اور بل'),
  ('products',           'Products ki fehrist aur rate',      'Product list & rates',       'پروڈکٹ کی فہرست اور ریٹ'),
  ('products.intake',    'Maal andar lena -- scan aur photo', 'Bring stock in',             'مال اندر لینا'),
  ('products.bill_rates','Supplier ke bill se lagat',         'Cost from supplier bill',    'سپلائر کے بل سے لاگت'),
  ('inventory',          'Kaunsi cheez kitni pari hai',       'What is in stock',           'کون سی چیز کتنی پڑی ہے'),
  ('crm',                'Gahak aur un ka khata',             'Customers & their khata',    'گاہک اور ان کا کھاتہ'),
  ('suppliers',          'Supplier aur un ka dena',           'Suppliers & payables',       'سپلائر اور ان کا دینا'),
  ('hr.attendance',      'Hazri ka calendar',                 'Attendance calendar',        'حاضری کیلنڈر'),
  ('hr.leave',           'Chhutti ki darkhwastein',           'Leave requests',             'چھٹی کی درخواستیں'),
  ('my-attendance',      'Apni hazri aur check-in',           'My attendance & check-in',   'اپنی حاضری اور چیک ان'),
  ('cash-close',         'Raat ko cash ginna',                'Count the cash at night',    'رات کو کیش گننا')
) as v(key, rm, en, ur)
where features.key = v.key;

-- ---------------------------------------------------------------------
-- Switch
-- ---------------------------------------------------------------------
-- enabled = true: Master Admin ke ilawa sab ko sidebar ke baghair
--   safha milta hai (upar chhoti patti, aur "Mera Kaam" ka raasta).
-- master_roles: jin ko poori navigation milti rehti hai.
insert into platform_settings (key, value)
values ('sidebar_free_dashboards',
        '{"enabled": true, "master_roles": ["owner", "super_admin", "admin"]}'::jsonb)
on conflict (key) do nothing;
