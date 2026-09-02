-- =====================================================================
-- AgriBridge — Migration 268: Academy, Training Mode, Simple/Advanced
-- =====================================================================
-- Guided ERP (docs/GUIDED-ERP.md) ke qadam D aur E.
--
-- training_modules: har department ka chhota course -- video (malik
-- ki), qadam, "demo try karein" ka safha. staff_training_progress: kis
-- ne kaun sa module poora kiya. profiles.training_mode: naya banda
-- Training Mode mein login hota hai (sirf apne 3-4 kaam, Academy ka
-- raasta); wo khud band karta hai. profiles.ui_mode: simple (kam
-- khane) ya advanced (sab); Owner/Admin advanced se shuru.
--
-- Simple mode khane CHHUPATA hai, rok nahi hataata -- rok database
-- par hai aur wahin rehti hai.
-- =====================================================================

alter table profiles
  add column if not exists training_mode boolean not null default true,
  add column if not exists ui_mode text not null default 'simple';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_profiles_ui_mode') then
    alter table profiles add constraint chk_profiles_ui_mode check (ui_mode in ('simple', 'advanced'));
  end if;
end;
$$;

-- Purane staff training mode mein nahi phansain; Owner/Admin advanced.
update profiles set training_mode = false;
update profiles set ui_mode = 'advanced' where role::text in ('owner', 'super_admin', 'admin');

create table if not exists training_modules (
  key text primary key,
  department_key text,
  title text not null,
  title_en text,
  title_ur text,
  summary text,
  video_url text,
  steps text[] not null default '{}',
  try_route text,
  sort_order integer not null default 100,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists staff_training_progress (
  profile_id uuid not null references profiles(id) on delete cascade,
  module_key text not null references training_modules(key) on delete cascade,
  status text not null default 'in_progress',
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (profile_id, module_key),
  constraint chk_training_status check (status in ('in_progress', 'done'))
);

alter table training_modules enable row level security;
alter table staff_training_progress enable row level security;

drop policy if exists training_modules_read on training_modules;
create policy training_modules_read on training_modules for select to authenticated using (public.fn_is_any_staff());
drop policy if exists training_modules_write on training_modules;
create policy training_modules_write on training_modules for all to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_active and p.role::text in ('owner','super_admin','admin')))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_active and p.role::text in ('owner','super_admin','admin')));

drop policy if exists training_progress_own on staff_training_progress;
create policy training_progress_own on staff_training_progress for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
drop policy if exists training_progress_managers_read on staff_training_progress;
create policy training_progress_managers_read on staff_training_progress for select to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_active and p.role::text in ('owner','super_admin','admin','manager','hr')));

insert into training_modules (key, department_key, title, title_en, title_ur, summary, steps, try_route, sort_order) values
  ('procurement', 'procurement', 'Kharid (Purchase)', 'Purchase Training', 'خرید', 'Supplier ka bill kaise charhta hai, AI kya karta hai, manzoori, maal ginna, supplier ka dena.',
   array['Supplier ka bill /admin/products/bill-rates par charhayein (photo, PDF ya sheet).', 'AI ki parhi qatarein dekhein; andaze wali qatar khol kar Save dabayein.', 'Rate charhayein, phir "Purchase banayein".', 'Owner/Admin /admin/purchases par manzoor karta hai.', 'Maal aane par /admin/inventory/receiving par ginein: theek / toota / kam.', 'Dena /admin/purchases/bills par -- sirf theek aaye maal ka.'],
   '/admin/products/bill-rates', 10),
  ('warehouse', 'warehouse', 'Godam (Warehouse)', 'Warehouse Training', 'گودام', 'Maal ginna, stock, batch aur miyaad, bhejna, wapas, ginti.',
   array['Manzoor purchase ka maal /admin/inventory/receiving par ginein.', 'Stock /admin/inventory par; product ke naam par card (batch, miyaad, rakha hua).', 'Shop ko maal /admin/stock-transfers se bhejein; receive tak lene wale ke stock mein nahi.', 'Shop ke orders /admin/purchases/grn par receive karein.', 'Mahine mein ek dafa /admin/stock-count par asal ginti.', 'Har tabdeeli /admin/stock-ledger mein nazar aati hai.'],
   '/admin/inventory/receiving', 20),
  ('sales', 'sales', 'Dukan aur POS', 'Shop / POS Training', 'دکان اور POS', 'Bikri, stock order, receiving, wapas, raat ki ginti.',
   array['/admin/pos par scan ya naam se cheez, cash ya khata.', 'Cheez na mile: rate baqi hai (Product Setup) ya stock nahi.', 'Godam se maal /admin/pos/ordering se mangwayein.', 'Aaya maal /admin/purchases/grn par receive karein.', 'Wapas /admin/agri-returns se.', 'Raat ko /admin/cash-close par cash ginein.'],
   '/admin/pos', 30),
  ('finance', 'finance', 'Finance', 'Finance Training', 'فنانس', 'Lena dena, adaigi, supplier aur gahak ka khata, cash.',
   array['Supplier ka dena /admin/purchases/bills -- teenon adad sath dekhein.', 'Adaigi /admin/suppliers se likhein; dena khud dobara banta hai.', 'Gahak ka khata /admin/crm par.', 'Raat ki cash ginti ka farq /admin/cash-close se dekhein.', 'Sifar aur "hisaab nahi" ek cheez nahi -- "—" ko sifar na samjhein.'],
   '/admin/purchases/bills', 40),
  ('admin_office', 'admin_office', 'Admin', 'Admin Training', 'ایڈمن', 'Users, ijazatein, department, safhon ki maloomat.',
   array['Users aur role /admin/users par.', 'Har feature ki ijazat /admin/permissions par.', 'Menu department se banta hai -- /admin/departments.', 'Har safhe ki maloomat /admin/platform/help par likhein -- AI wahi batata hai.', 'Team ki training /admin/academy/team par.'],
   '/admin/permissions', 50),
  ('dairy', 'dairy', 'Doodh (Milk)', 'Milk Training', 'دودھ', 'Doodh jama karna, chiller, dispatch, kisan ki adaigi.',
   array['/admin/milk-collection/collect par roz ka doodh.', 'Chiller aur FAT /admin/milk-collection/chiller.', 'Verify /admin/milk-collection/verify.', 'Dispatch aur route ki kami /admin/milk-collection/routes.'],
   '/admin/milk-collection/collect', 60),
  ('machinery', 'machinery', 'Machinery', 'Machinery Training', 'مشینری', 'Booking, dispatch, kaam ka indraj, wusooli.',
   array['Booking /admin/machinery-rental par.', 'Kaam ki qatarein aur dispatch dashboard se.', 'Bill aur wusooli booking ke andar.'],
   '/admin/machinery-rental', 70),
  ('manager', 'manager', 'Manager', 'Manager Training', 'منیجر', 'Manzooriyan, masle, team ka khulasa.',
   array['Mera Kaam par "Aaj kya baqi hai" -- pehle lal wale.', 'Purchase ki manzoori /admin/purchases par; shop orders /admin/agri-orders par.', 'Team ki training /admin/academy/team par.'],
   '/admin/my-work', 80)
