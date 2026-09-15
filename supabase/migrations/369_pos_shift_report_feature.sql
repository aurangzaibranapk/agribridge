-- =====================================================================
-- AgriBridge — Migration 369: POS Shift Report ka feature registration
-- =====================================================================
-- Malik: "jaisy koi POS close hua, kitna paid off, kitna aaya, kitna
-- gaya, kis shift mein kitna tha, kitna outstanding bana hai — ye sab."
-- Phase 13 (Reporting) ka Counter/Shift Report.
-- =====================================================================

insert into public.features (key, label, label_en, label_ur, route, icon, is_sensitive, description, description_en, description_ur, is_active)
values (
  'reports.pos-shifts',
  'POS Shift Report',
  'POS Shift Report',
  'پی او ایس شفٹ رپورٹ',
  '/admin/reports/pos-shifts',
  'Receipt',
  true,
  'Har POS shift ka poora hisaab -- kitni bikri, kis tareeqe se (cash/digital/khata), aur cash band karte waqt farq. Branch → Shop → Counter → Shift → Staff.',
  'Full breakdown per POS shift -- sales by method (cash/digital/khata), and any cash difference at close. Branch → Shop → Counter → Shift → Staff.',
  'ہر پی او ایس شفٹ کا پورا حساب -- کتنی بکری، کس طریقے سے، اور کیش بند کرتے وقت فرق۔',
  true
)
on conflict (key) do update set
  label = excluded.label, label_en = excluded.label_en, label_ur = excluded.label_ur,
  route = excluded.route, icon = excluded.icon, is_sensitive = excluded.is_sensitive,
  description = excluded.description, description_en = excluded.description_en, description_ur = excluded.description_ur,
  is_active = true;

insert into public.dashboard_features (dashboard_key, feature_key, sort_order, section)
values ('sales', 'reports.pos-shifts', 11, null)
on conflict (dashboard_key, feature_key) do update set sort_order = excluded.sort_order;

-- Manager: apni branch ke shifts dekh sake. Owner/Admin unrestricted.
-- Sales staff ko nahi -- ye branch-wide maali nazar hai, cashier ka
-- apna kaam nahi (wo apna hisaab POS ki Shift patti par hi dekh leta
-- hai).
insert into public.role_feature_permissions (role, feature_key, actions, data_scope) values
  ('manager', 'reports.pos-shifts', array['view']::text[], 'own_branch')
on conflict (role, feature_key) do update set actions = excluded.actions, data_scope = excluded.data_scope;

insert into public.feature_help
  (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
values (
  'reports.pos-shifts',
  'rm',
  'Har POS shift (counter par staff ka session) ka poora hisaab ek jagah -- kitni bikri hui, kis tareeqe se (cash, digital, udhaar), aur band karte waqt golak ka farq agar koi bana.',
  'Manager (apni branch ke shifts) aur Owner/Admin (sab branches).',
  'Roz ke aakhir mein, ya jab kisi counter ka cash farq check karna ho.',
  ARRAY[
    'Upar tareekh ka arsa aur (Owner/Admin ke liye) Branch chunein.',
    'Har qatar ek Shift hai -- Branch → Shop → Counter → Staff wahi qatar mein.',
    'Farq wale khane laal rang mein hain -- fauran nazar aa jate hain.',
    'Khula shift ka hisaab "abhi tak" ka hai, ginti hone tak final nahi.'
  ],
  'Farq mile to us shift ke staff se poochhein -- ye report sirf dikhati hai, faisla insaan karta hai.',
  ARRAY['Khula shift ka "Farq" khali (—) hota hai jab tak band na ho -- ye sifar nahi, "abhi maloom nahi" hai.']
)
on conflict (feature_key, lang) do update set
  purpose = excluded.purpose, who_uses = excluded.who_uses, when_use = excluded.when_use,
  how_steps = excluded.how_steps, next_step = excluded.next_step, mistakes = excluded.mistakes,
  updated_at = now();
