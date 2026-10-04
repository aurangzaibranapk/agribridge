-- AgriBridge: restore the two owner/admin navigation entries and repair
-- active features which were registered but never assigned to a dashboard.
-- Navigation is database-driven; this migration changes menu placement only.
-- No business rows, permissions, or historical data are deleted.

insert into public.features
  (key, label, label_en, route, icon, is_active)
values
  ('stock-count', 'Maal ki Ginti', 'Stock Count', '/admin/stock-count', 'ClipboardCheck', true),
  ('erp-directory', 'ERP ka Naqsha', 'ERP Directory', '/admin/erp-directory', 'LayoutGrid', true)
on conflict (key) do update set
  label = excluded.label,
  label_en = excluded.label_en,
  route = excluded.route,
  icon = excluded.icon,
  is_active = true;

-- Stock Count ka canonical ghar Inventory hai. Agar purani migrations ne
-- isay kisi aur dashboard mein dala ho to duplicate menu nahi rehna chahiye.
delete from public.dashboard_features
where feature_key = 'stock-count';

insert into public.dashboard_features
  (dashboard_key, feature_key, sort_order, section, section_order)
values
  ('inventory', 'stock-count', 70, 'Closing & Control', 3)
on conflict (dashboard_key, feature_key) do update set
  sort_order = excluded.sort_order,
  section = excluded.section,
  section_order = excluded.section_order;

-- ERP map Administration mein ek seedha raasta hai.
insert into public.dashboard_features
  (dashboard_key, feature_key, sort_order, section, section_order)
values
  ('admin', 'erp-directory', 10, 'Navigation', 1)
on conflict (dashboard_key, feature_key) do update set
  sort_order = excluded.sort_order,
  section = excluded.section,
  section_order = excluded.section_order;

-- Pichli feature migrations kabhi kabhi feature register kar deti thin
-- magar dashboard_features mein link nahi banati thin. Aise active orphan
-- features ko safe Administration group mein dikhayein, taake koi live
-- page menu se ghaib na rahe. Existing links aur permissions ko touch nahi.
insert into public.dashboard_features
  (dashboard_key, feature_key, sort_order, section, section_order)
select
  'admin',
  f.key,
  1000 + row_number() over (order by f.key),
  'Other Features',
  99
from public.features f
where f.is_active
  and not exists (
    select 1
    from public.dashboard_features df
    where df.feature_key = f.key
  )
on conflict (dashboard_key, feature_key) do nothing;

