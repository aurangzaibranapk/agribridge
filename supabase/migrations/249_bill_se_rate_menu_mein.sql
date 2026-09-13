-- =====================================================================
-- Migration 249: "Bill se Trade Rate" ka safha menu mein
-- =====================================================================
-- is_sensitive = true. Yahan se products ki LAGAT badalti hai, aur
-- lagat har munafe ke adad ki bunyad hai. Ek ghalat rate chup chaap
-- har report mein chala jata hai.
--
-- Dashboard khud se nahi chuna gaya: jahan "Products" ka safha pehle
-- se hai, wahin ye bhi lag jata hai.

insert into public.features (key, label, label_en, label_ur, route, icon, is_sensitive, is_active) values
  ('products.bill_rates', 'Bill se Trade Rate', 'Trade Rate from Bill', 'بل سے ٹریڈ ریٹ',
   '/admin/products/bill-rates', 'ReceiptText', true, true)
on conflict (key) do update set
  route = excluded.route, icon = excluded.icon,
  label = excluded.label, label_en = excluded.label_en, label_ur = excluded.label_ur,
  is_sensitive = excluded.is_sensitive, is_active = true;

insert into public.dashboard_features (dashboard_key, feature_key, sort_order)
select d.dashboard_key, 'products.bill_rates', 19
from (select distinct dashboard_key from public.dashboard_features df
      join public.features f on f.key = df.feature_key
      where f.route = '/admin/products') d
on conflict (dashboard_key, feature_key) do update set
  sort_order = excluded.sort_order;
