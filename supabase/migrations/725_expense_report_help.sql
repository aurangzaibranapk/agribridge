-- =====================================================================
-- 725: Kharchon ki report — feature, ijazat, feature_help
-- =====================================================================
-- Koi naya table, koi naya column, koi journal nahi.
-- Safha /admin/reports/expenses. Manzoori ab bhi /admin/kharche par.
-- Pehle Testing. Live par tab jab backup verify ho.
-- Rollback: 725_expense_report_help.rollback.sql

insert into public.features (key, label, label_en, label_ur, description, description_en, description_ur, route, icon, is_sensitive, is_active)
values (
  'kharche.report',
  'Kharchon ki Report',
  'Expense report',
  'خرچوں کی رپورٹ',
  'Dukan, shaakh, qism, khata aur halat ke hisaab se kharcha. Pending bhi. CSV poori filtered fehrist.',
  'Expenses by shop, branch, category, account and status, including pending. CSV is the full filtered list.',
  'دکان، شاخ، قسم، کھاتہ اور حالت کے حساب سے خرچہ۔ پینڈنگ بھی۔ CSV پوری فلٹر فہرست۔',
  '/admin/reports/expenses',
  'FileBarChart',
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
  ('owner', 'kharche.report', array['view','export']::text[], 'all'),
  ('super_admin', 'kharche.report', array['view','export']::text[], 'all'),
  ('admin', 'kharche.report', array['view','export']::text[], 'all'),
  ('finance', 'kharche.report', array['view','export']::text[], 'all'),
  ('manager', 'kharche.report', array['view','export']::text[], 'own_branch')
on conflict (role, feature_key) do update set
  actions = excluded.actions,
  data_scope = excluded.data_scope;

insert into public.dashboard_features (dashboard_key, feature_key, section, section_order, sort_order)
values
  ('finance', 'kharche.report', 'Finance', 2, 36),
  ('reports', 'kharche.report', 'Reports', 5, 45)
on conflict (dashboard_key, feature_key) do update set
  section = excluded.section,
  section_order = excluded.section_order,
  sort_order = excluded.sort_order;

insert into public.feature_help (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
values
('kharche.report', 'rm',
 'Company ka kharcha kahan gaya — dukan, qism, khata aur halat. Pending aur tasdeeq shuda yahan hain. Nafa-nuqsan sirf manzoor journal dikhata hai.',
 'Owner, Admin aur Finance poori company. Branch manager sirf apni shaakh. Dukan ka staff ye report nahi dekhta.',
 'Jab malik pooche kis dukan ka kharcha zyada hai, ya pending kitna para hai. Manzoori ke liye nahi — wo Paisa & Khata par hai.',
 array[
   'Kharchon ki report kholen. Tareekh, shaakh, dukan, qism, khata aur halat chunein.',
   'Default sirf asal kharcha hai. Supplier ki adaigi aur advance dekhne ke liye tamam qismein chunein.',
   'Upar ka jor poori filtered fehrist ka hai. Neeche ki table safha safha hai.',
   'Jis qatar par dukan ya khata likha nahi, wo peeli hai. Usay sifar mat parhein.',
   'CSV poori filtered fehrist hai, sirf is safhe ki nahi.'
 ],
 'Pending ho to Paisa & Khata kholen aur manzoor karein. Manzoori ke baad hi journal aur nafa-nuqsan mein aata hai.',
 array[
   'Pending ko nafa-nuqsan ka hissa samajh lena. Wahan wo tab aata hai jab manzoor ho.',
   'Supplier ki adaigi ya advance ko asal kharcha ginnna. Default unhen bahar rakhta hai.',
   'Dukan likhi nahi ko Rs 0 parhna.',
   'Sirf is safhe ki 50 qatarein CSV samajh lena.'
 ]),
('kharche.report', 'en',
 'Where company expenses went, by shop, category, account and status. Pending and verified rows are included. Profit and loss only shows approved journals.',
 'Owner, Admin and Finance see the whole company. A branch manager sees only their branch. Shop staff do not open this report.',
 'When you need which shop spent more, or how much is still pending. Approval stays on Paisa & Khata.',
 array[
   'Open the expense report. Choose dates, branch, shop, category, account and status.',
   'The default is real expenses only. Choose every kind to include supplier payments and advances.',
   'The totals cover the full filtered list. The table below is paged.',
   'An amber row was not recorded on the entry. Do not read it as zero.',
   'CSV is the full filtered list, not only this page.'
 ],
 'If a row is pending, open Paisa & Khata and approve it. Only then does it enter the journal and profit and loss.',
 array[
   'Treating pending rows as already in profit and loss.',
   'Counting a supplier payment or an advance as a real expense. The default leaves them out.',
   'Reading a missing shop as Rs 0.',
   'Thinking CSV is only the 50 rows on this page.'
 ]),
('kharche.report', 'ur',
 'کمپنی کا خرچہ کہاں گیا — دکان، قسم، کھاتہ اور حالت۔ پینڈنگ یہاں ہے۔ نفع نقصان صرف منظور جرنل دکھاتا ہے۔',
 'اونر، ایڈمن اور فنانس پوری کمپنی۔ برانچ مینیجر صرف اپنی شاخ۔ دکان کا سٹاف یہ رپورٹ نہیں دیکھتا۔',
 'جب پوچھیں کس دکان کا خرچہ زیادہ ہے، یا پینڈنگ کتنا ہے۔ منظوری پیسہ اور کھاتہ پر ہے۔',
 array[
   'خرچوں کی رپورٹ کھولیں۔ تاریخ، شاخ، دکان، قسم، کھاتہ اور حالت چنیں۔',
   'پہلے صرف اصل خرچہ۔ سپلائر کی ادائیگی کے لیے تمام قسمیں چنیں۔',
   'اوپر کا جوڑ پوری فلٹر فہرست کا ہے۔ نیچے صفحہ صفحہ ہے۔',
   'پیلی قطار لکھی نہیں گئی۔ اسے صفر نہ پڑھیں۔',
   'CSV پوری فلٹر فہرست ہے، صرف اس صفحے کی نہیں۔'
 ],
 'پینڈنگ ہو تو پیسہ اور کھاتہ کھول کر منظور کریں۔ تب جرنل بنتا ہے۔',
 array[
   'پینڈنگ کو نفع نقصان میں سمجھنا۔',
   'ادائیگی یا ایڈوانس کو اصل خرچہ گننا۔',
   'دکان لکھی نہیں کو صفر پڑھنا۔',
   'CSV کو صرف اس صفحے کی 50 قطاریں سمجھنا۔'
 ])
on conflict (feature_key, lang) do update set
  purpose = excluded.purpose,
  who_uses = excluded.who_uses,
  when_use = excluded.when_use,
  how_steps = excluded.how_steps,
  next_step = excluded.next_step,
  mistakes = excluded.mistakes;
