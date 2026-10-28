-- =====================================================================
-- 723: Tel / ops cards + payroll desk — feature aur feature_help
-- =====================================================================
-- Koi naya table, koi naya column, koi naya tankhwah formula nahi.
-- Safhe code se hain: /admin/finance/ops aur /admin/hr/payroll ke views.
-- Yahan sirf menu, ijazat aur madad.
-- 721 cash needs-you. 722 load Tx help. Ye un ke baad.
-- Pehle Testing. Live par tab jab backup verify ho.
-- Rollback: 723_fuel_ops_payroll_help.rollback.sql

insert into public.features (key, label, label_en, label_ur, description, description_en, description_ur, route, icon, is_sensitive, is_active)
values (
  'finance.ops-cards',
  'Tel aur Ops Cards',
  'Fuel and ops cards',
  'تیل اور آپریشن کارڈز',
  'Route tel, generator diesel, company machine diesel aur marammat — is mahine ka kharcha aur manzoori.',
  'Route fuel, generator diesel, company machine diesel and maintenance — this month spend and review.',
  'روٹ کا تیل، جنریٹر ڈیزل، مشین ڈیزل اور مرمت — اس مہینے کا خرچ اور منظوری۔',
  '/admin/finance/ops',
  'Bike',
  true,
  true
)
on conflict (key) do update set
  label = excluded.label,
  label_en = excluded.label_en,
  label_ur = excluded.label_ur,
  description = excluded.description,
  description_en = excluded.description_en,
  description_ur = excluded.description_ur,
  route = excluded.route,
  icon = excluded.icon,
  is_sensitive = true,
  is_active = true;

insert into public.role_feature_permissions (role, feature_key, actions, data_scope)
values
  ('owner', 'finance.ops-cards', array['view']::text[], 'all'),
  ('super_admin', 'finance.ops-cards', array['view']::text[], 'all'),
  ('admin', 'finance.ops-cards', array['view']::text[], 'all'),
  ('finance', 'finance.ops-cards', array['view']::text[], 'all'),
  ('manager', 'finance.ops-cards', array['view']::text[], 'all'),
  ('milk_collection', 'finance.ops-cards', array['view']::text[], 'all'),
  ('hr', 'finance.ops-cards', array['view']::text[], 'all')
on conflict (role, feature_key) do update set
  actions = excluded.actions,
  data_scope = excluded.data_scope;

insert into public.dashboard_features (dashboard_key, feature_key, section, section_order, sort_order)
values
  ('finance', 'finance.ops-cards', 'Finance', 2, 15),
  ('milk', 'finance.ops-cards', 'Dairy', 3, 40),
  ('fuel', 'finance.ops-cards', 'Fuel', 1, 10),
  ('hr', 'finance.ops-cards', 'HR', 2, 70)
on conflict (dashboard_key, feature_key) do update set
  section = excluded.section,
  section_order = excluded.section_order,
  sort_order = excluded.sort_order;

