-- =====================================================================
-- AgriBridge — Migration 310: Khate ka ledger nizam mein darj
-- =====================================================================
-- Malik ka kehna (5 September, Trial Balance dekh kar):
--
--   "mery her ledger mein jahan jahan use ho raha hai debit credit OR
--    BALANCE aana chahiye. Yahan sirf 2 kyun -- debit aur credit --
--    teesri line balance bhi aani chahiye ... sab details ke sath aaye,
--    hamein kal ko asani ho track karne ki."
--
-- Do cheezein us ka jawab hain:
--
--   1. Trial Balance par teesra khana (Baqi) aur us ka rukh (Dr/Cr).
--      Wo safhe ki tabdeeli hai, is migration ka hissa nahi.
--
--   2. HAR KHATE KA APNA LEDGER -- qatar dar qatar, har qatar ke saamne
--      chalta hua baqi. Trial Balance batata hai ke khate mein kitna
--      para hai; ye batata hai ke wo raqam BANI KAISE. Yehi wo cheez hai
--      jo "kal ko track karne" ke kaam aati hai, aur yahi ab tak nahi
--      thi.
--
-- Ledger ka safha kisi bhi khate ke naam par click karne se khulta hai:
-- Trial Balance se, Khaton ki Fehrist se, aur Maali Reports ke "Khaton
-- ka baqi" se.
-- =====================================================================

insert into public.features (key, label, label_en, label_ur, route, is_active, is_sensitive, description)
values
  ('finance.ledger', 'Khate ka Ledger', 'Account Ledger', 'کھاتے کا لیجر',
   '/admin/finance/ledger', true, true,
   'Ek khate ki har qatar -- tareekh, entry, wajah, debit, credit aur har qatar ke baad ka chalta hua baqi.')
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
  ('manager', 'finance.ledger', array['view'], 'all'),
  ('finance', 'finance.ledger', array['view'], 'all')
on conflict (role, feature_key) do update set
  actions    = excluded.actions,
  data_scope = excluded.data_scope;

insert into public.dashboard_features (dashboard_key, feature_key, sort_order, section, section_order)
values ('finance', 'finance.ledger', 12, 'Maali Hisaab', 0)
on conflict (dashboard_key, feature_key) do update set
  sort_order    = excluded.sort_order,
  section       = excluded.section,
  section_order = excluded.section_order;

insert into public.feature_help
  (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
values
(
  'finance.ledger', 'rm',
  'Ek khate ki poori kahani: har qatar ke saamne tareekh, entry ka number, wajah, debit, credit aur us qatar ke BAAD ka baqi.',
  'Owner, Admin, Manager aur Finance.',
  'Jab kisi khate ke adad par shak ho -- ya ye dekhna ho ke wo raqam bani kaise.',
  array[
    'Khata chunein aur tareekh ki hadd daalein.',
    'Sab se upar "is tareekh se pehle ka baqi" hai -- us ke baghair pehli qatar ka baqi adhoora hota.',
    'Har qatar ke aakhir mein chalta hua baqi hai; wo khate ke apne rukh par ginta hai.',
    'Trial Balance ya Khaton ki Fehrist par kisi khate ke naam par click karne se bhi yahi safha khulta hai.'
  ],
  'Jo qatar samajh na aaye, us ka entry number le kar "Poora Journal" par jayein -- wahan us entry ke dono rukh nazar aate hain.',
  array[
    'Shuru wale baqi ko nazar andaz karna. Ledger sirf chuni hui tareekhon ka hai; us se pehle ka sab kuch upar wali ek qatar mein hai.',
    'Chalte hue baqi ko har khate par ek tarah samajhna. Debit rukh wale khate mein debit barhata hai, credit rukh wale mein credit -- isi liye qatar ke saamne Dr/Cr likha hota hai.',
    'Yahan se kisi adad ko theek karne ki koshish. Ledger sirf dikhata hai; durusti hamesha us safhe se hoti hai jahan se wo entry bani thi (ya ulti entry se).'
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
