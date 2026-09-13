-- =====================================================================
-- AgriBridge — Migration 321: "Mera HR" — staff ka apna safha
-- =====================================================================
-- Malik ne 5 September ko ek HR self-service app dikha kar kaha:
-- *"mujhe ye saara kaam chahiye, same to same bana do."*
--
-- Us app ki asal khoobi safhe ka design nahi -- **ek jagah** hona hai.
-- Staff ko apni hazri, apni chhutti, apni tankhwah aur apne baqi kaam ke
-- liye chaar alag safhe yaad nahi rakhne parte.
--
-- Hamare yahan ye saari cheezein PEHLE SE maujood thin, magar bikhri hui
-- (Meri Hazri, Chhutti, Staff Khata, Mera Kaam). Is safhe par koi naya
-- nizam nahi bana -- wohi purane khane, wohi purani rok, sirf ek jagah
-- jama.
--
-- Ye feature "sensitive" NAHI hai: is par har banda sirf APNA hisaab
-- dekhta hai, kisi aur ka nahi. Is liye ye har staff ko khulta hai --
-- warna wohi masla rehta jis se bachna tha.
--
-- JO CHEEZ NAHI BANI, US KA BOX BHI NAHI: safar ki darkhwast, ghar se
-- kaam, policies, organogram aur istifa. Khali box laga dena -- jo
-- dabane par kuch na kare -- us se bura hai ke box hi na ho: banda us
-- par bharosa kar ke intezar karta hai aur us ki darkhwast kahin jati hi
-- nahi. Safha khud saaf likh deta hai ke ye abhi nahi bane.
-- =====================================================================

insert into public.features (key, label, label_en, label_ur, route, icon, is_sensitive, description, description_en, description_ur, is_active)
values (
  'my-hr',
  'Mera HR',
  'My HR',
  'میرا ایچ آر',
  '/admin/my-hr',
  'UserRound',
  false,
  'Apni hazri, chhutti, tankhwah aur baqi kaam — ek jagah.',
  'Your own attendance, leave, salary and pending work — in one place.',
  'اپنی حاضری، چھٹی، تنخواہ اور باقی کام — ایک جگہ۔',
  true
)
on conflict (key) do update set
  label = excluded.label, label_en = excluded.label_en, label_ur = excluded.label_ur,
  route = excluded.route, icon = excluded.icon, is_sensitive = excluded.is_sensitive,
  description = excluded.description, description_en = excluded.description_en,
  description_ur = excluded.description_ur, is_active = true;

insert into public.dashboard_features (dashboard_key, feature_key, sort_order, section)
values ('hr', 'my-hr', 5, null)
on conflict (dashboard_key, feature_key) do update set sort_order = excluded.sort_order;

insert into public.feature_help
  (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
values (
  'my-hr',
  'rm',
  'Aap ka apna hisaab ek jagah: aaj ki hazri, is saal ki chhutti kitni baqi hai, is mahine kitni dafa der se aaye, kitne kaam aap ke zimme hain, mahine ka hazri calendar, aur apni tankhwah ki parchi.',
  'Har staff. Har banda sirf APNA hisaab dekhta hai -- kisi aur ka nahi.',
  'Roz subah kaam shuru karte waqt, aur mahine ke aakhir mein tankhwah dekhne ke liye.',
  ARRAY[
    'Upar "Aaj ki hazri" se check-in/check-out karein.',
    'Chaar khane dekhein: chhutti baqi, is mahine der se, baqi kaam, is saal ghair-hazri.',
    'Calendar par apna poora mahina dekhein -- hazir, aadha din, chhutti, ghair-hazir.',
    'Neeche apni tankhwah ki parchi -- pichhle chhe mahine.',
    'Daayen taraf "Jaldi wale kaam" se chhutti ki darkhwast, hazri theek karwana ya kharcha claim karein.'
  ],
  'Kaam ki fehrist ke liye "Mera Kaam" par jayein.',
  ARRAY[
    'Calendar par KHALI din ka matlab "hazir" nahi -- us ka matlab hai ke us din koi indraj hi nahi hua. Chhutti, ghair-hazri aur "indraj nahi" teenon alag cheezein hain.',
    'Chhutti ke khane par "—" ka matlab hai ke company ki chhutti policy abhi darj nahi -- ye "sifar chhutti" nahi hai.',
    'Safar ki darkhwast, ghar se kaam, policies, organogram aur istifa abhi bane nahi. Safha khud ye baat likh kar batata hai -- inhen dhoondhne mein waqt zaya na karein.'
  ]
)
on conflict (feature_key, lang) do update set
  purpose = excluded.purpose, who_uses = excluded.who_uses, when_use = excluded.when_use,
  how_steps = excluded.how_steps, next_step = excluded.next_step, mistakes = excluded.mistakes,
  updated_at = now();
