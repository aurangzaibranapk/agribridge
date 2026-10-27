-- =====================================================================
-- 719: Aaj ka Sales Dashboard — feature + help
-- =====================================================================
-- Naya table nahi. Koi rate ya bikri nahi badalti. Sirf staff help aur
-- dashboard card, taake /admin/reports/sales/analytics ka "?" khali na ho.
-- Safha pehle se /admin/reports/sales ki ijazat se khulta hai.

insert into public.features (key, label, label_en, label_ur, description, description_en, description_ur, route, icon, is_sensitive, is_active)
values (
  'reports.sales-analytics',
  'Aaj ka Sales Dashboard',
  'Today sales dashboard',
  'آج کا سیلز ڈیش بورڈ',
  'Aaj ki bikri, category, orders, kam stock. Munafa sirf owner/admin jab cost darj ho.',
  'Today sales, category, orders, low stock. Profit only for owner/admin when cost is recorded.',
  'آج کی فروخت، قسم، آرڈر، کم اسٹاک۔ منافع صرف اونر/ایڈمن جب لاگت درج ہو۔',
  '/admin/reports/sales/analytics',
  'BarChart3',
  true,
  true
)
on conflict (key) do update set
  label = excluded.label,
  label_en = excluded.label_en,
  label_ur = excluded.label_ur,
  description = excluded.description,
  description_en = excluded.description_en,
  description_ur = excluded.description_ur,
  route = excluded.route,
  icon = excluded.icon,
  is_sensitive = true,
  is_active = true;

insert into public.role_feature_permissions (role, feature_key, actions, data_scope)
values
  ('owner', 'reports.sales-analytics', array['view']::text[], 'all'),
  ('super_admin', 'reports.sales-analytics', array['view']::text[], 'all'),
  ('admin', 'reports.sales-analytics', array['view']::text[], 'all')
on conflict (role, feature_key) do update set
  actions = excluded.actions,
  data_scope = excluded.data_scope;

insert into public.feature_help (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
values (
  'reports.sales-analytics', 'rm',
  'Aaj (Pakistan time) kitni bikri hui, kitne orders, Khaad / Beej / Doodh / Karyana alag, aur kin cheezon ka stock hadd se neeche hai.',
  'Owner aur Admin poori company aur munafa. Sales staff sirf apni dukan, bina munafa.',
  'Subah ya shaam, jab aaj ka hisaab ek nazar mein chahiye. Poori report alag safhe par rehti hai.',
  array[
    'Reports mein Aaj ka Sales Dashboard kholen.',
    'Total, orders, aur category ki bars dekhein. Khali din par Rs 0 sach hai.',
    'Munafa tab hai jab bill par cost darj ho. Dash ka matlab cost nahi, sifar nahi.',
    'Low stock sirf un cheezon ki hai jin par min stock lagi ho.',
    'Poori sale report ya stock safhe par jaayein agar detail chahiye.'
  ],
  'Mera Kaam se Reports, phir Aaj ka Sales Dashboard. Agla qadam: kam stock ho to Inventory.',
  array[
    'Sample number mat samjhein. Khali query ka Rs 0 alag hai, error alag.',
    'Munafa staff ko nahi dikhta.',
    'Jis cheez par hadd nahi, us ko kam stock mat ginein.'
  ]
)
on conflict (feature_key, lang) do update set
  purpose = excluded.purpose,
  who_uses = excluded.who_uses,
  when_use = excluded.when_use,
  how_steps = excluded.how_steps,
  next_step = excluded.next_step,
  mistakes = excluded.mistakes;

insert into public.dashboard_features (dashboard_key, feature_key, section, section_order, sort_order)
values
  ('reports', 'reports.sales-analytics', 'Reports', 5, 40),
  ('sales', 'reports.sales-analytics', 'Reports', 4, 20)
on conflict (dashboard_key, feature_key) do update set
  section = excluded.section,
  section_order = excluded.section_order,
  sort_order = excluded.sort_order;
