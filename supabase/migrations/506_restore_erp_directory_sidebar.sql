-- Restore the existing ERP Directory page in the Administration sidebar.
-- Navigation-only change; no business or historical data is changed.

insert into public.dashboard_features
  (dashboard_key, feature_key, sort_order, section, section_order)
values
  ('admin', 'erp-directory', 10, 'Navigation', 1)
on conflict (dashboard_key, feature_key) do update set
  sort_order = excluded.sort_order,
  section = excluded.section,
  section_order = excluded.section_order;
