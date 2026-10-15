-- 531: Party & Product Intelligence -- feature registry rows only (sidebar/permissions).
-- ADDITIVE. The pages read existing tables; no table or row is changed.
insert into public.features (key, label, label_en, label_ur, description, description_en, description_ur, route, icon, is_sensitive, is_active)
values
  ('intelligence.party', 'Party 360', 'Party 360', 'پارٹی 360',
   'Kisan, customer, dealer, supplier, kharidar, sarmayakar, staff -- poora len den', 'Farmer, customer, dealer, supplier, buyer, investor, staff -- full picture', 'کسان، گاہک، ڈیلر، سپلائر، خریدار، سرمایہ کار، اسٹاف',
   '/admin/intelligence', 'Users', true, true),
  ('intelligence.products', 'Product Intelligence', 'Product Intelligence', 'پروڈکٹ انٹیلیجنس',
   'Khareed/bikri, munafa, chalna, miyaad, supplier rate', 'Purchase/sale, margin, movement, expiry, supplier rates', 'خرید/بکری، منافع، رفتار، میعاد',
   '/admin/intelligence/products', 'LineChart', true, true)
on conflict (key) do nothing;
