-- =====================================================================
-- AgriBridge — Migration 739: Doodh Admin Dashboard ka menu (Milk & Dairy)
-- =====================================================================
-- Sirf Owner, Super Admin, Admin. Rollback: 739_milk_admin_dashboard_menu.rollback.sql
-- =====================================================================

insert into public.features (
  key, label, label_en, label_ur, description, description_en, description_ur, route, icon, is_sensitive, is_active
) values (
  'milk-collection.dashboard',
  'Doodh Admin Dashboard',
  'Milk Admin Dashboard',
  'دودھ ایڈمن ڈیش بورڈ',
  'Chart, trend, carrier aur chiller ka haal. Dhyan dene wali baatein ek jagah.',
  'Charts, trend, carrier and chiller status. Issues in one place.',
  'چارٹ، رجحان، کیریئر اور چلر کی حالت۔',
  '/admin/milk-collection/dashboard',
  'LayoutDashboard',
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
  is_sensitive = excluded.is_sensitive,
  is_active = true;

insert into public.role_feature_permissions (role, feature_key, actions, data_scope)
values
  ('owner', 'milk-collection.dashboard', array['view']::text[], 'all'),
  ('super_admin', 'milk-collection.dashboard', array['view']::text[], 'all'),
  ('admin', 'milk-collection.dashboard', array['view']::text[], 'all')
on conflict (role, feature_key) do update set
  actions = excluded.actions,
  data_scope = excluded.data_scope;

insert into public.dashboard_features (dashboard_key, feature_key, section, section_order, sort_order)
select 'milk', 'milk-collection.dashboard', 'Dairy', 3, 0
where exists (select 1 from public.dashboards where key = 'milk')
on conflict (dashboard_key, feature_key) do update set
  section = excluded.section,
  section_order = excluded.section_order,
  sort_order = excluded.sort_order;
