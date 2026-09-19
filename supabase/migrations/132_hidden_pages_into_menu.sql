-- =====================================================================
-- AgriBridge — Migration 132: Jo safhe bane hue the magar milte nahi the
-- =====================================================================
-- Malik ne har department ke liye features ki fehrist di. Us fehrist ko
-- maujooda nizam se mila kar dekha to ek baat saamne aayi jo ummeed se
-- behtar thi: zyada tar cheezein PEHLE SE BANI HUI hain -- data bhi,
-- safha bhi. Wo sirf MENU mein darj nahi thin, is liye kisi ko milti hi
-- nahi thin.
--
-- Safha bana kar menu mein na daalna sab se chupi hui qism ki barbadi
-- hai: kaam ho chuka hota hai, paisa lag chuka hota hai, aur us ka koi
-- faida nahi hota kyunke us tak koi pahunch hi nahi sakta.
--
-- Ye migration koi naya safha nahi banati. Sirf wo darwaze kholti hai jo
-- pehle se bane hue the.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Grain Ledger -- pehle se maujood tha
-- ---------------------------------------------------------------------
-- /admin/grain-procurement/statement kisan ka anaj ka poora khata
-- dikhata hai: kitna diya, kitna paisa mila, kitna baqi. Malik ki
-- fehrist mein ye "Grain Ledger" ke naam se hai.
insert into features (key, label, route, icon, label_en, label_ur)
values ('grain-procurement.statement', 'Anaj ka Khata', '/admin/grain-procurement/statement', 'BookOpen',
        'Grain Ledger', 'اناج کا کھاتہ')
on conflict (key) do update set label = excluded.label, route = excluded.route,
  label_en = excluded.label_en, label_ur = excluded.label_ur;

insert into dashboard_features (dashboard_key, feature_key, sort_order)
values ('grain', 'grain-procurement.statement', 25) on conflict do nothing;

-- ---------------------------------------------------------------------
-- 2) Jo safhe ghalat department mein the
-- ---------------------------------------------------------------------
-- Stock Count sirf master, finance aur admin par tha -- yani godam ka
-- banda, jo asal mein ginti karta hai, use dekh hi nahi sakta tha.
insert into dashboard_features (dashboard_key, feature_key, sort_order)
values ('inventory', 'stock-count', 25) on conflict do nothing;

-- Field Watch khet par kaam ki nigrani hai. Wo master aur admin par tha;
-- malik ki fehrist mein ye HR ke neeche "Field Activity" hai -- aur wahi
-- theek hai, kyunke dekhne wala staff ka manager hota hai.
insert into dashboard_features (dashboard_key, feature_key, sort_order)
values ('hr', 'field-watch', 30) on conflict do nothing;

-- Supplier ko adaigi finance par thi. Kharidari karne wale ko bhi
-- chahiye -- wohi jaanta hai kis supplier ka kya baqi hai.
insert into dashboard_features (dashboard_key, feature_key, sort_order)
values ('purchase', 'payouts', 25) on conflict do nothing;

-- ---------------------------------------------------------------------
-- 3) Teen safhe jo kisi bhi menu mein nahi the
-- ---------------------------------------------------------------------
insert into features (key, label, route, icon, label_en, label_ur)
values
  ('business-dashboard', 'Karobar ka Dashboard', '/admin/business-dashboard', 'TrendingUp',
   'Business Dashboard', 'کاروبار کا ڈیش بورڈ'),
  ('inventory.warehouses', 'Godam', '/admin/inventory/warehouses', 'Warehouse',
   'Warehouses', 'گودام'),
  ('subscriptions', 'Subscriptions', '/admin/subscriptions', 'Repeat',
   'Subscriptions', 'سبسکرپشن')
on conflict (key) do update set label = excluded.label, route = excluded.route,
  label_en = excluded.label_en, label_ur = excluded.label_ur;

insert into dashboard_features (dashboard_key, feature_key, sort_order) values
  ('master',    'business-dashboard',    15),
  ('inventory', 'inventory.warehouses',  15),
  ('sales',     'subscriptions',         30)
on conflict do nothing;
