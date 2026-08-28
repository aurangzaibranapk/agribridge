-- =====================================================================
-- Migration 103: Department (role) ki ijazat ek hi jagah
-- =====================================================================
-- Ab tak ijazat sirf shakhs ke naam par thi: har naye staff ke liye
-- 150 safhe haath se tick karne parte the. Nateeja wahi nikalta jo aisi
-- soorat mein hamesha nikalta hai -- kaam ki jaldi mein logon ko poori
-- ijazat de di jati hai, aur rok kaghaz par reh jati hai.
--
-- Ab ijazat department par lagti hai. Ek dafa tay karein, us department
-- ke har shakhs par lag jata hai. Kisi ek shakhs ko alag ijazat deni ho
-- to us ka apna set us se bhaari rehta hai.
--
-- Machinery ka apna role bhi banaya -- pehle machinery rental ke liye
-- koi role tha hi nahi, is liye us kaam wala shakhs majboori mein
-- sales ya admin ban jata tha, aur us ke sath poori sales ki ijazat bhi
-- le jata tha.

alter type user_role add value if not exists 'machinery';

create table if not exists role_page_permissions (
  role text primary key,
  allowed_pages text[] not null default '{}',
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

comment on table role_page_permissions is
  'Har department (role) ke liye ek hi jagah tay ki hui ijazat. Shakhs ka apna set khali ho to yahi chalta hai.';

alter table role_page_permissions enable row level security;

-- Har staff ko apni ijazat parhne ki zarurat hoti hai (sidebar isi se
-- banta hai), magar badal sirf admin darje ka shakhs sakta hai.
drop policy if exists staff_read_role_permissions on role_page_permissions;
create policy staff_read_role_permissions on role_page_permissions
  for select using (public.fn_is_any_staff());

drop policy if exists admin_manage_role_permissions on role_page_permissions;
create policy admin_manage_role_permissions on role_page_permissions
  for all using (public.fn_is_admin_level()) with check (public.fn_is_admin_level());

-- Har department ki shuruati ijazat. "do nothing" is liye ke agar admin
-- ne pehle se badal li ho to ye migration us par nahi chadhti.
insert into role_page_permissions (role, allowed_pages) values
('sales_staff', array['/admin/my-attendance','/admin/notifications','/admin/messages','/admin/my-wallet','/admin/pos','/admin/agri-orders','/admin/bridge-orders','/admin/dealer-orders','/admin/produce-orders','/admin/agri-returns','/admin/khata','/admin/buyers','/admin/dealers','/admin/farmers','/admin/products','/admin/inventory','/admin/reports/sales','/admin/reports']::text[]),
('finance', array['/admin/my-attendance','/admin/notifications','/admin/messages','/admin/my-wallet','/admin/finance','/admin/finance/queue','/admin/finance/banks','/admin/finance/payment-mapping','/admin/company-expenses','/admin/submissions','/admin/khata','/admin/staff-khata','/admin/branch-credit','/admin/credit-requests','/admin/farmer-credit','/admin/farmer-loans','/admin/wallets','/admin/payouts','/admin/agri-orders','/admin/master-dashboard','/admin/reports/pnl','/admin/reports/finance','/admin/reports/credit','/admin/reports']::text[]),
('warehouse', array['/admin/my-attendance','/admin/notifications','/admin/messages','/admin/my-wallet','/admin/inventory','/admin/stock-transfers','/admin/stock-ledger','/admin/agri-orders','/admin/agri-returns','/admin/products','/admin/products/propose','/admin/categories','/admin/brands','/admin/companies','/admin/reports/inventory','/admin/reports']::text[]),
('procurement', array['/admin/my-attendance','/admin/notifications','/admin/messages','/admin/my-wallet','/admin/purchases','/admin/suppliers','/admin/suppliers/all-statement','/admin/grain-procurement','/admin/grain-procurement/dashboard','/admin/grain-procurement/sell','/admin/ai-suggestions','/admin/agri-orders','/admin/inventory','/admin/reports/purchases','/admin/reports/procurement','/admin/reports']::text[]),
('milk_collection', array['/admin/my-attendance','/admin/notifications','/admin/messages','/admin/my-wallet','/admin/milk-collection/collect','/admin/milk-collection/walk-in','/admin/milk-collection/chiller','/admin/milk-collection','/admin/milk-collection/routes','/admin/milk-collection/fuel','/admin/milk-collection/generator','/admin/milk-collection/maintenance','/admin/farmers','/admin/reports/milk','/admin/reports']::text[]),
('machinery', array['/admin/my-attendance','/admin/notifications','/admin/messages','/admin/my-wallet','/admin/machinery-rental','/admin/machinery-rental/dashboard','/admin/machinery-rental/list','/admin/drivers','/admin/vehicles','/admin/farmers','/admin/reports']::text[]),
('hr', array['/admin/my-attendance','/admin/notifications','/admin/messages','/admin/my-wallet','/admin/hr','/admin/hr-dashboard','/admin/hr/whatsapp','/admin/hr/attendance-log','/admin/staff-khata','/admin/job-vacancies','/admin/job-applications','/admin/users','/admin/reports']::text[]),
('admin_assistant', array['/admin/my-attendance','/admin/notifications','/admin/messages','/admin/my-wallet','/admin/dashboard','/admin/contact-messages','/admin/investor-inquiries','/admin/blog','/admin/gallery','/admin/media-library','/admin/faqs','/admin/testimonials','/admin/hero-slides','/admin/static-pages','/admin/email-templates','/admin/reports']::text[]),
('manager', array['/admin/my-attendance','/admin/notifications','/admin/messages','/admin/my-wallet','/admin/field-watch','/admin/submissions','/admin/agri-orders','/admin/agri-returns','/admin/vehicles','/admin/milk-collection/verify','/admin/milk-collection/chiller','/admin/pos','/admin/inventory','/admin/stock-transfers','/admin/khata','/admin/branch-credit','/admin/company-expenses','/admin/hr/attendance-log','/admin/farmers','/admin/buyers','/admin/dealers','/admin/reports','/admin/reports/sales','/admin/reports/inventory']::text[])
on conflict (role) do nothing;
