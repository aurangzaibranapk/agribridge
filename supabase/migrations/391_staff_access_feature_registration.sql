-- =====================================================================
-- AgriBridge — Migration 391: /admin/staff-access khud ek feature bane
-- =====================================================================
-- Merge (testing/shop-360-zero-leakage) ne code mein "Departments &
-- Access" aur "Product Permissions" ko hata kar "Staff & Access
-- Control" (/admin/staff-access) bana diya -- magar `features` table
-- mein is naye safhe ki koi qatar hi nahi thi. Isi liye Owner ki sidebar
-- mein purana naam ("Departments & Access") hi dikhta raha -- wo qatar
-- click karne par naya safha khulta (page.tsx redirect karta hai), magar
-- sidebar apna purana naam nahi badalta, kyunke sidebar `features` table
-- se banti hai, code ke static naam se nahi (11 September, malik ne
-- pakra: "sidebar mein naam change nahi hua").
--
-- Purani do qataron ko band nahi kiya -- sirf sidebar se hataya, taake
-- purane bookmark/link (jo ab redirect karte hain) kaam karte rahen.
-- =====================================================================

insert into public.features (key, label, label_en, label_ur, route, icon, is_sensitive, description, description_en, is_active)
values (
  'staff-access',
  'Staff & Access Control',
  'Staff & Access Control',
  'اسٹاف اور رسائی کا کنٹرول',
  '/admin/staff-access',
  'ShieldCheck',
  true,
  'Banda, department, branch, shop aur access -- sab ek hi safhe se. Template apply karna, individual permission badalna, bulk access dena ya zero karna.',
  'Staff member, department, branch, shop and access template management, individual permission edits, and bulk access controls -- all from one page.',
  true
)
on conflict (key) do update set
  label = excluded.label, label_en = excluded.label_en, label_ur = excluded.label_ur,
  route = excluded.route, icon = excluded.icon, is_sensitive = excluded.is_sensitive,
  description = excluded.description, description_en = excluded.description_en, is_active = true;

insert into public.dashboard_features (dashboard_key, feature_key, sort_order, section)
values ('admin', 'staff-access', 70, 'Operations')
on conflict (dashboard_key, feature_key) do update set sort_order = excluded.sort_order, section = excluded.section;

-- Purane do safhe ab sirf redirect karte hain -- sidebar mein alag
-- qatar dikhana confusion banata hai.
update public.features set is_active = false where key in ('departments', 'product-permissions');

insert into public.feature_help
  (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
values (
  'staff-access',
  'rm',
  'Kisi bhi staff ka poora access ek hi jagah se: department/role, branch, shop, access template, aur agar zaroorat ho to individual permission. Yahin se bulk access (department ya sab departments) dena ya poora access zero karna bhi hota hai.',
  'Sirf Owner/Admin.',
  'Naya staff aaya ho, kisi ka department/shop badla ho, ya kisi ka access zero karna ho.',
  ARRAY[
    'Bayeen taraf se staff member chunein.',
    'Department/Role, Branch, Shop, aur Access Template chunein.',
    'Access summary dekh kar "Save Access" dabayein.',
    'Zaroorat ho to "Advanced" mein individual permission edit/remove karein, ya bulk buttons istemal karein.'
  ],
  'Staff `/admin/pos` ya apna home page khol kar dekh le ke naya access mil gaya.',
  ARRAY[
    'Template edit karne se pehle se lagi hui staff access khud nahi badalti -- template dobara apply karna parta hai.',
    'Owner/Admin ka access yahan se zero nahi hota (jaan boojh kar).'
  ]
)
on conflict (feature_key, lang) do update set
  purpose = excluded.purpose, who_uses = excluded.who_uses, when_use = excluded.when_use,
  how_steps = excluded.how_steps, next_step = excluded.next_step, mistakes = excluded.mistakes,
  updated_at = now();
