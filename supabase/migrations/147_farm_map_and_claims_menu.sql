-- 147: Do naye safhe menu mein
--
-- Khaiton ka naqsha aur advance ke dawe -- dono alag raaste hain kyunke
-- dono par IJAZAT alag honi chahiye. Jo banda machine bhejta hai usay
-- khaiton ka naqsha chahiye; paise ke dawe ki tasdeeq us ka kaam nahi.
-- Alag ijazat sirf alag raaste par lag sakti hai.

insert into features (key, label, route, icon, label_en, label_ur) values
  ('machinery-rental.farm-map', 'Khaiton ka Naqsha', '/admin/machinery-rental/farm-map', 'Map',
   'Farm Map', 'کھیتوں کا نقشہ'),
  ('machinery-rental.advance-claims', 'Advance ke Dawe', '/admin/machinery-rental/advance-claims', 'BadgeCheck',
   'Advance Claims', 'ایڈوانس کے دعوے')
on conflict (key) do update set label = excluded.label, route = excluded.route,
  icon = excluded.icon, label_en = excluded.label_en, label_ur = excluded.label_ur;

insert into dashboard_features (dashboard_key, feature_key, sort_order) values
  ('machinery', 'machinery-rental.farm-map',       24),
  ('machinery', 'machinery-rental.advance-claims', 25)
on conflict do nothing;

-- Dawe ki tasdeeq paise ka kaam hai, is liye finance ke dashboard par bhi.
insert into dashboard_features (dashboard_key, feature_key, sort_order)
select 'finance', 'machinery-rental.advance-claims', 60
where exists (select 1 from dashboards where key = 'finance')
on conflict do nothing;
