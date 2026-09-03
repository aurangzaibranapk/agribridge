-- =====================================================================
-- AgriBridge — Migration 277: Feature ke naam teenon zabanon mein
-- =====================================================================
-- Malik ka aitraaz (3 September, My Work ke screenshot par): "Who Did
-- What", "Fleet & Maintenance", "Farmers" aur "Raat ki Cash Ginti" ek hi
-- safhe par sath sath -- ye jaan boojh kar zaban badalna nahi lagta,
-- be-tarteebi lagti hai.
--
-- Asal wajah: menu ka naam `features.label` (Roman) se aata hai, aur
-- English chunne par `label_en` se -- magar 104 features ka `label_en`
-- khali tha. Khali khana Roman par gir jata hai (ye jaan boojh kar hai:
-- adhoora tarjuma menu ko khali nahi karta). Nateeja: English mode mein
-- aadha safha Roman.
--
-- Yahan do kaam:
--   1. Har feature ka English naam bhara.
--   2. Jin ka `label` (Roman ka khana) dar-asal English tha, un ka Roman
--      naam theek kiya -- Roman mode mein bhi ab Roman hi aayega.
--
-- Sirf naam. Chaabi, raasta, ijazat -- kisi ko haath nahi lagaya.
-- =====================================================================

update features f
   set label    = x.rm,
       label_en = x.en
  from (values
  ('activity-logs',            'Kaam ka Record',              'Activity Logs'),
  ('agri-orders',              'AgriBridge Ordering',         'AgriBridge Ordering'),
  ('bank-reconcile',           'Bank se Milaan',              'Bank Reconciliation'),
  ('blog',                     'Blog',                        'Blog'),
  ('branch-credit',            'Shop ka Udhaar aur Advance',  'Store Credit & Advance'),
  ('branches',                 'Shaakhein',                   'Branches'),
  ('branches.locations',       'Shaakh ki Jagah',             'Branch Locations'),
  ('brands',                   'Brand',                       'Brands'),
  ('bridge-orders',            'Order',                       'Orders'),
  ('buyers',                   'Kharidar',                    'Buyers'),
  ('cash-close',               'Raat ki Cash Ginti',          'Cash Closing'),
  ('cash-handover',            'Cash Haath Badalna',          'Cash Handover'),
  ('categories',               'Qismein',                     'Categories'),
  ('command-center',           'Malik ka Command Center',     'Owner Command Center'),
  ('companies',                'Companiyan',                  'Companies'),
  ('company-expenses',         'Company ka Kharcha',          'Company Expenses'),
  ('contact-messages',         'Website ke Paighaam',         'Contact Messages'),
  ('credit-requests',          'Udhaar ki Darkhwastein',      'Credit Requests'),
  ('crm',                      'Gahak ka Khata',              'CRM'),
  ('dashboard',                'Website Dashboard',           'Website Dashboard'),
  ('dashboard-manager',        'Dashboard aur Feature Manager','Dashboard & Feature Manager'),
  ('dealer-orders',            'Dealer ke Order',             'Dealer Orders'),
  ('dealers',                  'Dealer',                      'Dealers'),
  ('departments',              'Department aur Ijazat',       'Departments & Access'),
  ('drivers',                  'Driver aur Gaariyan',         'Drivers & Vehicles'),
  ('faqs',                     'Aam Sawalat',                 'FAQ'),
  ('farmer-credit',            'Kisan ka Udhaar',             'Farmer Credit'),
  ('farmer-loans',             'Kisan ke Qarze',              'Farmer Loans'),
  ('farmers',                  'Kisan',                       'Farmers'),
  ('fertilizer',               'Khaad',                       'Fertilizer'),
  ('finance',                  'Cash Book',                   'Cash Book'),
  ('finance.banks',            'Bank',                        'Banks'),
  ('finance.payment-mapping',  'Adaigi ka Tareeqa',           'Payment Method Mapping'),
  ('finance.queue',            'Finance ki Qatar',            'Finance Queue'),
  ('gallery',                  'Tasveerein',                  'Gallery'),
  ('grocery',                  'Grocery',                     'Grocery'),
  ('hero-slides',              'Hero Slider',                 'Hero Slider'),
  ('hr',                       'Staff (HR)',                  'HR - Staff'),
  ('hr-dashboard',             'HR Dashboard',                'HR Dashboard'),
  ('hr.attendance-log',        'Hazri Record',                'Attendance Log'),
  ('hr.whatsapp',              'Staff WhatsApp',              'Staff WhatsApp'),
  ('investor-inquiries',       'Sarmayakar ke Sawal',         'Investor Inquiries'),
  ('investors',                'Sarmayakar',                  'Investors'),
  ('job-applications',         'Naukri ki Darkhwastein',      'Job Applications'),
  ('job-vacancies',            'Naukri ki Jagahein',          'Job Vacancies'),
  ('khata',                    'Khata',                       'Customer Ledger'),
  ('master-dashboard',         'Master Dashboard',            'Master Dashboard'),
  ('media-library',            'Media',                       'Media'),
  ('menus',                    'Menu',                        'Menus'),
  ('messages',                 'Paighaam',                    'Messages'),
  ('milk-collection',          'Doodh Collection',            'Milk Collection'),
  ('milk-collection.billing',  'Company Billing aur Nafa',    'Company Billing & P&L'),
  ('milk-collection.chiller',  'Chiller — FAT',               'Chiller — FAT'),
  ('milk-collection.collect',  'Doodh Jama Karein',           'Collect Milk'),
  ('milk-collection.cost-per-liter','Fi Litre Kharcha',       'Cost per Litre'),
  ('milk-collection.fuel',     'Tel ka Hisaab',               'Fuel Tracker'),
  ('milk-collection.generator','Generator ka Hisaab',         'Generator Tracker'),
  ('milk-collection.maintenance','Gaari aur Marammat',        'Fleet & Maintenance'),
  ('milk-collection.routes',   'Route aur Kami',              'Route & Shortage'),
  ('milk-collection.verify',   'Doodh ki Tasdeeq',            'Milk Manager Verify'),
  ('milk-collection.walk-in',  'Khud Laaya Hua Doodh',        'Walk-in / Self Delivery'),
  ('my-attendance',            'Meri Hazri',                  'My Attendance'),
  ('my-department',            'Meri Team (Head)',            'My Team (Head)'),
  ('my-wallet',                'Mera Batwa',                  'My Wallet'),
  ('notifications',            'Ittila''at',                  'Notifications'),
  ('payouts',                  'Adaigiyan',                   'Payouts'),
  ('permissions',              'Ek Banday ki Ijazat',         'Person Permissions'),
  ('pesticide',                'Spray (Zehar)',               'Pesticide'),
  ('platform',                 'Platform / Clients',          'Platform / Clients'),
  ('pos',                      'POS',                         'POS'),
  ('produce-orders',           'Fasal ke Order',              'Produce Orders'),
  ('product-permissions',      'Product ki Ijazat',           'Product Permissions'),
  ('products',                 'Cheezein',                    'Products'),
  ('products.pending',         'Ruke Hue Products',           'Pending Products'),
  ('products.propose',         'Nayi Cheez ki Tajweez',       'Propose Product'),
  ('purchases',                'Kharid',                      'Purchases'),
  ('rate-master',              'Rate Master',                 'Rate Master'),
  ('reconciliation',           'Roz ka Milaan',               'Daily Reconciliation'),
  ('reports',                  'Reports',                     'Reports Overview'),
  ('reports.audit',            'Audit Center (Nuqsan)',       'Audit Center (Loss Tracking)'),
  ('reports.credit',           'Udhaar Report',               'Credit Report'),
  ('reports.finance',          'Finance Report',              'Finance Report'),
  ('reports.inventory',        'Stock Reports',               'Inventory Reports'),
  ('reports.milk',             'Doodh Report',                'Milk Report'),
  ('reports.pnl',              'Nafa Nuqsan (Shop-wise)',     'Profit & Loss (Shop-wise)'),
  ('reports.procurement',      'Anaj Kharid Report',          'Procurement Report'),
  ('reports.purchases',        'Kharid Report',               'Purchases Report'),
  ('reports.sales',            'Sale Report',                 'Sales Report'),
  ('reset-test-data',          'Test Data Reset',             'Reset Test Data'),
  ('seeds',                    'Beej',                        'Seeds'),
  ('settings',                 'Website Settings',            'Website Settings'),
  ('shop-rent',                'Dukan ka Kiraya aur Bill',    'Shop Rent & Bills'),
  ('shops',                    'Dukanein',                    'Shops'),
  ('staff-khata',              'Staff Khata',                 'Staff Ledger'),
  ('static-pages',             'Safhe',                       'Pages'),
  ('stock-count',              'Maal ki Ginti',               'Stock Count'),
  ('stock-ledger',             'Stock ka Khata',              'Stock Ledger'),
  ('submissions',              'Manzoori Inbox',              'Approval Inbox'),
  ('suppliers',                'Supplier',                    'Suppliers'),
  ('suppliers.all-statement',  'Sab Suppliers Statement',     'All Suppliers Statement'),
  ('testimonials',             'Gahakon ki Raye',             'Testimonials'),
  ('trust_intelligence',       'Bharosa aur Karkardagi',      'Trust & Performance'),
  ('users',                    'Users aur Role',              'Users & Roles'),
  ('vehicles',                 'Gaariyan (Rozana)',           'Vehicles (Daily)'),
  ('wallets',                  'Batwe',                       'Wallets'),
  ('wanda',                    'Wanda',                       'Wanda'),
  -- Jin ka `label` English tha magar `label_en` pehle se bhara tha --
  -- un ka sirf Roman naam theek karna hai.
  ('agri-returns',             'Wapsi ka Maal',               'Stock Returns'),
  ('inventory',                'Stock',                       'Stock'),
  ('ai-instructions',          'AI ki Hidayaat',              'AI Instructions'),
  ('ai-suggestions',           'AI ki Kharid Tajweez',        'AI Purchase Suggestions'),
  ('email-templates',          'Email ke Namune',             'Email Templates'),
  ('grain-procurement',        'Anaj ki Kharid',              'Grain Procurement'),
  ('grain-procurement.dashboard','Anaj ka Dashboard',         'Grain Business Dashboard'),
  ('machinery-rental',         'Machine ki Booking',          'Machinery Booking'),
  ('machinery-rental.calendar','Machine ka Calendar',         'Capacity Calendar'),
  ('machinery-rental.farm-map','Zameen ka Naqsha',            'Farm Map'),
  ('machinery-rental.pnl',     'Machinery Nafa Nuqsan',       'Machinery P&L'),
  ('machinery-rental.vendor-settlement','Vendor ka Hisaab',   'Vendor Settlement'),
  ('product-masters',          'Product ki Bunyadi Fehrist',  'Product Masters'),
  ('products.setup',           'Product Setup',               'Product Setup')
) as x(key, rm, en)
 where f.key = x.key;

-- Dashboard ke naam bhi Roman mein (English pehle se theek hai).
update dashboards set label = 'Master Command'      where key = 'master';
update dashboards set label = 'Doodh'               where key = 'milk';
update dashboards set label = 'Anaj'                where key = 'grain';
update dashboards set label = 'Machinery'           where key = 'machinery';
update dashboards set label = 'Bikri aur Dukan'     where key = 'sales';
update dashboards set label = 'Stock aur Godam'     where key = 'inventory';
update dashboards set label = 'Kharid'              where key = 'purchase';
update dashboards set label = 'Finance'             where key = 'finance';
update dashboards set label = 'Gaariyan aur Delivery' where key = 'fleet';
update dashboards set label = 'Staff (HR)'          where key = 'hr';
update dashboards set label = 'Website'             where key = 'website';
update dashboards set label = 'AI Command'          where key = 'ai';
update dashboards set label = 'Intezamia aur Hifazat' where key = 'admin';
update dashboards set label = 'Reports aur Audit'   where key = 'reports';
