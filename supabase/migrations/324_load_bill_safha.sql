-- =====================================================================
-- AgriBridge — Migration 324: Load & Bill ke safhe, ijazat aur madad
-- =====================================================================
-- 323 mein khane bane. Yahan safhe menu par aate hain, ijazat tay hoti
-- hai, aur Help likhi jati hai.
--
-- IJAZAT KA BUNYADI FAISLA:
--
--   Load/bill DARJ karna     -> POS wala staff (rozana ka kaam)
--   Float mein paisa daalna  -> sirf Manager / Finance / Admin
--   Milan ka FARQ manzoor    -> sirf Manager / Finance / Admin
--
-- Ye taqseem jaan boojh kar hai. Jo banda qatarein darj karta hai, wohi
-- agar farq bhi khud manzoor kar sakta ho, to farq ka matlab hi khatam
-- ho jata hai: jis se ginti mein ghalti hui wohi us ghalti ko "theek"
-- keh dega. Isi liye milan ka safha staff ko KHULTA hai (wo asal balance
-- likh sakta hai) magar farq khate mein daalne ka ikhtiyar us ke paas
-- nahi.
--
-- "Float aur account" HASSAS (sensitive) hai: wahan se paisa bank se
-- nikal kar provider ke account mein jata hai.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Load & Bill -- rozana ka safha
-- ---------------------------------------------------------------------
insert into public.features
  (key, label, label_en, label_ur, route, icon, is_sensitive, description, description_en, description_ur, is_active)
values (
  'load-bill',
  'Load & Bill',
  'Load & Bill',
  'لوڈ اور بل',
  '/admin/load-bill',
  'Smartphone',
  false,
  'Mobile load aur customer ke bill — provider ke float ke hisaab ke sath.',
  'Mobile load and customer bill payments — tracked against provider float.',
  'موبائل لوڈ اور کسٹمر کے بل — پرووائیڈر کے فلوٹ کے حساب کے ساتھ۔',
  true
)
on conflict (key) do update set
  label = excluded.label, label_en = excluded.label_en, label_ur = excluded.label_ur,
  route = excluded.route, icon = excluded.icon, is_sensitive = excluded.is_sensitive,
  description = excluded.description, description_en = excluded.description_en,
  description_ur = excluded.description_ur, is_active = true;

insert into public.dashboard_features (dashboard_key, feature_key, sort_order, section)
values ('sales', 'load-bill', 12, null)
on conflict (dashboard_key, feature_key) do update set sort_order = excluded.sort_order;

insert into public.role_feature_permissions (role, feature_key, actions, data_scope)
values
  ('staff',    'load-bill', array['view','create'], 'own_branch'),
  ('cashier',  'load-bill', array['view','create'], 'own_branch'),
  ('manager',  'load-bill', array['view','create','edit'], 'all'),
  ('finance',  'load-bill', array['view','create','edit'], 'all')
on conflict (role, feature_key) do update set
  actions = excluded.actions, data_scope = excluded.data_scope;

