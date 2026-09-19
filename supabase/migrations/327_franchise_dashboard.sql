-- =====================================================================
-- AgriBridge — Migration 327: Franchise ka apna dashboard,
--                              aur HR / Finance ki safai
-- =====================================================================
-- Malik ka kehna (5 September): *"kaam aasan banane ke liye HR mein
-- sirf HR se related hon, Finance se related Finance, aur franchise ya
-- branches ka ek alag dashboard banao -- us mein shop aayengi, shop
-- agreement, bill waghera jo shops ke related ho ga."*
--
-- Baat theek hai, aur adad us ki tasdeeq karte hain:
--
--   Finance par 54 safhe the. Un mein se 13 ka Finance se koi taluq
--   nahi tha -- paanch machinery ke, do doodh ke, shop ka kiraya, stock
--   ki ginti, rate master, agri orders, investors, submissions.
--
-- Aisa dashboard sirf bhara hua nahi hota -- wo NAKAARA ho jata hai.
-- Jis fehrist mein 54 naam hon, us mein banda dhoondhta nahi, wo apni
-- yaad se chalta hai; aur jo cheez us ki yaad mein nahi, wo us ke liye
-- maujood hi nahi rehti. Yehi wajah thi ke kai safhe bane hue the aur
-- koi un tak pahunchta hi nahi tha.
--
-- =====================================================================
-- DO USOOL JIN PAR YE SAFAI HUI
-- =====================================================================
--
-- 1. **Hatane se pehle dekha gaya ke wo cheez APNE ghar par maujood
--    hai.**
--
--    Kisi safhe ko dashboard se hatana us ka raasta band kar dena hai.
--    Is liye har us feature ki jaanch ki gayi jise Finance se hataya:
--    machinery wale paanchon machinery par pehle se the, doodh wale
--    doodh par, stock-count inventory par, waghera. Ek bhi aisa nahi
--    hataya gaya jo hatane ke baad kahin nazar na aata.
--
--    (Ye jaanch is liye zaroori thi ke ijazat aur menu do alag cheezein
--    hain: ijazat rehti hai, magar jo menu mein na ho us tak koi
--    pahunchta nahi.)
--
-- 2. **Ek cheez do jagah ho sakti hai -- aur kabhi kabhi honi chahiye.**
--
--    `branch-credit` (shop ka udhaar) Finance par bhi rahega aur
--    Franchise par bhi. Wo waqai dono ka sawal hai: Finance ke liye ye
--    "lena baqi" hai, aur Franchise ke liye "is shop ka haal kya hai".
--    Isi tarah `stock-transfers` Inventory par bhi rahega aur Franchise
--    par bhi.
--
--    Safai ka matlab har cheez ko ek hi jagah rakhna nahi -- matlab ye
--    hai ke jo cheez jahan ka sawal nahi, wahan se hat jaye.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) Naya dashboard: Franchise aur Shops
-- ---------------------------------------------------------------------
insert into public.dashboards (key, label, label_en, label_ur, icon, summary, description, description_en, description_ur, sort_order, is_active)
values (
  'franchise',
  'Franchise aur Shops',
  'Franchise & Shops',
  'فرنچائز اور دکانیں',
  'Store',
  'Shaakhein, dukanein, kiraya, agreement aur shop ka udhaar',
  'Har shaakh aur dukan ka apna haal — kiraya, agreement, bill, udhaar aur maal ki aamad.',
  'Every branch and shop in one place — rent, agreements, bills, credit and stock transfers.',
  'ہر شاخ اور دکان کا اپنا حال — کرایہ، ایگریمنٹ، بل، ادھار اور مال کی آمد۔',
  35,
  true
)
on conflict (key) do update set
  label = excluded.label, label_en = excluded.label_en, label_ur = excluded.label_ur,
  icon = excluded.icon, summary = excluded.summary,
  description = excluded.description, description_en = excluded.description_en,
  description_ur = excluded.description_ur,
  sort_order = excluded.sort_order, is_active = true;


-- ---------------------------------------------------------------------
-- 2) Franchise par kya kya aayega
-- ---------------------------------------------------------------------
insert into public.dashboard_features (dashboard_key, feature_key, sort_order, section)
values
  ('franchise', 'shops',              10, null),  -- Dukanein
  ('franchise', 'branches',           20, null),  -- Shaakhein
  ('franchise', 'branches.locations', 30, null),  -- Shaakh ki jagah
  ('franchise', 'shop-rent',          40, null),  -- Kiraya, agreement, bill
  ('franchise', 'branch-credit',      50, null),  -- Shop ka udhaar aur advance
  ('franchise', 'stock-transfers',    60, null)   -- Shop ko maal bhejna
on conflict (dashboard_key, feature_key) do update set
  sort_order = excluded.sort_order;


