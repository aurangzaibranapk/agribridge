-- Restore the existing Product Cycles page in the Inventory sidebar.
-- This is a navigation-only change; it does not alter stock or count data.

insert into public.dashboard_features
  (dashboard_key, feature_key, sort_order, section, section_order)
values
  ('inventory', 'product-cycles', 45, 'Operations', 2)
on conflict (dashboard_key, feature_key) do update set
  sort_order = excluded.sort_order,
  section = excluded.section,
  section_order = excluded.section_order;
