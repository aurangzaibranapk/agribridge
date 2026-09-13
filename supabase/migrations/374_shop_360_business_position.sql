-- =====================================================================
-- AgriBridge — Migration 374: Shop 360 — Business Position (Phase 1)
-- =====================================================================
-- Malik ka poora spec (8 September, raat): "Maine is shop mein total
-- kitna paisa lagaya tha, aaj mera paisa kis kis jagah pada hai, kitna
-- kama/chala gaya, aur koi difference hai to woh kahan gaya?"
--
-- Phase 1 (confirmed order): Paisa Kahan Hai + Aaj ki Sale + Recovery +
-- Expense. Baqi phases (Cash Control, Stock FIFO, Investment/Withdrawal,
-- Aaj Ka Milaan) baad mein.
--
-- Koi naya finance/accounting table nahi -- maujooda POS/expense/ledger
-- data se hi ganwa jata hai (src/lib/pos/shop-360.ts).
-- =====================================================================

insert into public.features (key, label, label_en, label_ur, route, icon, is_sensitive, description, description_en, description_ur, is_active)
values (
  'shop-360',
  'Meri Dukan — Pura Hisaab',
  'Shop 360 — Business Position',
  'شاپ 360 — کاروباری پوزیشن',
  '/admin/shop-360',
  'PieChart',
  true,
  'Ek shop ka poora hisaab ek jagah -- paisa kahan hai (stock/cash/bank/digital), aaj ki sale/wasooli/kharcha payment-method ke hisaab se.',
  'One shop''s full financial picture -- where the money is (stock/cash/bank/digital), and today''s sale/recovery/expense by payment method.',
  'ایک شاپ کا پورا حساب ایک جگہ -- پیسہ کہاں ہے، اور آج کی بکری/وصولی/خرچہ۔',
  true
)
on conflict (key) do update set
  label = excluded.label, label_en = excluded.label_en, label_ur = excluded.label_ur,
  route = excluded.route, icon = excluded.icon, is_sensitive = excluded.is_sensitive,
  description = excluded.description, description_en = excluded.description_en, description_ur = excluded.description_ur,
  is_active = true;

insert into public.dashboard_features (dashboard_key, feature_key, sort_order, section)
values ('sales', 'shop-360', 5, null)
on conflict (dashboard_key, feature_key) do update set sort_order = excluded.sort_order;

-- Sales staff: sirf apni shop. Manager: apni poori branch (us ke neeche
-- ek se zyada shop ho sakti hain). Finance: sab shops. Owner/Admin
-- pehle se UNRESTRICTED_ROLES se guzarte hain, alag row nahi chahiye.
insert into public.role_feature_permissions (role, feature_key, actions, data_scope) values
  ('sales_staff', 'shop-360', array['view']::text[], 'own_shop'),
  ('manager', 'shop-360', array['view']::text[], 'own_branch'),
  ('finance', 'shop-360', array['view']::text[], 'all')
on conflict (role, feature_key) do update set actions = excluded.actions, data_scope = excluded.data_scope;

insert into public.feature_help
  (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
values (
  'shop-360',
  'rm',
  'Ek shop ka poora maali hisaab ek jagah -- is shop ka paisa abhi kahan para hai (stock, cash, bank, digital), aur aaj ki sale, wasooli aur kharcha payment-method ke hisaab se.',
  'Sales Staff (apni shop), Manager (apni branch ki shops), Finance/Owner/Admin (sab).',
  'Roz apni shop ka hisaab dekhne ke liye, ya kisi shop ki maali sehat check karne ke liye.',
  ARRAY[
    'Upar "Paisa Kahan Hai" mein dekhein stock, cash/bank/digital (lifetime) kis method mein kitna hai.',
    'Date range chun kar "Aaj ki Sale" payment-method ke hisaab se dekhein.',
    '"Aaj ki Recovery" mein purana udhaar wasool hone ka hisaab hai -- ye nayi sale nahi.',
    '"Aaj ka Kharcha" mein manzoor-shuda kharcha category ke hisaab se hai.'
  ],
  'Koi number samajh na aaye ya ghalat lage to us qatar ke neeche likhi wajah/note zaroor parhein -- kuch numbers abhi jaan boojh kar mehdood hain (Payable abhi shop tak nahi, Receivable branch tak hai).',
  ARRAY[
    'Receivable is safhe par SHOP ka nahi, poori BRANCH ka hai -- Load & Bill ka udhaar shop tag nahi karta.',
    'Recovery sirf Paisa & Khata se darj shuda ginti hai -- Load & Bill se ki gayi wasooli is mein shamil nahi.',
    'Payable abhi "-" hai -- sifar nahi, "track nahi hoti" hai.',
    'Stock Value abhi maal ki maujooda price se hai, asal cost se nahi (Phase 2 mein FIFO cost aayega).'
  ]
)
on conflict (feature_key, lang) do update set
  purpose = excluded.purpose, who_uses = excluded.who_uses, when_use = excluded.when_use,
  how_steps = excluded.how_steps, next_step = excluded.next_step, mistakes = excluded.mistakes,
  updated_at = now();
