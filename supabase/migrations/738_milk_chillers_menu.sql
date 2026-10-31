-- =====================================================================
-- AgriBridge — Migration 738: Chiller ki list ka menu (Milk & Dairy)
-- =====================================================================
-- Sirf Owner, Super Admin, Admin ko dikhta hai. Naam badalne aur chiller
-- jorne ka page. Rollback: 738_milk_chillers_menu.rollback.sql
-- =====================================================================

insert into public.features (
  key, label, label_en, label_ur, description, description_en, description_ur, route, icon, is_sensitive, is_active
) values (
  'milk-collection.chillers',
  'Chiller ki list',
  'Chiller list',
  'چلر کی فہرست',
  'Chiller ke naam aur tadad. Naya chiller jorna, naam badalna. Sirf Admin.',
  'Chiller names and count. Add a chiller, rename. Admin only.',
  'چلر کے نام اور تعداد۔ صرف ایڈمن۔',
  '/admin/milk-collection/chillers',
  'Droplet',
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
  ('owner', 'milk-collection.chillers', array['view','edit']::text[], 'all'),
  ('super_admin', 'milk-collection.chillers', array['view','edit']::text[], 'all'),
  ('admin', 'milk-collection.chillers', array['view','edit']::text[], 'all')
on conflict (role, feature_key) do update set
  actions = excluded.actions,
  data_scope = excluded.data_scope;

insert into public.dashboard_features (dashboard_key, feature_key, section, section_order, sort_order)
select 'milk', 'milk-collection.chillers', 'Dairy', 3, 2
where exists (select 1 from public.dashboards where key = 'milk')
on conflict (dashboard_key, feature_key) do update set
  section = excluded.section,
  section_order = excluded.section_order,
  sort_order = excluded.sort_order;
