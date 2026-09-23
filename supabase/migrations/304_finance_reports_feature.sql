-- =====================================================================
-- AgriBridge — Migration 304: Maali reports nizam mein darj
-- =====================================================================
-- Chhe reports ek safhe par (/admin/finance/reports): paisa kahan se
-- kahan (cash flow), chalta sarmaya, khaton ka opening/closing, aaya
-- aur gaya, kis se lena kis ko dena, aur shaakh shaakh ka nafa nuqsan.
--
-- Saari ki saari usi `journal_lines` par khaRi hain -- koi nayi ginti
-- nahi. Ye baat is liye ahem hai ke report ke liye adad alag se jama
-- karna wohi raasta hai jahan se do jagah do adad ban jate hain.
-- =====================================================================

insert into public.features (key, label, label_en, label_ur, route, is_active, is_sensitive, description)
values
  ('finance.reports', 'Maali Reports', 'Financial Reports', 'مالی رپورٹس',
   '/admin/finance/reports', true, true,
   'Cash flow, chalta sarmaya, khaton ka baqi, aaya-gaya, lena-dena aur shaakh ka nafa nuqsan -- sab usi ledger se.')
on conflict (key) do update set
  label        = excluded.label,
  label_en     = excluded.label_en,
  label_ur     = excluded.label_ur,
  route        = excluded.route,
  is_active    = true,
  is_sensitive = excluded.is_sensitive,
  description  = excluded.description;

insert into public.role_feature_permissions (role, feature_key, actions, data_scope)
values
  ('manager', 'finance.reports', array['view'], 'all'),
  ('finance', 'finance.reports', array['view'], 'all')
on conflict (role, feature_key) do update set
  actions    = excluded.actions,
  data_scope = excluded.data_scope;

insert into public.dashboard_features (dashboard_key, feature_key, sort_order, section, section_order)
values ('finance', 'finance.reports', 5, 'Maali Hisaab', 0)
on conflict (dashboard_key, feature_key) do update set
  sort_order    = excluded.sort_order,
  section       = excluded.section,
  section_order = excluded.section_order;

insert into public.feature_help
  (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
values
(
  'finance.reports', 'rm',
  'Chhe maali reports ek jagah: paisa kahan se kahan, chalta sarmaya, khaton ka baqi, aaya-gaya, kis se lena kis ko dena, aur shaakh shaakh ka nafa nuqsan.',
  'Owner, Admin, Manager aur Finance.',
  'Mahine ke aakhir mein, aur jab bhi ye sawal ho ke "paisa gaya kahan" ya "kis se kitna lena hai".',
  array[
    'Upar patti se report chunein.',
    'Tareekh ki hadd chun kar "Dikhayein" dabayein.',
    'Chalta sarmaya aur lena-dena EK tareekh par hote hain -- wahan "tak" wali tareekh chalti hai.',
    'Kisi adad par shak ho to Maali Gosharay ke "Poora Journal" par ja kar wo entry dekhein jis se wo bana.'
  ],
  'Lena-dena wali report par jo naam sab se upar aayein, un ki wasooli ka kaam Khata aur Supplier ke safhon se hota hai.',
  array[
    'Cash flow ko nafe ka goshara samajh lena. Nafa aur paisa do alag cheezein hain: udhaar par bikri nafa hai magar paisa nahi, aur asaasa khareedna paisa hai magar kharcha nahi.',
    'Apne cash se apne bank mein paisa le jane ko "aamdani" samajhna. Wo yahan ginta hi nahi — wo paisa aaya ya gaya nahi, sirf jagah badli.',
    'Lena-dena wali report mein "bina naam ke" wali raqam nazar andaz kar dena. Utni raqam fehrist se BAHAR hai — us par bande ka nishaan lagna baqi hai.'
  ]
)
on conflict (feature_key, lang) do update set
  purpose    = excluded.purpose,
  who_uses   = excluded.who_uses,
  when_use   = excluded.when_use,
  how_steps  = excluded.how_steps,
  next_step  = excluded.next_step,
  mistakes   = excluded.mistakes,
  updated_at = now();
