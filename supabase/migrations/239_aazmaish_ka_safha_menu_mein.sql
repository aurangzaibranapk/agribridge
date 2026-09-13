-- =====================================================================
-- Migration 239: Aazmaish ka safha menu mein
-- =====================================================================
-- is_sensitive = true. Yahan se kisi ko pakka kiya jata hai aur kisi ko
-- alag. Ye faisla har staff ke saamne khulna nahi chahiye -- gaon ke
-- karobar mein wo baat safhe se pehle bahar pahunch jati hai.

insert into public.features (key, label, label_en, label_ur, route, icon, is_sensitive, is_active) values
  ('hr.probation', 'Aazmaishi Muddat', 'Probation', 'آزمائشی مدت',
   '/admin/hr/probation', 'UserCheck', true, true)
on conflict (key) do update set
  route = excluded.route, icon = excluded.icon,
  label = excluded.label, label_en = excluded.label_en, label_ur = excluded.label_ur,
  is_sensitive = excluded.is_sensitive, is_active = true;

insert into public.dashboard_features (dashboard_key, feature_key, sort_order) values
  ('hr', 'hr.probation', 14)
on conflict (dashboard_key, feature_key) do update set
  sort_order = excluded.sort_order;