insert into public.feature_help
  (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
values (
  'load-bill',
  'rm',
  'Customer ka mobile load aur us ke bill (bijli, gas, internet) darj karna — aur ye dekhna ke provider ke account mein kitna float baqi hai.',
  'POS par baitha staff. Float mein paisa daalna aur milan ka farq manzoor karna Manager/Finance ka kaam hai.',
  'Jab bhi koi customer load karwaye ya bill jama karwaye — usi waqt, wahin.',
  ARRAY[
    'Upar "Mobile Load" ya "Bill Payment" chunein.',
    'Provider ka account chunein — us ke saath us ka float likha hota hai. Float kam ho to qatar rok di jayegi.',
    'Mobile number (ya consumer number), raqam, aur agar customer se kuch extra liya to service charge likhein.',
    'Kaam PROVIDER KI APP mein karein (Jazz/Easypaisa), phir wahan se TID copy kar ke yahan lagayein.',
    '"Load ho gaya — darj karein" dabayein.',
    'Shaam ko "Shaam ka milan" par ja kar provider ki app ka asal balance likhein.'
  ],
  'Shaam ko /admin/load-bill/reconcile par milan karein.',
  ARRAY[
    'AgriBridge load BHEJTA NAHI — sirf DARJ karta hai. Load provider ki app se jata hai. Yahan darj kar dene ka matlab ye nahi ke load chala gaya.',
    'Rs 1,000 ka load Rs 1,000 ki AAMDANI NAHI hai. Wo customer ka paisa hai jo provider tak ja raha hai. Aamdani sirf service charge hai, aur wo commission jo statement ke baad tasdeeq ho.',
    'Commission ke saamne jo adad "muntazir" ke saath likha hai wo ANDAZA hai, aamdani nahi. Us ko apna nafa samajh kar hisaab na karein.',
    'Service charge ke khane mein sifar likhne ki zaroorat nahi — customer se kuch extra nahi liya to khana khali chhor dein. "Liya hi nahi" aur "sifar liya" ek cheez nahi.',
    '"Saboot baqi" ka matlab "nakaam" nahi. Us ka matlab hai ke kaam ho gaya magar provider ki TID abhi nahi lagi. TID lagate hi wo "darj" ho jata hai.'
  ]
)
on conflict (feature_key, lang) do update set
  purpose = excluded.purpose, who_uses = excluded.who_uses, when_use = excluded.when_use,
  how_steps = excluded.how_steps, next_step = excluded.next_step, mistakes = excluded.mistakes,
  updated_at = now();


-- ---------------------------------------------------------------------
-- 2) Float aur account -- hassas
-- ---------------------------------------------------------------------
insert into public.features
  (key, label, label_en, label_ur, route, icon, is_sensitive, description, description_en, description_ur, is_active)
values (
  'load-bill.float',
  'Float aur account',
  'Float & accounts',
  'فلوٹ اور اکاؤنٹ',
  '/admin/load-bill/accounts',
  'ArrowLeftRight',
  true,
  'Provider ke account, un ka float, aur float mein paisa daalna.',
  'Provider accounts, their float, and topping the float up.',
  'پرووائیڈر کے اکاؤنٹ، ان کا فلوٹ، اور فلوٹ میں پیسہ ڈالنا۔',
  true
)
on conflict (key) do update set
  label = excluded.label, label_en = excluded.label_en, label_ur = excluded.label_ur,
  route = excluded.route, icon = excluded.icon, is_sensitive = excluded.is_sensitive,
  description = excluded.description, description_en = excluded.description_en,
  description_ur = excluded.description_ur, is_active = true;

insert into public.dashboard_features (dashboard_key, feature_key, sort_order, section)
values ('finance', 'load-bill.float', 14, null)
on conflict (dashboard_key, feature_key) do update set sort_order = excluded.sort_order;

insert into public.role_feature_permissions (role, feature_key, actions, data_scope)
values
  ('manager', 'load-bill.float', array['view','create'], 'all'),
  ('finance', 'load-bill.float', array['view','create'], 'all')
on conflict (role, feature_key) do update set
  actions = excluded.actions, data_scope = excluded.data_scope;

insert into public.feature_help
  (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
values (
  'load-bill.float',
  'rm',
  'Provider ke retailer account (Jazz, Easypaisa, UBL Omni) aur un ka float. Yahin se float mein paisa dala jata hai.',
  'Manager, Finance, Admin aur Malik. POS wale staff ko ye safha nahi khulta — wo sirf float DEKHTA hai, badalta nahi.',
  'Subah kaam shuru karne se pehle, aur jab kisi account ka float kam ho jaye.',
  ARRAY[
    'Upar har account ka maujooda float dekhein.',
    'Daayen taraf: kis account mein paisa daalna hai, kis khate (bank/golak) se gaya, aur kitna.',
    '"Float mein daalein" dabayein — paisa us khate se nikal kar provider ke account mein chala jayega.'
  ],
  'Shaam ko milan par ja kar asal balance se milayein.',
  ARRAY[
    'Float recharge KHARCHA NAHI hai. Paisa sirf ek jagah se doosri jagah gaya — bank ghata, provider ka account barha. Is ko kharcha samajh lena nafa nuqsan ka poora safha ghalat kar deta hai.',
    'Float STOCK NAHI hai. Ye dukan ka maal nahi jo bikta ho — ye ek asaasa (asset) hai jaise bank mein para paisa.',
    'Float ka balance yahan alag se likha hua nahi hai — wo ledger ki qataron se ginta hai. Isi liye yahan use "theek" karne ka koi khana nahi: farq milan par darj hota hai, wajah ke saath.'
  ]
)
on conflict (feature_key, lang) do update set
  purpose = excluded.purpose, who_uses = excluded.who_uses, when_use = excluded.when_use,
  how_steps = excluded.how_steps, next_step = excluded.next_step, mistakes = excluded.mistakes,
  updated_at = now();


-- ---------------------------------------------------------------------
-- 3) Shaam ka milan
-- ---------------------------------------------------------------------
insert into public.features
  (key, label, label_en, label_ur, route, icon, is_sensitive, description, description_en, description_ur, is_active)
