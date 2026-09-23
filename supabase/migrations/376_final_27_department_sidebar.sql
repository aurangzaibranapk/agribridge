-- =====================================================================
-- Migration 376: Final 27-department, duplication-free admin sidebar
-- =====================================================================
-- Har existing feature rehta hai. Sirf us ka canonical ghar tay hota
-- hai. Permissions role_feature_permissions / user_feature_permissions
-- mein hain; unhen yahan chhera nahi jata.

insert into public.dashboards
  (key, label, label_en, label_ur, icon, summary, sort_order, is_active)
values
  ('master',      'Master Command',          'Master Command',             'مرکزی کمانڈ',              'Scale',          'Malik ki mukammal nazar',                         10, true),
  ('branches',    'Branches',                'Branches',                   'شاخیں',                    'Building2',      'Branch structure aur performance',                20, true),
  ('shops',       'Shops',                   'Shops',                      'دکانیں',                   'Store',          'Shop structure, rent aur control',                 30, true),
  ('sales',       'Sales & POS',             'Sales & POS',                'فروخت اور پی او ایس',       'ShoppingCart',   'Sales, POS aur customer money',                    40, true),
  ('ordering',    'AgriBridge Ordering',     'AgriBridge Ordering',        'ایگری برج آرڈرنگ',          'ClipboardType',  'Branch-to-branch requests aur receiving',          50, true),
  ('procurement', 'Procurement',             'Procurement',                'اجناس خریداری',             'ClipboardList',  'Farmer procurement aur payments',                  60, true),
  ('grain',       'Grain Business',          'Grain Business',             'اناج کاروبار',              'Wheat',          'Grain stock, sale aur P&L',                        70, true),
  ('purchase',    'Purchases',               'Purchases',                  'خریداری',                   'PackagePlus',    'Supplier purchase aur GRN',                        80, true),
  ('milk',        'Milk & Dairy',            'Milk & Dairy',               'دودھ اور ڈیری',             'Droplet',        'Milk collection, quality aur billing',             90, true),
  ('machinery',   'Machinery',               'Machinery',                  'مشینری',                    'Wrench',         'Booking, work aur settlement',                    100, true),
  ('product',     'Product Management',      'Product Management',         'مصنوعات کا انتظام',          'Package',        'Product master, rates aur approvals',             110, true),
  ('inventory',   'Inventory & Warehouse',   'Inventory & Warehouse',      'اسٹاک اور گودام',            'Boxes',          'Stock, movement aur warehouse',                   120, true),
  ('fuel',        'Fuel Management',         'Fuel Management',            'ایندھن کا انتظام',           'Fuel',           'Petrol, diesel aur usage',                        130, true),
  ('generator',   'Generator Management',    'Generator Management',       'جنریٹر کا انتظام',           'Zap',            'Generator runtime, fuel aur maintenance',         140, true),
  ('fleet',       'Fleet Management',        'Fleet Management',           'گاڑیوں کا انتظام',           'Truck',          'Vehicles, routes aur maintenance',                150, true),
  ('farmers',     'Farmers',                 'Farmers',                    'کسان',                     'Sprout',         'Farmer 360, wallet, credit aur business',          160, true),
  ('dealers',     'Dealers',                 'Dealers',                    'ڈیلرز',                    'Users',          'Dealer profile, orders aur ledger',                170, true),
  ('buyers',      'Buyers',                  'Buyers',                     'خریدار',                   'ShoppingBag',    'Buyer profile, orders aur receivables',           180, true),
  ('suppliers',   'Suppliers',               'Suppliers',                  'سپلائرز',                  'Truck',          'Supplier ledger, payment aur performance',        190, true),
  ('crm',         'CRM',                     'CRM',                        'سی آر ایم',                 'Contact',        'Leads, customers aur follow-ups',                 200, true),
  ('finance',     'Finance & Accounting',    'Finance & Accounting',       'مالیات اور اکاؤنٹنگ',         'Landmark',       'Accounting, cash, bank aur finance',               210, true),
  ('hr',          'HR & Staff',              'HR & Staff',                 'عملہ',                     'UserCog',        'Staff, attendance aur employment',                220, true),
  ('audit',       'Audit & Control',         'Audit & Control',            'آڈٹ اور کنٹرول',             'ShieldCheck',    'Reconciliation, approval aur exceptions',         230, true),
  ('reports',     'Reports & Analytics',     'Reports & Analytics',        'رپورٹس اور تجزیہ',           'BarChart3',      'Central reports and analytics',                   240, true),
  ('website',     'Website',                 'Website',                    'ویب سائٹ',                  'Globe',          'Public website aur CMS',                          250, true),
  ('ai',          'Bridge AI',               'Bridge AI',                  'برج اے آئی',                'Sparkles',       'AI activity, actions aur controls',               260, true),
  ('admin',       'Administration & Security','Administration & Security',  'انتظامیہ اور حفاظت',          'ShieldCheck',    'Users, permissions, security aur settings',       270, true)
