-- =====================================================================
-- AgriBridge — Migration 265: Inventory & Warehouse ka menu saaf
-- =====================================================================
-- Malik ka faisla (2 September): Inventory ke menu mein 25 cheezein
-- thin, jin mein saat ek hi kaam (product ka setup) ke alag alag
-- marhale the, aur paanch (Fertilizer, Pesticide, Seeds, Wanda,
-- Grocery) sirf qism ke filter. Staff ko yaad rakhna paRta tha ke rate
-- "Maal Andar" mein bharna hai, "Rate Baqi" mein ya "Adhoore Products"
-- mein. Ab ek jagah: Product Setup.
--
-- Naya menu (das cheezein, chaar sarkhi):
--   PRODUCTS   Products / Product Setup / Product Masters
--   STOCK      Stock / Stock Ledger / Stock Transfers / Stock Returns /
--              Maal ki Ginti
--   WAREHOUSE  Warehouses / Receiving
--   REPORTS    Inventory Reports
--
-- Koi safha mitaya nahi gaya. Jo menu se hataye gaye wo Product Setup
-- ke tabs se khulte hain (Maal Andar, Bill se Rate, Rate Baqi,
-- Propose, Pending, Pending Edits, Barcode Label, CSV). Qism wale
-- dashboards Sales ke menu mein waise hi hain; Products par qism ka
-- filter hai. "Kya Mangwana Hai" Purchase ke menu mein gaya -- wo
-- purchase banata hai.
-- =====================================================================

insert into public.features (key, label, label_en, label_ur, description, description_en, description_ur,
                             route, icon, is_sensitive, is_active) values
  ('products.setup', 'Product Setup', 'Product Setup', 'پروڈکٹ سیٹ اپ',
   'Naya product, manzoori, rate, barcode, tasveer, miyaad -- sab ek jagah',
   'New products, approval, rates, barcodes, photos, expiry -- one workspace',
   'نیا پروڈکٹ، منظوری، ریٹ، بارکوڈ، تصویر، میعاد -- سب ایک جگہ',
   '/admin/products/setup', 'ListChecks', true, true),
  ('product-masters', 'Product Masters', 'Product Masters', 'پروڈکٹ ماسٹرز',
   'Qismein, brand aur companies', 'Categories, brands and companies', 'قسمیں، برانڈ اور کمپنیاں',
   '/admin/products/masters', 'Layers', false, true),
  ('inventory.receiving', 'Receiving', 'Receiving', 'ریسیونگ',
   'Jo maal aana hai: supplier ki purchase aur shop ke order', 'Stock waiting to be counted in: supplier purchases and shop orders', 'جو مال آنا ہے: سپلائر کی پرچیز اور شاپ کے آرڈر',
   '/admin/inventory/receiving', 'PackageCheck', true, true)
on conflict (key) do update set
  route = excluded.route, icon = excluded.icon,
  label = excluded.label, label_en = excluded.label_en, label_ur = excluded.label_ur,
  description = excluded.description, description_en = excluded.description_en,
  description_ur = excluded.description_ur,
  is_sensitive = excluded.is_sensitive, is_active = true;

update public.features
   set label = 'Stock Returns', label_en = 'Stock Returns', label_ur = 'اسٹاک ریٹرن',
       description = coalesce(description, 'Shop se wapas aaya maal'),
       description_en = coalesce(description_en, 'Stock coming back from shops')
 where key = 'agri-returns';

update public.features
   set label = 'Stock', label_en = 'Stock', label_ur = 'اسٹاک'
 where key = 'inventory';

update public.features
   set label = 'Inventory Reports', label_en = 'Inventory Reports', label_ur = 'انوینٹری رپورٹس'
 where key = 'reports.inventory';

-- Inventory dashboard ka menu naye sire se
delete from public.dashboard_features where dashboard_key = 'inventory';

insert into public.dashboard_features (dashboard_key, feature_key, section, section_order, sort_order)
select 'inventory', v.feature_key, v.section, v.section_order, v.sort_order
from (values
  ('products',             'PRODUCTS',  1, 10),
  ('products.setup',       'PRODUCTS',  1, 11),
  ('product-masters',      'PRODUCTS',  1, 12),
  ('inventory',            'STOCK',     2, 20),
  ('stock-ledger',         'STOCK',     2, 21),
  ('stock-transfers',      'STOCK',     2, 22),
  ('agri-returns',         'STOCK',     2, 23),
  ('stock-count',          'STOCK',     2, 24),
  ('inventory.warehouses', 'WAREHOUSE', 3, 30),
  ('inventory.receiving',  'WAREHOUSE', 3, 31),
  ('reports.inventory',    'REPORTS',   4, 40)
) as v(feature_key, section, section_order, sort_order)
where exists (select 1 from public.features f where f.key = v.feature_key);

-- Kya Mangwana Hai -> Purchase ka menu
insert into public.dashboard_features (dashboard_key, feature_key, sort_order)
values ('purchase', 'products.reorder', 13)
on conflict (dashboard_key, feature_key) do update set sort_order = excluded.sort_order;
