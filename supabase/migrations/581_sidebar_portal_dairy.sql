-- 581: Sidebar + OS Portal tiles for the Portal & Dairy admin pages. ADDITIVE ONLY.
-- Phase 6 polish. /admin/customer-portal, /admin/dairy and /admin/dairy/breeding
-- (572-578) had no features rows, so they were reachable only via ERP Naqsha
-- or search. Same pattern as 533: dashboards -> dashboard_features -> features,
-- every insert `on conflict do nothing` (existing rows are never updated).
--
-- Who sees them: the pages themselves only open for owner / super_admin / admin
-- (ADMIN_ROLES = UNRESTRICTED_ROLES), and loadNav shows unrestricted roles the
-- whole registry. No user_feature_permissions rows are added, so nobody gets new
-- access. is_sensitive = true. No WhatsApp / notification is sent.
-- Badge counts are NOT part of this migration (separate admin-badges design);
-- the rows only use stable feature keys + routes, so badges can key off them later.
--
-- NOT applied on live (ktskwawkslaznkjjacni) -- needs owner approval first.

insert into public.dashboards (key, label, label_en, label_ur, icon, summary, description, description_en, description_ur, sort_order, is_active)
values ('portal-dairy', 'Portal aur Dairy', 'Portal & Dairy', 'پورٹل اور ڈیری', 'Beef',
  'Gahak portal aur kisanon ki dairy', 'Gahak portal ki darkhwastein, kisanon ki dairy aur nasal/sehat',
  'Customer portal requests, farmer dairy and breeding/health', 'گاہک پورٹل کی درخواستیں، کسانوں کی ڈیری اور نسل/صحت',
  95, true)
on conflict (key) do nothing;

insert into public.features (key, label, label_en, label_ur, description, description_en, description_ur, route, icon, is_sensitive, is_active)
values
  ('customer-portal.admin', 'Customer Portal', 'Customer Portal', 'کسٹمر پورٹل',
   'Gahak ki adaigi, tabdeeli aur wade ki darkhwastein (maker / checker)', 'Customer payment, change and promise requests (maker / checker)', 'گاہک کی ادائیگی، تبدیلی اور وعدے کی درخواستیں',
   '/admin/customer-portal', 'ShieldCheck', true, true),
  ('customer-portal.accounts', 'Portal Accounts', 'Portal Accounts', 'پورٹل اکاؤنٹس',
   'Jin gahakon ka portal login chal raha hai -- invite sirf admin ki tasdeeq ke baad', 'Customers with an active portal login -- invite only after admin confirms', 'جن گاہکوں کا پورٹل لاگ ان چل رہا ہے',
   '/admin/customer-portal?f=on', 'KeyRound', true, true),
  ('dairy.admin', 'Dairy (all farmers)', 'Dairy (all farmers)', 'ڈیری (سب کسان)',
   'Har kisan ki dairy ka nafa nuqsan, rupay tak -- sheet export', 'Every farmer''s dairy P&L to the rupee -- sheet export', 'ہر کسان کی ڈیری کا نفع نقصان',
   '/admin/dairy', 'Beef', true, true),
  ('dairy.breeding', 'Nasal aur Sehat', 'Breeding & Health', 'نسل اور صحت',
   'Aane wali byaant, PD aur doodh ki rok (withdrawal)', 'Upcoming calvings, PD checks and milk withdrawal', 'آنے والی بیانت، پی ڈی اور دودھ کی روک',
   '/admin/dairy/breeding', 'HeartPulse', true, true)
on conflict (key) do nothing;

insert into public.dashboard_features (dashboard_key, feature_key, section, section_order, sort_order)
values
  ('portal-dairy', 'customer-portal.admin',    'Portal', 1, 10),
  ('portal-dairy', 'customer-portal.accounts', 'Portal', 1, 20),
  ('portal-dairy', 'dairy.admin',              'Dairy',  2, 30),
  ('portal-dairy', 'dairy.breeding',           'Dairy',  2, 40)
on conflict (dashboard_key, feature_key) do nothing;
