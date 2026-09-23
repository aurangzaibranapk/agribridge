-- Sidebar mein Shop 360 / Zero-Leakage aur POS Shift Report (Boss, 19
-- September): "shop-360 sidebar mein kahin bhi nahi aa raha" -- menu
-- database (features + dashboard_features) se banta hai, aur ye safhe
-- ya to kisi dashboard se juray nahi the (shop-360, reports.pos-shifts
-- Live par) ya un ka feature hi nahi tha (org/branch/match).
--
-- Idempotent hai: Testing par jo link pehle se hai wo conflict par
-- waise ka waisa rehta hai.

insert into features (key, label, label_en, label_ur, route, icon, description)
values
  (
    'shop-360.match',
    'Shop Match (Zero-Leakage)',
    'Shop Match (Zero-Leakage)',
    'شاپ میچ (زیرو لیکیج)',
    '/admin/shop-360/match',
    'ClipboardCheck',
    'Ek shop ka stock-sale-cash milaan: selling-rate stock equation, POS sale ka farq, cash ka farq -- leakage yahan pakri jati hai.'
  ),
  (
    'shop-360.branch',
    'Branch ka Milaan',
    'Branch Reconciliation',
    'برانچ کا ملان',
    '/admin/shop-360/branch',
    'Building2',
    'Branch ki sab shops ka zero-leakage khulasa ek jagah -- kaun si shop matched hai, kahan farq hai.'
  ),
  (
    'shop-360.org',
    'Company ka Milaan (Org)',
    'Organization Reconciliation',
    'کمپنی کا ملان',
    '/admin/shop-360/org',
    'Landmark',
    'Company -> Branch -> Shop: poori organization ka zero-leakage status ek nazar mein, branch-wise drill-down ke sath.'
  )
on conflict (key) do update
  set route = excluded.route, is_active = true;

insert into dashboard_features (dashboard_key, feature_key, sort_order, section, section_order)
values
  -- Live par ye do link ghayab the (Testing par maujood the):
  ('shops',   'shop-360',           15, null, 0),
  ('reports', 'reports.pos-shifts', 25, null, 0),
  -- Audit & Control mein poori Zero-Leakage chain ek sarkhi ke neeche:
  ('audit', 'shop-360',        10, 'Zero-Leakage', 3),
  ('audit', 'shop-360.match',  20, 'Zero-Leakage', 3),
  ('audit', 'shop-360.branch', 30, 'Zero-Leakage', 3),
  ('audit', 'shop-360.org',    40, 'Zero-Leakage', 3)
on conflict (dashboard_key, feature_key) do nothing;