values (
  'load-bill.reconcile',
  'Load/Bill ka milan',
  'Load & Bill reconciliation',
  'لوڈ اور بل کا ملان',
  '/admin/load-bill/reconcile',
  'Scale',
  false,
  'Hisaab kya kehta hai aur provider ki app kya kehti hai — roz ka milan.',
  'What the books say versus what the provider app says — the daily match.',
  'حساب کیا کہتا ہے اور پرووائیڈر کی ایپ کیا کہتی ہے — روز کا ملان۔',
  true
)
on conflict (key) do update set
  label = excluded.label, label_en = excluded.label_en, label_ur = excluded.label_ur,
  route = excluded.route, icon = excluded.icon, is_sensitive = excluded.is_sensitive,
  description = excluded.description, description_en = excluded.description_en,
  description_ur = excluded.description_ur, is_active = true;

insert into public.dashboard_features (dashboard_key, feature_key, sort_order, section)
values ('sales', 'load-bill.reconcile', 13, null)
on conflict (dashboard_key, feature_key) do update set sort_order = excluded.sort_order;

insert into public.role_feature_permissions (role, feature_key, actions, data_scope)
values
  ('staff',   'load-bill.reconcile', array['view','create'], 'own_branch'),
  ('cashier', 'load-bill.reconcile', array['view','create'], 'own_branch'),
  ('manager', 'load-bill.reconcile', array['view','create','edit'], 'all'),
  ('finance', 'load-bill.reconcile', array['view','create','edit'], 'all')
on conflict (role, feature_key) do update set
  actions = excluded.actions, data_scope = excluded.data_scope;

insert into public.feature_help
  (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
values (
  'load-bill.reconcile',
  'rm',
  'Din ke aakhir mein ye milana ke hamare hisaab se float kitna hona chahiye, aur provider ki app mein waqai kitna hai. Farq ho to us ki wajah darj karna.',
  'Jo banda POS chalata hai wo asal balance likh sakta hai. Farq ko khate mein daalna Manager/Finance ka kaam hai — jaan boojh kar, taake jis se ginti mein ghalti hui wohi us ghalti ko "theek" na keh de.',
  'Roz shaam ko, dukan band karne se pehle.',
  ARRAY[
    'Upar account aur tareekh chunein.',
    'Bayen taraf poora hisaab dekhein: subah ka float, din mein dala hua paisa, load, bill — aur "float itna hona chahiye".',
    'Provider ki app khol kar us ka ASAL balance dekhein.',
    'Wohi adad daayen taraf likhein. Farq khud nikal aayega.',
    'Farq ho to us ki wajah likhein — bina wajah milan darj nahi hoga.'
  ],
  'Cash ki ginti /admin/cash-close par karein — load/bill ka cash us mein khud shaamil hota hai.',
  ARRAY[
    'Asal balance ka khana khali chhorna "sifar" nahi hai — us ka matlab hai ke abhi dekha hi nahi gaya. Is liye safha use khali qabool nahi karta.',
    'Rs 1 ka farq ho sakta hai, magar Rs 1 be-wajah nahi reh sakta. Wajah likhe baghair milan darj nahi hota.',
    'Wo bill jo abhi provider tak nahi pahuncha (ada baqi) is hisaab mein NAHI ginta — us ka paisa abhi hamare paas hai, provider ke account se nahi gaya.',
    '"Saboot baqi" wali qatarein hisaab mein ginti hain (kaam ho chuka hai), magar TID na hone se farq ki wajah dhoondhna mushkil ho jata hai. Milan se pehle TID laga lein.'
  ]
)
on conflict (feature_key, lang) do update set
  purpose = excluded.purpose, who_uses = excluded.who_uses, when_use = excluded.when_use,
  how_steps = excluded.how_steps, next_step = excluded.next_step, mistakes = excluded.mistakes,
  updated_at = now();