on conflict (key) do update set title = excluded.title, title_en = excluded.title_en, title_ur = excluded.title_ur, summary = excluded.summary, steps = excluded.steps, try_route = excluded.try_route, sort_order = excluded.sort_order, updated_at = now();

insert into public.features (key, label, label_en, label_ur, description, description_en, description_ur, route, icon, is_sensitive, is_active) values
  ('academy', 'AgriBridge Academy', 'AgriBridge Academy', 'اکیڈمی', 'Har department ka 5 minute ka course, demo aur AI', 'Short course per department, demo and AI', 'ہر ڈیپارٹمنٹ کا مختصر کورس', '/admin/academy', 'Sparkles', false, true)
on conflict (key) do update set route = excluded.route, label = excluded.label, description = excluded.description, is_active = true;

insert into public.dashboard_features (dashboard_key, feature_key, sort_order)
select d.key, 'academy', 90 from dashboards d where d.key in ('admin', 'master')
on conflict (dashboard_key, feature_key) do update set sort_order = excluded.sort_order;

insert into feature_help (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes, faq, related) values
  ('academy', 'rm', 'Har department ka chhota course: video, qadam, demo try karein, poora hone ka nishan. Manager dekh sakta hai kis ne kya seekha.', 'Har staff; Owner/Admin/Manager team ka hisaab', 'Naye banday ka pehla hafta; naya feature aane par.',
   array['Apne department ka module kholein.', 'Video dekhein (agar lagi ho), qadam parhein, "Demo try karein" par asal safha.', '"Poora ho gaya" par nishan.', 'Sawal ho to Work Coach se poochein.'],
   'Sab module poore -> Training Mode khud band karein (Mera Kaam par).', array['Bina demo kiye poora likhna.'], '[]'::jsonb, array['my-work']::text[]),
  ('academy', 'en', 'A short course per department: video, steps, try the demo, mark complete. Managers see who learned what.', 'All staff; Owner/Admin/Manager for the team view', 'First week of a new hire; when a feature is added.',
   array['Open your department module.', 'Watch, read the steps, "Try demo" opens the real page.', 'Mark complete.', 'Ask the Work Coach when stuck.'],
   'All modules done -> turn off Training Mode on My Work.', array[]::text[], '[]'::jsonb, array['my-work']::text[])
on conflict (feature_key, lang) do update set purpose = excluded.purpose, how_steps = excluded.how_steps, updated_at = now();

-- E: staff-dost label
update features set label = 'Maal Bhejein (Transfer)', label_en = 'Send Stock (Transfer)' where key = 'stock-transfers';
update features set label = 'Tabdeeli Manzoori', label_en = 'Edit Approvals' where key = 'products.pending-edits';
update features set label = 'Catalogue Nikalein', label_en = 'Export Catalogue' where key = 'products.catalog-export';
update features set label = 'Maal Aana (Receiving)' where key = 'inventory.receiving';
