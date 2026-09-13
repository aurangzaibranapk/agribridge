-- 154: Vendor ke paas para hua paisa -- menu mein
--
-- Alag raasta: kisan ka hisaab barabar ho chuka hota hai, ye us se
-- agla aur bilkul alag sawal hai -- hamara paisa vendor ke paas kab tak
-- para rahega. Ye finance ka kaam hai, machine bhejne wale ka nahi.

insert into features (key, label, route, icon, label_en, label_ur) values
  ('machinery-rental.vendor-cash', 'Vendor ke paas Paisa', '/admin/machinery-rental/vendor-cash', 'HandCoins',
   'Cash with Vendors', 'وینڈر کے پاس پیسہ')
on conflict (key) do update set label = excluded.label, route = excluded.route,
  icon = excluded.icon, label_en = excluded.label_en, label_ur = excluded.label_ur;

insert into dashboard_features (dashboard_key, feature_key, sort_order) values
  ('machinery', 'machinery-rental.vendor-cash', 27),
  ('finance',   'machinery-rental.vendor-cash', 61)
on conflict do nothing;
