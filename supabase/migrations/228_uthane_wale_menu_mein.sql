-- =====================================================================
-- Migration 228: Uthane wale menu mein
-- =====================================================================
-- Safhe ban chuke hain magar kisi menu mein nahi -- yani hain hi nahi.
-- Ye ghalti is project mein pehle bhi ho chuki hai (task "Jo safhe bane
-- hue hain magar menu mein nahi").
--
-- Ye feature MACHINERY ke dashboard par lagta hai, grain par nahi. Wajah
-- kaam ki tarteeb hai: uthane wala booking ke safhe se tag hota hai, aur
-- us ka bill kattai ke bill ke baad banta hai. Jo banda booking khol kar
-- baitha hai, usay wahin us ki fehrist milni chahiye -- doosre dashboard
-- par bhejna ek aisa qadam hai jis ki koi wajah nahi.
--
-- `is_sensitive` = true. Is safhe par har uthane wale ka commission ka
-- rate likha hota hai, aur wo rate har staff ke dekhne ki cheez nahi --
-- gaon mein wo baat aage pahunchti hai aur agla banda usi rate par baat
-- shuru kar deta hai.

insert into public.features (key, label, label_en, label_ur, route, icon, is_sensitive, is_active) values
  ('machinery-rental.lifters', 'Fasal Uthane Wale', 'Crop Lifters', 'فصل اٹھانے والے',
   '/admin/machinery-rental/lifters', 'Truck', true, true)
on conflict (key) do update set
  route = excluded.route, icon = excluded.icon,
  label = excluded.label, label_en = excluded.label_en, label_ur = excluded.label_ur,
  is_sensitive = excluded.is_sensitive, is_active = true;

-- "Hisaab" wali sarkhi ke neeche -- wahin jahan billing, vendor-cash aur
-- reminders hain. Ye us bande ka kaam hai jo paise ka peecha karta hai.
insert into public.dashboard_features (dashboard_key, feature_key, sort_order, section, section_order) values
  ('machinery', 'machinery-rental.lifters', 45, 'Hisaab', 6)
on conflict (dashboard_key, feature_key) do update set
  sort_order = excluded.sort_order, section = excluded.section, section_order = excluded.section_order;