-- ---------------------------------------------------------------------
-- 3) Finance se wo hatana jo Finance ka sawal hi nahi
-- ---------------------------------------------------------------------
-- Har ek apne ghar par pehle se maujood hai (upar usool 1 dekhein), is
-- liye yahan se hatane par koi safha ghayab nahi hota.
delete from public.dashboard_features
where dashboard_key = 'finance'
  and feature_key in (
    -- Machinery ka hisaab machinery par
    'machinery-rental.advance-claims',
    'machinery-rental.vendor-cash',
    'machinery-rental.reminders',
    'machinery-rental.vendor-settlement',
    'machinery-rental.pnl',
    -- Doodh ka hisaab doodh par
    'milk-collection.billing',
    'milk-collection.cost-per-liter',
    -- Dukan ka kiraya ab Franchise par
    'shop-rent',
    -- Ye teen kabhi Finance ke the hi nahi
    'stock-count',
    'agri-orders',
    'submissions',
    -- Rate master maal ka sawal hai, paise ka nahi
    'rate-master',
    -- Investors Master Command par
    'investors'
  );


-- ---------------------------------------------------------------------
-- 4) HR se wo hatana jo HR ka sawal nahi
-- ---------------------------------------------------------------------
-- field-watch (khet ki nigrani) admin aur master par pehle se hai. Wo
-- staff ka sawal nahi -- fasal ka hai.
--
-- my-wallet aur staff-khata JAAN BOOJH KAR rakhe gaye hain: paisa
-- zaroor hain, magar dono STAFF ke bare mein hain, aur staff HR ka
-- daira hai. Inhen hata dena us bande se un tak ka raasta chheen leta
-- jis ke liye ye bane hain.
delete from public.dashboard_features
where dashboard_key = 'hr' and feature_key = 'field-watch';


-- ---------------------------------------------------------------------
-- 5) Rate master apne asal ghar par
-- ---------------------------------------------------------------------
-- Finance se hataya to hai, magar wo Inventory par nahi tha -- sirf
-- Master par. Master poore idare ki nazar hai, rozana ka kaam nahi.
-- Maal ka rate dekhne wala banda Inventory par jata hai.
insert into public.dashboard_features (dashboard_key, feature_key, sort_order, section)
values ('inventory', 'rate-master', 40, null)
on conflict (dashboard_key, feature_key) do update set sort_order = excluded.sort_order;


-- ---------------------------------------------------------------------
-- 6) Wo safhe jo BANE HUE THE magar kisi menu par nahi the
-- ---------------------------------------------------------------------
-- Safai karte waqt ye jaancha gaya ke koi feature aisa to nahi jo kisi
-- bhi dashboard par na ho. Nikla: **sattarah**. Un mein se chaudah
-- rozana ke kaam ke safhe the --
--
--   /admin/products/setup-queue   (naye product ki qatar)
--   /admin/products/labels        (barcode ke labels)
--   /admin/products/bill-rates    (bill se rate charhana)
--   /admin/products/images        (tasveerein)
--   /admin/brands, /admin/categories, /admin/companies
--   ... aur baqi
--
-- Ye sab ban chuke the, ijazat bhi thi, magar MENU MEIN KAHIN NAHI THE.
-- Yani un tak pahunchne ka ek hi raasta tha: kisi ko raasta yaad ho aur
-- wo pata bar mein likh de. Bane hue safhe ka menu mein na hona us
-- safhe ka na hona hi hai -- farq sirf itna hai ke mehnat zaya ho chuki
-- hoti hai.
--
-- (Baqi teen: my-access, my-work aur my-attendance har bande ko waise hi
-- khulte hain -- wo code ki ALWAYS fehrist mein hain, dashboard par nahi
-- hote. Aur finance.reversal ek safha nahi, audit-trail ka ek hissa hai.)
--
-- Inhen Inventory par SECTION ke saath rakha gaya hai, seedhi fehrist
-- mein nahi. Chaudah naam ek qatar mein daal dene se Inventory bhi wohi
-- bhari hui fehrist ban jata jis se Finance ko abhi bachaya hai.
insert into public.dashboard_features (dashboard_key, feature_key, sort_order, section, section_order)
values
  -- Maal ka record: cheez khud, us ka brand, qism aur company
  ('inventory', 'categories',              10, 'Maal ka record', 1),
  ('inventory', 'brands',                  11, 'Maal ka record', 1),
  ('inventory', 'companies',               12, 'Maal ka record', 1),
  ('inventory', 'products.import',         13, 'Maal ka record', 1),
  ('inventory', 'products.propose',        14, 'Maal ka record', 1),
  ('inventory', 'products.pending',        15, 'Maal ka record', 1),
  ('inventory', 'products.pending-edits',  16, 'Maal ka record', 1),
  ('inventory', 'products.setup_queue',    17, 'Maal ka record', 1),
  -- Rate, barcode aur tasveer
  ('inventory', 'products.bill_rates',     20, 'Rate, barcode aur tasveer', 2),
  ('inventory', 'products.rates_baqi',     21, 'Rate, barcode aur tasveer', 2),
  ('inventory', 'products.labels',         22, 'Rate, barcode aur tasveer', 2),
  ('inventory', 'products.images',         23, 'Rate, barcode aur tasveer', 2),
  ('inventory', 'products.intake',         24, 'Rate, barcode aur tasveer', 2),
  ('inventory', 'products.catalog-export', 25, 'Rate, barcode aur tasveer', 2)
on conflict (dashboard_key, feature_key) do update set
  sort_order = excluded.sort_order,
  section = excluded.section,
  section_order = excluded.section_order;