insert into public.feature_help (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
values
('finance.ops-cards', 'rm',
 'Route ka tel, generator diesel, company ka machine diesel aur gaari ki marammat — ek desk. Is mahine ka manzoor kharcha, aur Needs you jahan faisla baqi ho. Payroll ka raasta yahin se Cards / Log / Harkatein par jata hai. Tankhwah ka formula nahi badla.',
 'Finance, Dairy, Manager, HR, Admin aur Owner. Jo table na parhe, us ka raqam dash rehta hai.',
 'Subah, jab tel ya marammat ki manzoori pari ho, ya mahine ka kharcha ek nazar mein chahiye.',
 array[
   'Tel aur ops kholen. Teen cards: route tel, diesel, marammat.',
   'Needs you par comment likh kar Manzoor ya Branch verify. Machine diesel work-claims ki qatar par.',
   'Apni entry Admin/Owner ke ilawa khud nahi.',
   'Mazdoor payroll par Cards, Log ya Harkatein.',
   'Jo parha na jaye us par dash. Sifar sirf tab jab ginti mil kar khali ho.'
 ],
 'Mera Kaam se Tel aur ops, ya Dairy ke Tel ka Hisaab ke upar wahi desk. Agla qadam usi card ka button, ya payroll.',
 array[
   'Is desk ko kisi doosri app ka wallet samajh lena — wo float is system mein nahi.',
   'Bank brand ka naam yahan dhoondna.',
   'Apni fuel entry khud manzoor karna.',
   'Dash ko sifar parhna.',
   'Naya tankhwah formula yahan se nikalna.'
 ]),
('finance.ops-cards', 'en',
 'One desk for route fuel, generator diesel, company machine diesel and vehicle maintenance. This month approved spend, and Needs you where a decision is still open. Payroll links onward to Cards, People and Transactions. The salary formula is unchanged.',
 'Finance, dairy, manager, HR, Admin and Owner. A dash means that table was not read.',
 'In the morning, when fuel or maintenance is waiting, or you want this month spend in one place.',
 array[
   'Open Fuel and ops. Three cards: route fuel, diesel, maintenance.',
   'On Needs you, write a comment and approve or branch-verify. Machine diesel stays on the work-claims queue.',
   'Except Admin and Owner, you cannot decide your own entry.',
   'Open labour payroll on Cards, People or Transactions.',
   'A dash means not read. Zero only when the count was read and nothing is there.'
 ],
 'From My Work open Fuel and ops, or the same desk at the top of Dairy fuel. The next step is the button on that card, or payroll.',
 array[
   'Treating this desk as another app wallet. That float is not in this system.',
   'Looking for a bank brand name here.',
   'Approving your own fuel entry.',
   'Reading a dash as zero.',
   'Expecting a new salary formula.'
 ]),
('finance.ops-cards', 'ur',
 'روٹ کا تیل، جنریٹر ڈیزل، کمپنی کا مشین ڈیزل اور گاڑی کی مرمت — ایک ڈیسک. اس مہینے کا منظور خرچ، اور Needs you جہاں فیصلہ باقی ہو. تنخواہ کا فارمولا نہیں بدلا.',
 'فنانس، ڈیری، مینیجر، ایچ آر، ایڈمن اور اونر.',
 'صبح، جب تیل یا مرمت کی منظوری پڑی ہو.',
 array[
   'تیل اور آپریشن کھولیں. تین کارڈ.',
   'Needs you پر تبصرہ لکھ کر منظور. مشین ڈیزل ورک کلیمز پر.',
   'اپنی انٹری ایڈمن/اونر کے سوا خود نہیں.',
   'پے رول پر کارڈز، لوگ یا لین دین.',
   'جو نہ پڑھا جائے اس پر ڈیش. صفر صرف جب گنتی خالی ہو.'
 ],
 'میرا کام سے تیل اور آپریشن. اگلا قدم اسی کارڈ کا بٹن.',
 array[
   'اس ڈیسک کو کسی اور ایپ کا والیٹ سمجھنا.',
   'بینک کا برانڈ یہاں ڈھونڈنا.',
   'اپنی فیول انٹری خود منظور کرنا.',
   'ڈیش کو صفر پڑھنا.'
 ]),
('hr.payroll', 'rm',
 'Mahine ki tankhwah ek sath: approved structure + hazri se ghair-hazri kattauti (basic / 30 x din, half day aadha) + advance qist. Overtime nahi. Upar teen nazar: Cards (har shakhs), Log (purana grid), Harkatein (advance aur journal). Formula wahi fn_payroll_compute.',
 'HR/Finance banate hain; Admin ya Owner manzoor aur ada karte hain.',
 'Mahina khatam hone par, hazri band karne ke baad. Draft system mahine ke aakhir bhi banata hai.',
 array[
   'Cards, Log ya Harkatein chunein. Mahina aur branch wahi rehte hain.',
   'Mahina aur branch chunein, Hisaab chalayein.',
   'Log par hazri ke din, kattauti, qist, net check karein. Draft par line badal sakte hain.',
   'Manzoori ke liye bhejein. Admin/Owner Manzoor — journal banta hai.',
   'Ada karein — khata chunein. Harkatein par advance aur ada nazar aati hai.'
 ],
 'Payslip staff ko My HR mein nazar aati hai. Tel aur ops se bhi yahan ka raasta hai.',
 array[
   'Hazri band kiye baghair run banaya to form par nishan rehta hai.',
   'Banane wala khud manzoor/ada nahi kar sakta.',
   'Structure manzoor na ho to staff run mein nahi aata.',
   'Harkatein ko naya tankhwah formula samajhna.',
   'Advance na parhe to sifar likh dena.'
 ]),
('milk-collection.fuel', 'rm',
 'Tel ka hisaab: kis gaari mein kitna tel gaya. Upar Tel aur ops cards: route tel, diesel, marammat aur Needs you. Entry ka form neeche wahi hai.',
 'Doodh ka staff entry karta hai. Manzoori Admin/Owner ya doosra approver.',
 'Har dafa tel daalne par, aur subah manzoori dekhte waqt.',
 array[
   'Upar desk dekhein — kharcha aur Needs you.',
   'Gaari aur miqdar likhein. Meter ka adad aur raseed lagayein.',
   'Manzoori comment ke sath. Apni entry khud nahi, Admin/Owner ke ilawa.'
 ],
 'Fi litre kharche mein yahi raqam jati hai. Finance desk /admin/finance/ops par bhi yahi cards hain.',
 array[
   'Meter ka adad likhna na bhoolein — us ke baghair mileage nahi nikalti.',
   'Apni entry khud manzoor karna.',
   'Dash ko sifar parhna.'
 ])
on conflict (feature_key, lang) do update set
  purpose = excluded.purpose,
  who_uses = excluded.who_uses,
  when_use = excluded.when_use,
  how_steps = excluded.how_steps,
  next_step = excluded.next_step,
  mistakes = excluded.mistakes,
  updated_at = now();
