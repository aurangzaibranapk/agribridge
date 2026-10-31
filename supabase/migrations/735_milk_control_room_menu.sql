-- =====================================================================
-- AgriBridge — Migration 735: Doodh Control Room sidebar mein
-- =====================================================================
-- Sidebar ka menu database se banta hai (features + dashboard_features).
-- Ye feature Dairy section mein dikhata hai, aur Owner, Admin, Manager,
-- Milk Collection ko dikhta hai. Koi naya data nahi, sirf menu ki qatar.
-- Rollback: 735_milk_control_room_menu.rollback.sql
-- =====================================================================

insert into public.features (
  key, label, label_en, label_ur, description, description_en, description_ur, route, icon, is_sensitive, is_active
) values (
  'milk-collection.control-room',
  'Doodh Control Room',
  'Milk Control Room',
  'دودھ کنٹرول روم',
  'Din ka poora hisaab: chiller ka aaya, company, vendor aur party ka gaya, farq aur carrier.',
  'Full day view: chiller in, dispatch out, variance and carrier.',
  'دن کا مکمل حساب: چلر کا آیا، گیا، فرق اور کیریئر۔',
  '/admin/milk-collection/control-room',
  'LayoutDashboard',
  false,
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
  ('owner', 'milk-collection.control-room', array['view']::text[], 'all'),
  ('super_admin', 'milk-collection.control-room', array['view']::text[], 'all'),
  ('admin', 'milk-collection.control-room', array['view']::text[], 'all'),
  ('manager', 'milk-collection.control-room', array['view']::text[], 'own_branch'),
  ('milk_collection', 'milk-collection.control-room', array['view']::text[], 'own_branch')
on conflict (role, feature_key) do update set
  actions = excluded.actions,
  data_scope = excluded.data_scope;

insert into public.dashboard_features (dashboard_key, feature_key, section, section_order, sort_order)
select 'milk', 'milk-collection.control-room', 'Dairy', 3, 1
where exists (select 1 from public.dashboards where key = 'milk')
on conflict (dashboard_key, feature_key) do update set
  section = excluded.section,
  section_order = excluded.section_order,
  sort_order = excluded.sort_order;
