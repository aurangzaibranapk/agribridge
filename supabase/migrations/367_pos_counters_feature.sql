-- =====================================================================
-- AgriBridge — Migration 367: POS Counters ka feature registration
-- =====================================================================
-- 366 mein schema bana; ye migration us par safha, ijazat aur madad
-- lagati hai -- malik ka 2 September wala usool: feature + permission +
-- help ek hi commit mein.
-- =====================================================================

insert into public.features (key, label, label_en, label_ur, route, icon, is_sensitive, description, description_en, description_ur, is_active)
values (
  'pos-counters',
  'POS Counters',
  'POS Counters',
  'پی او ایس کاؤنٹرز',
  '/admin/pos-counters',
  'Store',
  false,
  'Har shop ke POS counter banana, aur staff ko un counters ki ijazat dena — ek staff kai shops ke counter chala sakta hai.',
  'Create POS counters for each shop, and grant staff access to them — one staff member can operate counters across multiple shops.',
  'ہر شاپ کے پی او ایس کاؤنٹر بنانا، اور اسٹاف کو ان کاؤنٹرز کی اجازت دینا — ایک اسٹاف کئی شاپس کے کاؤنٹر چلا سکتا ہے۔',
  true
)
on conflict (key) do update set
  label = excluded.label, label_en = excluded.label_en, label_ur = excluded.label_ur,
  route = excluded.route, icon = excluded.icon, is_sensitive = excluded.is_sensitive,
  description = excluded.description, description_en = excluded.description_en, description_ur = excluded.description_ur,
  is_active = true;

insert into public.dashboard_features (dashboard_key, feature_key, sort_order, section)
values ('sales', 'pos-counters', 10, null)
on conflict (dashboard_key, feature_key) do update set sort_order = excluded.sort_order;

-- Manager: apni branch ke counters bana/dekh/badal sake. Owner/Admin
-- unrestricted hain, alag qatar ki zaroorat nahi.
insert into public.role_feature_permissions (role, feature_key, actions, data_scope) values
  ('manager', 'pos-counters', array['view','create','edit']::text[], 'own_branch')
on conflict (role, feature_key) do update set actions = excluded.actions, data_scope = excluded.data_scope;

insert into public.feature_help
  (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
values (
  'pos-counters',
  'rm',
  'Ek Branch ke andar har Shop (Karyana, Agri Inputs, Vets...) ka apna POS Counter banta hai, aur staff ko us counter ki ijazat di jati hai. Ek staff kai counters chala sakta hai — usay har shop ka alag login nahi chahiye.',
  'Manager (apni branch ke counters) aur Owner/Admin (sab branches).',
  'Nayi shop khulte waqt, ya kisi staff ko doosri shop ka POS bhi chalana ho.',
  ARRAY[
    'Branch aur Shop chunein, Counter ka naam likhein (jaise "Karyana POS-01").',
    'Counter ban jate hi us ka Stock Source (warehouse) khud us shop se lag jata hai.',
    'Neeche staff ka naam chun kar "Ijazat dein" dabayein — wo ab is counter par bech sakta hai.',
    'Ijazat hatani ho to usi qatar se "Hatayein" dabayein.'
  ],
  'Staff `/admin/pos` par jaye — agar us ke paas ek se zyada counter hon to wahan "Sale kahan karni hai?" ka chunao aayega.',
  ARRAY[
    'Staff ki branch counter ki branch se alag ho to ijazat nahi milti — pehle us ki profile ki branch theek karein.',
    'Counter band (inactive) karne se us par ho chuki sales nahi mitti, sirf nayi sale rukti hai.'
  ]
)
on conflict (feature_key, lang) do update set
  purpose = excluded.purpose, who_uses = excluded.who_uses, when_use = excluded.when_use,
  how_steps = excluded.how_steps, next_step = excluded.next_step, mistakes = excluded.mistakes,
  updated_at = now();
