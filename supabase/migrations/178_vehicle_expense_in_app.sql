-- 178: Gaari ka kharcha app se bhi -- sirf WhatsApp se nahi
--
-- Rozana hisaab ka poora nizaam pehle se bana hua hai (099): subah ka
-- meter, petrol ka bill, shaam ka meter; aur shaam ko khud-ba-khud
-- mileage, cost per km, aur "jitna petrol lagna chahiye tha" ka farq.
-- Manager tasdeeq kare to entry purani fuel_logs mein chali jati hai,
-- jise reports pehle se parhti hain.
--
-- Magar us tak pahunchne ka RAASTA sirf ek tha: WhatsApp. Jis din
-- WhatsApp ki chaabi na lagi ho -- aur abhi nahi lagi -- us din ye
-- poora nizaam chalta hi nahi. Staff ke paas meter darj karne ka koi
-- tareeqa hi nahi.
--
-- Ab doosra darwaza khulta hai: app ka apna safha. HISAAB WOHI EK HAI
-- (src/lib/vehicle-daily-log.ts) -- dono darwaze usi ko bulate hain.
-- Doosra hisaab likhna ka matlab hota ke kisi din WhatsApp wali mileage
-- aur app wali mileage alag nikal aatin.
--
-- SABOOT KA QANOON: meter ka adad bina saboot ke darj nahi hota. Saboot
-- ya to WhatsApp ki submission hai (jis mein tasveer hoti hai) ya app
-- se chaRhai gayi tasveer. Rok is baat par hai ke KYA likha ja raha
-- hai, is par nahi ke KAUN likh raha hai.

alter table public.vehicle_daily_logs
  add column if not exists opening_photo_path text,
  add column if not exists closing_photo_path text;

comment on column public.vehicle_daily_logs.opening_photo_path is
  'App se aaye meter ki tasveer. WhatsApp se aaye to tasveer submission mein hoti hai.';

-- Meter ka adad hai to saboot bhi hona chahiye -- kisi bhi darwaze se.
alter table public.vehicle_daily_logs drop constraint if exists chk_vehicle_opening_proof;
alter table public.vehicle_daily_logs add constraint chk_vehicle_opening_proof check (
  opening_km is null
  or opening_submission_id is not null
  or opening_photo_path is not null
);

alter table public.vehicle_daily_logs drop constraint if exists chk_vehicle_closing_proof;
alter table public.vehicle_daily_logs add constraint chk_vehicle_closing_proof check (
  closing_km is null
  or closing_submission_id is not null
  or closing_photo_path is not null
);

-- Petrol ka bill bhi bina saboot ke nahi. Ye paisa hai.
alter table public.vehicle_fuel_entries drop constraint if exists chk_vehicle_fuel_proof;
alter table public.vehicle_fuel_entries add constraint chk_vehicle_fuel_proof check (
  submission_id is not null or receipt_path is not null
);

-- Staff ka apna safha.
insert into public.features (key, label, label_en, label_ur, route, icon, is_sensitive, is_active) values
  ('my-vehicle', 'Meri Gaari', 'My Vehicle', 'میری گاڑی',
   '/admin/my-vehicle', 'Bike', false, true)
on conflict (key) do update set route = excluded.route, icon = excluded.icon, is_active = true;

-- Ye har staff ka apna safha hai, kisi department ka nahi -- isi liye
-- wahan lagta hai jahan "Mera Kaam" lagta hai.
insert into public.dashboard_features (dashboard_key, feature_key, sort_order)
select d.key, 'my-vehicle', 40
  from public.dashboards d
 where d.key in (select dashboard_key from public.dashboard_features where feature_key = 'vehicles')
on conflict (dashboard_key, feature_key) do nothing;