on conflict (key) do update set
  label = excluded.label,
  label_en = excluded.label_en,
  label_ur = excluded.label_ur,
  icon = excluded.icon,
  summary = excluded.summary,
  sort_order = excluded.sort_order,
  is_active = true;

-- Purane broad/franchise groups ab sidebar par nahi aayenge.
update public.dashboards
set is_active = false
where key not in (
  'master','branches','shops','sales','ordering','procurement','grain',
  'purchase','milk','machinery','product','inventory','fuel','generator',
  'fleet','farmers','dealers','buyers','suppliers','crm','finance','hr',
  'audit','reports','website','ai','admin'
);

-- Departments ki existing role hierarchy ko naye canonical dashboard
-- keys par rakho. Permission rows aur heads bilkul waise hi rehte hain.
update public.departments
set dashboard_key = case dashboard_key
  when 'franchise' then 'shops'
  when 'sales' then 'sales'
  when 'purchase' then 'purchase'
  when 'milk' then 'milk'
  when 'grain' then 'grain'
  when 'machinery' then 'machinery'
  when 'inventory' then 'inventory'
  when 'fleet' then 'fleet'
  when 'finance' then 'finance'
  when 'hr' then 'hr'
  when 'website' then 'website'
  when 'ai' then 'ai'
  when 'reports' then 'reports'
  when 'admin' then 'admin'
  else dashboard_key
end;

-- Feature assignment dobara banti hai, feature ya permission delete
-- nahi hoti. Is ke baad har active route ka sirf ek canonical ghar hai.
delete from public.dashboard_features;

