-- =====================================================================
-- AgriBridge — Migration 131: Department card ka doosra jumla
-- =====================================================================
-- Malik ka faisla: staff ko poora ERP sidebar dene ke bajaye DEPARTMENT
-- CARDS milein -- aur sirf wohi cards jo usay assign hue hon.
--
--   Login  ->  Mera Kaam  ->  Department cards  ->  us ka apna kaam
--
-- Achi baat ye ke is ki buniyad pehle se maujood thi. dashboards ki
-- fehrist HI department hain (104 mein banai gayi thi), aur loadNav()
-- pehle se ijazat ke mutabiq chhaant kar deta hai -- yani "sirf apne
-- cards" wala qanoon naya nahi banana paRa, wo pehle se chal raha tha.
-- Sirf us ki SHAKAL badalni hai: fehrist ki jagah card.
--
-- Card par char cheezein chahiye: nishan, naam, ek chhota jumla, aur
-- baqi kaam ki ginti. Pehli do maujood thin. Teesri ye migration daal
-- rahi hai.
--
-- Jumla database mein rakha ja raha hai, code mein nahi -- wohi wajah jo
-- 104 mein thi: naya department banate waqt us ka card bhi wahin se ban
-- jaye, kisi file ko haath lagaye baghair.
--
-- Teenon zabanein sath hi (123 ki tarah): `description` Roman hai,
-- description_en aur description_ur alag. Khali hon to Roman dikhta hai.
-- =====================================================================

alter table dashboards
  add column if not exists description text,
  add column if not exists description_en text,
  add column if not exists description_ur text;

update dashboards set description = v.rm, description_en = v.en, description_ur = v.ur
from (values
  ('master',    'Poora karobar ek nazar mein',   'The whole business at a glance',  'پورا کاروبار ایک نظر میں'),
  ('milk',      'Doodh, chiller aur FAT',        'Milk, chiller and FAT',           'دودھ، چلر اور فیٹ'),
  ('grain',     'Kharidari, godam aur bikri',    'Procurement, warehouse and sale', 'خریداری، گودام اور بکری'),
  ('machinery', 'Booking se kattai tak',         'Booking through harvesting',      'بکنگ سے کٹائی تک'),
  ('sales',     'POS aur orders',                'POS and orders',                  'پی او ایس اور آرڈر'),
  ('inventory', 'Stock aur godam',               'Stock and warehouse',             'اسٹاک اور گودام'),
  ('purchase',  'Orders aur suppliers',          'Orders and suppliers',            'آرڈر اور سپلائر'),
  ('finance',   'Cash book, khata aur bank',     'Cash book, khata and bank',       'کیش بک، کھاتہ اور بینک'),
  ('fleet',     'Gaariyan aur delivery',            'Vehicles and delivery',           'گاڑیاں اور ترسیل'),
  ('hr',        'Hazri, tankhwah aur staff',     'Attendance, salary and staff',    'حاضری، تنخواہ اور عملہ'),
  ('website',   'Safhe aur paighamat',           'Pages and messages',              'صفحات اور پیغامات'),
  ('ai',        'AI ke mashware aur ijazat',     'AI suggestions and approvals',    'اے آئی کے مشورے اور اجازت'),
  ('admin',     'Ijazat, shakhein aur hifazat',  'Permissions, branches, security', 'اجازت، شاخیں اور حفاظت'),
  ('reports',   'Rapten aur jaanch',             'Reports and audit',               'رپورٹس اور جانچ')
) as v(key, rm, en, ur)
where dashboards.key = v.key;

comment on column dashboards.description is
  'Card ka doosra jumla (Roman Urdu). English ke liye description_en, Urdu ke liye description_ur.';
