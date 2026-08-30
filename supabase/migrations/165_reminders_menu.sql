-- 165: Payment ki yaad dahani -- menu mein
--
-- Ye us bande ka safha hai jo paisa wapas laata hai. Us ke liye "kis
-- ko yaad dilani hai" aur "kis ko dila di" ek hi sawal hai, is liye
-- ek hi safha hai.

insert into features (key, label, route, icon, label_en, label_ur) values
  ('machinery-rental.reminders', 'Payment ki Yaad Dahani', '/admin/machinery-rental/reminders', 'BellRing',
   'Payment Reminders', 'ادائیگی کی یاد دہانی')
on conflict (key) do update set label = excluded.label, route = excluded.route,
  icon = excluded.icon, label_en = excluded.label_en, label_ur = excluded.label_ur;

insert into dashboard_features (dashboard_key, feature_key, sort_order) values
  ('machinery', 'machinery-rental.reminders', 28),
  ('finance',   'machinery-rental.reminders', 62)
on conflict do nothing;
