-- 533: Sidebar placement for the 15-16 Oct modules. ADDITIVE ONLY.
-- Sidebar = dashboards -> dashboard_features -> features. 529-532 added the
-- feature rows but no dashboard_features rows, so nothing showed in the
-- menu (not even for owner/admin). Demand Center (PR #84) had no feature
-- row at all. Existing rows are never updated (on conflict do nothing).

insert into public.features (key, label, label_en, label_ur, description, description_en, description_ur, route, icon, is_sensitive, is_active)
values ('demand-center', 'Demand Center', 'Demand Center', 'ڈیمانڈ سینٹر',
  'Kisanon ki product demand, review aur kharid planning', 'Farmer product demand, review and procurement planning', 'کسانوں کی پروڈکٹ ڈیمانڈ، جائزہ اور خرید منصوبہ بندی',
  '/admin/demand-center', 'ClipboardList', true, true)
on conflict (key) do nothing;

insert into public.dashboard_features (dashboard_key, feature_key, section, section_order, sort_order)
values
  ('procurement', 'demand-center',                 'Operations', 2, 5),
  ('master',      'business-360.owner',            'Overview',   1, 5),
  ('reports',     'intelligence.party',            'Reports',    5, 110),
  ('reports',     'intelligence.products',         'Reports',    5, 111),
  ('hr',          'staff-achievement.performance', 'Operations', 2, 210),
  ('admin',       'support.center',                'Operations', 2, 270)
on conflict (dashboard_key, feature_key) do nothing;
