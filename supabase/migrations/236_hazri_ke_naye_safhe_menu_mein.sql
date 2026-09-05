-- =====================================================================
-- Migration 236: Hazri ke naye safhe menu mein
-- =====================================================================
-- Safha ban jana aur safhe ka HONA do alag baatein hain. Jo safha kisi
-- menu mein nahi, wo kisi ke kaam nahi -- ye ghalti is project mein
-- pehle bhi ho chuki hai.
--
-- "Chhutti aur Waqt" par is_sensitive = true. Wajah: wahan se hafte ki
-- chhutti aur mahine ka taala badalta hai. Ye do cheezein seedha
-- tankhwah ke adad par asar daalti hain -- itwaar ko kaam ka din bana
-- dena har bande ke mahine mein 4 ghair haziriyan daal deta hai.
-- =====================================================================

insert into public.features (key, label, label_en, label_ur, route, icon, is_sensitive, is_active) values
  ('hr.attendance', 'Hazri Calendar', 'Attendance Calendar', 'حاضری کیلنڈر',
   '/admin/hr/attendance', 'CalendarDays', false, true),
  ('hr.attendance-board', 'Hazri Board', 'Attendance Board', 'حاضری بورڈ',
   '/admin/hr/attendance/board', 'LayoutDashboard', false, true),
  ('hr.corrections', 'Hazri Darkhwastein', 'Attendance Requests', 'حاضری درخواستیں',
   '/admin/hr/corrections', 'ClipboardCheck', false, true),
  ('hr.team', 'Team aur Reporting', 'Team & Reporting', 'ٹیم اور رپورٹنگ',
   '/admin/hr/team', 'Network', false, true),
  ('hr.calendar-settings', 'Chhutti aur Waqt', 'Holidays & Shift', 'چھٹیاں اور اوقات',
   '/admin/hr/settings', 'Settings2', true, true)
on conflict (key) do update set
  route = excluded.route, icon = excluded.icon,
  label = excluded.label, label_en = excluded.label_en, label_ur = excluded.label_ur,
  is_sensitive = excluded.is_sensitive, is_active = true;

insert into public.dashboard_features (dashboard_key, feature_key, sort_order) values
  ('hr', 'hr.attendance', 11),
  ('hr', 'hr.attendance-board', 12),
  ('hr', 'hr.corrections', 13),
  ('hr', 'hr.team', 16),
  ('hr', 'hr.calendar-settings', 17)
on conflict (dashboard_key, feature_key) do update set
  sort_order = excluded.sort_order;