with mapped as (
  select
    f.key as feature_key,
    f.route,
    case
      when f.route in ('/admin/command-center','/admin/master-dashboard','/admin/investors') then 'master'
      when f.route like '/admin/branches%' then 'branches'
      when f.route in ('/admin/shops','/admin/shop-rent','/admin/branch-credit') or f.route like '/admin/shop-360%' then 'shops'
      when f.route like '/admin/agri-orders%' or f.route like '/admin/pos/ordering%' then 'ordering'
      when f.route = '/admin/grain-procurement' or f.route like '/admin/grain-procurement/payments%' or f.route like '/admin/grain-procurement/statement%' then 'procurement'
      when f.route like '/admin/grain%' then 'grain'
      when f.route like '/admin/purchases%' or f.route = '/admin/ai-suggestions' then 'purchase'
      when f.route in ('/admin/milk-collection/fuel','/admin/machinery-rental/diesel') then 'fuel'
      when f.route = '/admin/milk-collection/generator' then 'generator'
      when f.route = '/admin/milk-collection/maintenance' or f.route like '/admin/drivers%' or f.route like '/admin/vehicles%' or f.route like '/admin/my-vehicle%' then 'fleet'
      when f.route like '/admin/milk-collection%' then 'milk'
      when f.route like '/admin/machinery-rental%' then 'machinery'
      when f.route like '/admin/products%' or f.route in ('/admin/categories','/admin/brands','/admin/companies','/admin/rate-master') then 'product'
      when f.route like '/admin/inventory%' or f.route like '/admin/stock-%' or f.route like '/admin/agri-returns%' then 'inventory'
      when f.route like '/admin/farmers%' or f.route like '/admin/farmer-%' or f.route like '/admin/wallets%' or f.route like '/admin/payouts%' then 'farmers'
      when f.route like '/admin/dealers%' or f.route like '/admin/dealer-orders%' then 'dealers'
      when f.route like '/admin/buyers%' then 'buyers'
      when f.route like '/admin/suppliers%' then 'suppliers'
      when f.route like '/admin/crm%' or f.route = '/admin/messages' then 'crm'
      when f.route like '/admin/reports%' then 'reports'
      when f.route in ('/admin/reconciliation','/admin/leakage','/admin/audit-trail','/admin/anomalies','/admin/field-watch','/admin/activity-logs','/admin/errors','/admin/stock-count','/admin/submissions') then 'audit'
      when f.route like '/admin/hr%' or f.route like '/admin/my-hr%' or f.route like '/admin/my-attendance%' or f.route like '/admin/my-department%' or f.route like '/admin/job-%' or f.route in ('/admin/staff-khata','/admin/my-wallet') then 'hr'
      when f.route like '/admin/bridge-ai%' or f.route in ('/admin/ai-instructions','/admin/ai-usage') then 'ai'
      when f.route in ('/admin/dashboard','/admin/hero-slides','/admin/blog','/admin/testimonials','/admin/gallery','/admin/media-library','/admin/faqs','/admin/static-pages','/admin/menus','/admin/contact-messages','/admin/investor-inquiries','/admin/email-templates','/admin/settings') then 'website'
      when f.route like '/admin/pos%' or f.route in ('/admin/bridge-orders','/admin/produce-orders','/admin/khata','/admin/settlements') then 'sales'
      when f.route like '/admin/finance%' or f.route like '/admin/cash-%' or f.route like '/admin/bank-%' or f.route in ('/admin/money-trail','/admin/shaam-ka-hisaab','/admin/quantity-money','/admin/kharche','/admin/load-bill','/admin/company-expenses','/admin/credit-requests') then 'finance'
      else 'admin'
    end as dashboard_key,
    case
      when f.route like '%/dashboard' or f.route in ('/admin/command-center','/admin/master-dashboard','/admin/finance','/admin/reports') then 'Overview'
      when f.route like '%/reports%' or f.route like '/admin/reports%' then 'Reports'
      when f.route like '%/payment%' or f.route like '%/billing%' or f.route like '%/ledger%' or f.route like '%/statement%' then 'Finance & Ledger'
      when f.route like '%/settings%' or f.route like '%/setup%' or f.route like '%/masters%' then 'Setup'
      else 'Operations'
    end as section
  from public.features f
  where f.is_active
), ordered as (
  select
    dashboard_key,
    feature_key,
    section,
    row_number() over (partition by dashboard_key order by route, feature_key) * 10 as sort_order
  from mapped
)
insert into public.dashboard_features
  (dashboard_key, feature_key, sort_order, section, section_order)
select
  dashboard_key,
  feature_key,
  sort_order,
  section,
  case section
    when 'Overview' then 1
    when 'Operations' then 2
    when 'Finance & Ledger' then 3
    when 'Setup' then 4
    when 'Reports' then 5
    else 9
  end
from ordered;

-- Guard: migration ke baad koi active feature menu se orphan na ho.
do $$
begin
  if exists (
    select 1
    from public.features f
    where f.is_active
      and not exists (
        select 1 from public.dashboard_features df where df.feature_key = f.key
      )
  ) then
    raise exception 'Final sidebar mapping left an active feature without a dashboard';
  end if;
end $$;

