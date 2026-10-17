-- 558: Qist Plan features, ijazatein, madad, aur write-off ka khata. Additive.

insert into public.gl_accounts (code, name, account_type, normal_side, is_active, sort_order)
values ('6075', 'Maaf kiya qarz (Bad debt write-off)', 'expense', 'debit', true, 6075)
on conflict (code) do nothing;

insert into public.features (key, label, label_en, label_ur, route, icon, description) values
  ('khata.qist', 'Qist Plans', 'Installment Plans', 'قسط پلان', '/admin/khata/qist', 'CalendarClock',
   'Kisi bhi member ka advance/udhaar qiston mein -- doodh, tankhwah, anaj, supplier bill ya naqad se kattauti.')
on conflict (key) do update set route = excluded.route, label = excluded.label, description = excluded.description, is_active = true;

insert into public.role_feature_permissions (role, feature_key, actions) values
  ('owner','khata.qist', array['view','create','approve','write_off']),
  ('super_admin','khata.qist', array['view','create','approve','write_off']),
  ('admin','khata.qist', array['view','create','approve','write_off']),
  ('finance','khata.qist', array['view','create']),
  ('manager','khata.qist', array['view','create']),
  ('hr','khata.qist', array['view'])
on conflict (role, feature_key) do update set actions = excluded.actions;

insert into public.feature_help (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes) values
 ('khata.qist', 'rm',
  'Advance ya udhaar ko qiston mein wasool karna. Adaigi (doodh, tankhwah, anaj, supplier) ke waqt wajib qist khud katti hai; kami akhir mein ek jama qist ban jati hai.',
  'Finance/Manager plan banate hain; Admin ya Owner manzoor, rok, dobara schedule aur write-off karte hain.',
  'Jab kisi member ko advance ya maal udhaar diya ho aur wapsi qiston mein ho.',
  array['Member talaash karein, source chunein (doodh / tankhwah / anaj / supplier / naqad).','Kul raqam, qiston ki tadaad, barabar ya har qatar alag, aur schedule (mahana / har hafte doodh / apni tareekhein).','Had (ikhtiyari): adaigi ka % ya zyada se zyada raqam.','"Manzoori ke liye bhejein" -- Admin/Owner manzoor kare.','Adaigi ke safhe par qist khud nazar aati aur katti hai.'],
  'Qist Dashboard par aaj wajib aur overdue dekhein.',
  array['Banane wala khud manzoor nahi kar sakta.','Schedule ka jama kul raqam ke barabar ho.','Write-off ki wajah lazmi -- ye wapas nahi hota.'])
on conflict (feature_key, lang) do update set purpose = excluded.purpose, how_steps = excluded.how_steps, mistakes = excluded.mistakes;
