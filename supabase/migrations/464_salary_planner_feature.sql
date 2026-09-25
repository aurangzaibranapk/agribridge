-- Salary Planner report page -- Admin/Owner ke liye:
-- System se real data le kar bata do kitni salary deni chahiye.
-- Route: /admin/reports/salary-planner

insert into features (key, label, label_en, label_ur, route, icon, description)
values (
  'reports.salary-planner',
  'Salary Planner',
  'Salary Planner',
  'سیلری پلانر',
  '/admin/reports/salary-planner',
  'Wallet',
  'Har dukan ki sale, gross munafa, kharche (ijara+bijli+maintenance) system se uthaye -- net munafa ke hisaab se salary ka andaza batao. Slider se apna % set karo.'
)
on conflict (key) do update
  set route       = excluded.route,
      label       = excluded.label,
      label_en    = excluded.label_en,
      description = excluded.description,
      is_active   = true;

-- Reports dashboard mein link
insert into dashboard_features (dashboard_key, feature_key, sort_order, section, section_order)
values ('reports', 'reports.salary-planner', 40, null, 0)
on conflict (dashboard_key, feature_key) do nothing;

-- Permissions: Owner, Super Admin, Admin, Finance, Manager
insert into role_features (role, feature_key, can_view, can_edit)
values
  ('owner',       'reports.salary-planner', true, false),
  ('super_admin', 'reports.salary-planner', true, false),
  ('admin',       'reports.salary-planner', true, false),
  ('finance',     'reports.salary-planner', true, false),
  ('manager',     'reports.salary-planner', true, false)
on conflict (role, feature_key) do update
  set can_view = excluded.can_view,
      can_edit = excluded.can_edit;

-- feature_help: Roman Urdu mein
insert into public.feature_help
  (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
values (
  'reports.salary-planner', 'rm',
  'System ka data khud uthata hai -- har dukan ki is mahine ki sale, gross munafa, aur baqi kharche (ijara, bijli, maintenance). Net munafa se salary budget banta hai. Slider ghisao, foran pata chale ke kitni salary dena munasib hai.',
  'Owner, Admin, Finance aur Manager -- jo log tankhwa ka faisla karte hain. Staff ke liye nahi.',
  'Mahine ke akhir mein ya pehle -- jab yeh tay karna ho ke is baar salary budget kya hoga. Budget banana ho ya management meeting mein dikhana ho.',
  array[
    'Mahina chunein (default: chal raha mahina). "Dikhao" dabayein.',
    'Agar kai branches hain to pehle ek branch chunein ya sab ek sath dekh saktay hain.',
    'Har dukan ka card dikhega: Sale, Gross Munafa, Kharche, Net Munafa.',
    'Upar "Net Munafe ka Kitna % Salary Dein?" slider hai -- kheenchein.',
    'Slider ghisane se har dukan ka "Salary Budget" aur "Per Admi" foran badal jata hai.',
    'Neeche har dukan mein staff ginti bhi dikhti hai (branch ke active staff).',
    'Agar dukan ghate mein hai to salary budget nahi banta -- wahan red warning aati hai.'
  ],
  'Ye sirf andaza hai -- asal salary tab darja karo jab company_expense_requests mein "salary" category se bill approve karo. Salary Planner batata hai kya dena chahiye, asal record wahan jata hai.',
  array[
    'Staff ginti branch ke active users se aati hai -- agar kisi ka account inactive hai to ginti mein nahi hoga.',
    'Kharche mein sirf approved bills aate hain -- pending bills yahan nahi dikhte.',
    '"Salary" category ki company_expense_requests yahan "kharche" mein nahi aati (warna loop ban jata). Ye tool sirf salary tay karne ke liye hai, jo pehle se di salary track karne ke liye nahi.',
    'Agar kisi dukan ki sale sifar hai to "Net Munafa" bhi sifar -- wahan check karo ke POS mein sale hua bhi ya nahi.'
  ]
)
on conflict (feature_key, lang) do update set
  purpose   = excluded.purpose,
  who_uses  = excluded.who_uses,
  when_use  = excluded.when_use,
  how_steps = excluded.how_steps,
  next_step = excluded.next_step,
  mistakes  = excluded.mistakes;
