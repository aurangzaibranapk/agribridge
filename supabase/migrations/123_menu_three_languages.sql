-- =====================================================================
-- AgriBridge — Migration 123: Menu teen zabanon mein
-- =====================================================================
-- Baqi safhe ka tarjuma dictionary (src/lib/i18n/translations.ts) se hota
-- hai, magar MENU ka nahi: us ke naam database mein hain --
-- features.label aur dashboards.label. Ye jaan boojh kar aisa hai (104
-- mein tay hua tha) taake naya safha banate waqt menu bhi wahin se ban
-- jaye, code badle baghair.
--
-- Us ka nateeja ye hai ke menu ka tarjuma bhi wahin karna paRega. Do naye
-- khane:
--
--   label     -> Roman Urdu (jo abhi likha hai, waisa hi rehta hai)
--   label_en  -> English
--   label_ur  -> اردو
--
-- Purana khana chhera nahi gaya. Us mein wohi likha hai jo aaj screen par
-- hai, aur agar naye khane khali hon to wohi dikhta hai -- yani adhoora
-- tarjuma bhi menu ko toRta nahi.
-- =====================================================================

alter table dashboards
  add column if not exists label_en text,
  add column if not exists label_ur text;

alter table features
  add column if not exists label_en text,
  add column if not exists label_ur text;

-- ---------------------------------------------------------------------
-- Dashboards (menu ke baRe hissay)
-- ---------------------------------------------------------------------
update dashboards set label_en = v.en, label_ur = v.ur
from (values
  ('master',    'Master Command',           'مرکزی کمانڈ'),
  ('milk',      'Milk',                     'دودھ'),
  ('grain',     'Grain',                    'اناج'),
  ('machinery', 'Machinery',                'مشینری'),
  ('sales',     'Sales & Retail',           'فروخت اور دکان'),
  ('inventory', 'Inventory & Warehouse',    'اسٹاک اور گودام'),
  ('purchase',  'Purchase',                 'خریداری'),
  ('finance',   'Finance',                  'مالیات'),
  ('fleet',     'Fleet & Logistics',        'گاڑیاں اور ترسیل'),
  ('hr',        'HR & Staff',               'عملہ'),
  ('website',   'Website',                  'ویب سائٹ'),
  ('ai',        'AI Command',               'اے آئی کمانڈ'),
  ('admin',     'Administration & Security','انتظامیہ اور حفاظت'),
  ('reports',   'Reports & Audit',          'رپورٹس اور جانچ')
) as v(key, en, ur)
where dashboards.key = v.key;

-- ---------------------------------------------------------------------
-- Features (menu ke andar ke safhe)
-- ---------------------------------------------------------------------
-- Jo abhi tak yahan nahi, wo apne purane naam par rehta hai -- menu tootta
-- nahi, bas us ek lafz ka tarjuma baqi rehta hai.
update features set label_en = v.en, label_ur = v.ur
from (values
  ('machinery-rental',            'Machinery Rental',          'مشینری کرایہ'),
  ('machinery-rental.dashboard',  'Machinery Dashboard',       'مشینری ڈیش بورڈ'),
  ('machinery-rental.list',       'Machinery Bookings List',   'مشینری بکنگ فہرست'),
  ('money-trail',                 'Where the Money Is',        'پیسہ کہاں ہے'),
  ('leakage',                     'Where Money Is Leaking',    'پیسہ کہاں سے نکل رہا ہے'),
  ('quantity-money',              'Quantity and Money',        'مقدار اور پیسہ'),
  ('anomalies',                   'Unusual Patterns',          'غیر معمولی ترتیب'),
  ('audit-trail',                 'Who Did What',              'کس نے کیا کیا'),
  ('field-watch',                 'Field Watch',               'میدان کی نگرانی'),
  ('ai-suggestions',              'AI Purchase Suggestions',   'اے آئی خریداری تجاویز'),
  ('ai-instructions',             'AI Instructions',           'اے آئی ہدایات'),
  ('bridge-ai',                   'Bridge AI',                 'برج اے آئی'),
  ('bridge-ai.action-requests',   'Bridge AI Action Requests', 'برج اے آئی درخواستیں'),
  ('bridge-ai.activity-log',      'Bridge AI Activity Log',    'برج اے آئی سرگرمی'),
  ('grain-procurement',           'Grain Procurement',         'اناج کی خریداری'),
  ('grain-procurement.dashboard', 'Grain Business Dashboard',  'اناج کاروبار ڈیش بورڈ'),
  ('grain-procurement.sell',      'Sell Grain',                'اناج بیچیں'),
  ('email-templates',             'Email Templates',           'ای میل ٹیمپلیٹ'),
  ('milk-collection.maintenance', 'Fleet & Maintenance',       'گاڑیاں اور مرمت')
) as v(key, en, ur)
where features.key = v.key;

comment on column features.label is
  'Roman Urdu (default). English ke liye label_en, Urdu ke liye label_ur -- khali hon to yahi dikhta hai.';
comment on column dashboards.label is
  'Roman Urdu (default). English ke liye label_en, Urdu ke liye label_ur -- khali hon to yahi dikhta hai.';
