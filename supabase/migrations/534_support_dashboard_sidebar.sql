-- 534: "Support Dashboard" ka apna sidebar item (Administration). ADDITIVE ONLY.
-- /admin/my-work/support-dashboard (PR #81) ke liye koi feature row nahi tha.
insert into public.features (key, label, label_en, label_ur, description, description_en, description_ur, route, icon, is_sensitive, is_active)
values ('support.dashboard', 'Support Dashboard', 'Support Dashboard', 'سپورٹ ڈیش بورڈ',
  'Development support: issue response, agent progress, approvals', 'Development support: issue response, agent progress, approvals', 'ڈیولپمنٹ سپورٹ: مسائل، ایجنٹ پیش رفت، منظوری',
  '/admin/my-work/support-dashboard', 'Bug', true, true)
on conflict (key) do nothing;

insert into public.dashboard_features (dashboard_key, feature_key, section, section_order, sort_order)
values ('admin', 'support.dashboard', 'Operations', 2, 271)
on conflict (dashboard_key, feature_key) do nothing;
