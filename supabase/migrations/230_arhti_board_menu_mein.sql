-- =====================================================================
-- Migration 230: Arhti Board menu mein
-- =====================================================================
-- Board fehrist se alag safha hai aur alag sawal ka jawab deta hai:
-- fehrist "kaun kaun hain" batati hai, board "is waqt hamara paisa kis
-- ke paas khara hai".
--
-- Dono ko ek safha bana dete to wo safha do kaam adhoore karta: paise ka
-- peecha karne wale ko naam aur phone ke khane parhne parte, aur naya
-- banda daalne wale ko lambi qatarein.
--
-- Ye "Reports" ke neeche hai, "Hisaab" ke neeche nahi. Hisaab wale safhe
-- wo hain jahan kuch DARJ hota hai; ye safha sirf batata hai.
--
-- is_sensitive = true -- yahan har arhti ke zimme khari raqam aur hamara
-- commission dono likhe hote hain.

insert into public.features (key, label, label_en, label_ur, route, icon, is_sensitive, is_active) values
  ('machinery-rental.arhti-board', 'Arhti Board', 'Crop Lifter Board', 'آڑھتی بورڈ',
   '/admin/machinery-rental/lifters/dashboard', 'LayoutDashboard', true, true)
on conflict (key) do update set
  route = excluded.route, icon = excluded.icon,
  label = excluded.label, label_en = excluded.label_en, label_ur = excluded.label_ur,
  is_sensitive = excluded.is_sensitive, is_active = true;

insert into public.dashboard_features (dashboard_key, feature_key, sort_order, section, section_order) values
  ('machinery', 'machinery-rental.arhti-board', 46, 'Reports', 7)
on conflict (dashboard_key, feature_key) do update set
  sort_order = excluded.sort_order, section = excluded.section, section_order = excluded.section_order;
