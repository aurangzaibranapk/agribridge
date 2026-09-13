-- 151: Vendor ke kaam ki tasdeeq -- menu mein
--
-- Alag raasta is liye ke ijazat alag honi chahiye: jo banda machine
-- bhejta hai usay vendor ke adad par faisla dene ka ikhtiyar dena
-- zaroori nahi.

insert into features (key, label, route, icon, label_en, label_ur) values
  ('machinery-rental.work-claims', 'Vendor ka Kaam', '/admin/machinery-rental/work-claims', 'ClipboardCheck',
   'Vendor Work Claims', 'وینڈر کا کام')
on conflict (key) do update set label = excluded.label, route = excluded.route,
  icon = excluded.icon, label_en = excluded.label_en, label_ur = excluded.label_ur;

insert into dashboard_features (dashboard_key, feature_key, sort_order) values
  ('machinery', 'machinery-rental.work-claims', 26)
on conflict do nothing;
