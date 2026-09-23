-- =====================================================================
-- Migration 242: Products CSV wala safha menu mein
-- =====================================================================
-- is_sensitive = true. Ek file poora catalogue bana deti hai -- aur
-- ghalat file poora catalogue kharab bhi kar sakti hai. Us kharabi ka
-- pata mahine baad chalta hai jab qeematein ghalat nikalti hain.
--
-- Dashboard khud se nahi chuna gaya: jahan jahan "Products" ka safha
-- pehle se hai, wahin ye bhi lag jata hai. Naam se dashboard likh dene
-- par wo ek din us dashboard par lag jata jahan products hain hi nahi.

insert into public.features (key, label, label_en, label_ur, route, icon, is_sensitive, is_active) values
  ('products.import', 'Products CSV se', 'Import Products', 'پروڈکٹس فائل سے',
   '/admin/products/import', 'Upload', true, true)
on conflict (key) do update set
  route = excluded.route, icon = excluded.icon,
  label = excluded.label, label_en = excluded.label_en, label_ur = excluded.label_ur,
  is_sensitive = excluded.is_sensitive, is_active = true;

insert into public.dashboard_features (dashboard_key, feature_key, sort_order)
select d.dashboard_key, 'products.import', 19
from (select distinct dashboard_key from public.dashboard_features df
      join public.features f on f.key = df.feature_key
      where f.route = '/admin/products') d
on conflict (dashboard_key, feature_key) do update set
  sort_order = excluded.sort_order;
