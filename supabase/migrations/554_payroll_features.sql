-- 554: Salary safhaat ki features, ijazatein, madad, aur kattautiyon ka khata.
-- Additive.

insert into public.gl_accounts (code, name, account_type, normal_side, is_active, sort_order)
values ('2050', 'Tankhwah se kattautiyan dena (EOBI / Tax)', 'liability', 'credit', true, 2050)
on conflict (code) do nothing;

insert into public.features (key, label, label_en, label_ur, route, icon, description) values
  ('hr.salary-structure', 'Tankhwah ka Dhancha', 'Salary Structure', 'تنخواہ کا ڈھانچہ', '/admin/hr/salary-structure', 'Wallet',
   'Salary components (allowances/kattautiyan) aur har staff ka structure, laagu tareekh aur history ke saath.'),
  ('hr.payroll', 'Payroll', 'Payroll', 'پے رول', '/admin/hr/payroll', 'Banknote',
   'Mahana payroll: hazri se ghair-hazri kattauti, advance qist, draft -> manzoori -> journal -> adaigi.'),
  ('hr.advances', 'Staff Advance', 'Staff Advance', 'اسٹاف ایڈوانس', '/admin/hr/advances', 'HandCoins',
   'Advance ki darkhwast -- mulazmat ki shart, qiston ka plan, maker-checker manzoori.')
on conflict (key) do update set route = excluded.route, label = excluded.label, label_en = excluded.label_en,
  description = excluded.description, is_active = true;

insert into public.dashboard_features (dashboard_key, feature_key, sort_order, section, section_order) values
  ('hr', 'hr.salary-structure', 60, null, 0), ('hr', 'hr.payroll', 61, null, 0), ('hr', 'hr.advances', 62, null, 0)
on conflict (dashboard_key, feature_key) do nothing;

insert into public.role_feature_permissions (role, feature_key, actions) values
  ('owner','hr.salary-structure', array['view','create','edit','approve']),
  ('super_admin','hr.salary-structure', array['view','create','edit','approve']),
  ('admin','hr.salary-structure', array['view','create','edit','approve']),
  ('hr','hr.salary-structure', array['view','create','edit']),
  ('finance','hr.salary-structure', array['view']),
  ('owner','hr.payroll', array['view','create','approve']),
  ('super_admin','hr.payroll', array['view','create','approve']),
  ('admin','hr.payroll', array['view','create','approve']),
  ('hr','hr.payroll', array['view','create']),
  ('finance','hr.payroll', array['view','create']),
  ('owner','hr.advances', array['view','create','approve']),
  ('super_admin','hr.advances', array['view','create','approve']),
  ('admin','hr.advances', array['view','create','approve']),
  ('hr','hr.advances', array['view','create']),
  ('finance','hr.advances', array['view','create'])
on conflict (role, feature_key) do update set actions = excluded.actions;

insert into public.feature_help (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes) values
 ('hr.payroll', 'rm',
  'Mahine ki tankhwah ek sath: approved structure + hazri se ghair-hazri kattauti (basic / 30 x din, half day aadha) + advance qist. Overtime nahi.',
  'HR/Finance banate hain; Admin ya Owner manzoor aur ada karte hain.',
  'Mahina khatam hone par, hazri band karne ke baad.',
  array['Mahina aur branch chunein, "Hisaab chalayein".','Grid check karein -- hazri ke din, kattauti, qist, net.','"Manzoori ke liye bhejein".','Admin/Owner "Manzoor" -- journal banta hai (Tankhwahein Dr / Tankhwah baqi Cr).','"Ada karein" -- khata chunein; cash/bank se nikasi.'],
  'Payslip staff ko My HR mein nazar aati hai.',
  array['Hazri band kiye baghair run banaya to form par nishan rehta hai.','Banane wala khud manzoor/ada nahi kar sakta.','Structure manzoor na ho to staff run mein nahi aata.'])
on conflict (feature_key, lang) do update set purpose = excluded.purpose, how_steps = excluded.how_steps, mistakes = excluded.mistakes;
