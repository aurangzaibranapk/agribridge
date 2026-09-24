-- =====================================================================
-- AgriBridge — Migration 344: Sales Staff ka template, malik ki fehrist par
-- =====================================================================
-- Malik (6 September) ne poori fehrist khud likh di:
--
--   *"Sales staff ke paas POS aana chahiye, ordering ke liye AgriBridge
--   aana chahiye, koi banda grain kuch sale ke liye aata hai to produce
--   request form aana chahiye, machinery booking aani chahiye, farmer
--   membership aani chahiye, my HR aana chahiye, stock return aana
--   chahiye lekin wo AgriBridge ke andar hi ho, reports view jo already
--   bataya hai wo aana chahiye. Administration mein message notification
--   already top par aa raha hai; meri hazri us ko My HR ke andar de diya
--   hai, us ki alag se zarurat nahi. My wallet us ki sidebar mein aana
--   chahiye. Finance ki zarurat nahi ke wo aaye."*
--
-- =====================================================================
-- YE MIGRATION KISI KI IJAZAT NAHI BADALTI
-- =====================================================================
--
-- 343 ke baad `role_feature_permissions` ek **TEMPLATE** hai -- ek
-- tayyar fehrist jo naye bande par ek dabao se lagti hai. Wo khud kisi
-- ko kuch nahi deti.
--
-- Is liye ye migration Live par chal kar bhi kisi chalte hue bande ka
-- ek safha band nahi karti. Wo sirf ye tay karti hai ke **agli dafa**
-- jab "Sales Staff" ka template lagaya jaye to us mein kya ho.
--
-- Anwar (ya kisi bhi maujooda bande) ki apni fehrist alag se badalni
-- hogi -- aur wo malik ke saamne, un ki manzoori se.
--
-- =====================================================================
-- PEHLE 20 THE, AB NAU
-- =====================================================================
--
-- Purani fehrist mein dealers, buyers, dealer-orders, bridge-orders,
-- inventory, khata, messages, notifications, products, products.images,
-- reports, my-department, my-attendance jaise khane bhi the -- aur
-- aksar par `create` aur `edit` DONO khule the. Yehi wajah thi ke har
-- safhe par "Add", "Edit", "Import" ke button nazar aa rahe the.
--
-- Nayi fehrist mein har feature par sirf wohi kaam hai jo malik ne kaha:
-- **banana haan, badalna nahi.** Tasdeeq, manzoori aur mitana kisi par
-- nahi -- wo faisle ooper ke hain.
-- =====================================================================

do $$
declare
  v_pehle int;
  v_baad  int;
begin
  select count(*) into v_pehle from role_feature_permissions where role = 'sales_staff';

  delete from role_feature_permissions where role = 'sales_staff';

  insert into role_feature_permissions (role, feature_key, actions, data_scope) values
    -- Dukan ka rozana kaam
    ('sales_staff', 'pos',             array['view','create'], 'own_shop'),
    -- Ordering -- order kar sake, badal na sake
    ('sales_staff', 'agri-orders',     array['view','create'], 'own_shop'),
    -- Wapsi ka maal. Malik: "stock return aana chahiye lekin wo
    -- AgriBridge ke andar hi ho" -- is liye ye usi hisse (dashboard)
    -- mein rakha gaya hai, alag naam se nahi.
    ('sales_staff', 'agri-returns',    array['view','create'], 'own_shop'),
    -- Koi banda anaj bechne aaye to us ki request
    ('sales_staff', 'produce-orders',  array['view','create'], 'own_shop'),
    -- Machine ki booking
    ('sales_staff', 'machinery-rental',array['view','create'], 'own_shop'),
    -- Membership: member banaye. Tasdeeq (verify) JAAN BOOJH KAR nahi --
    -- us ka matlab hai kisi ne kaghaz apni aankh se dekhe.
    ('sales_staff', 'farmers',         array['view','create'], 'own_shop'),
    -- Apna record
    ('sales_staff', 'my-hr',           array['view'],          'own_records'),
    ('sales_staff', 'my-wallet',       array['view'],          'own_records'),
    -- Apni dukan ki report
    ('sales_staff', 'reports.sales',   array['view'],          'own_shop');

  select count(*) into v_baad from role_feature_permissions where role = 'sales_staff';
  raise notice 'Sales Staff ka template: % se % features. Kisi bande ki apni ijazat nahi badli.', v_pehle, v_baad;
end $$;


-- ---------------------------------------------------------------------
-- Wapsi ka maal -- AgriBridge Ordering ke andar
-- ---------------------------------------------------------------------
-- Malik: *"stock return aana chahiye lekin wo AgriBridge ke andar hi
-- ho."*
--
-- Menu mein ye sarkhi se hota hai: dono ek hi dashboard mein, aur wapsi
-- ka maal ordering ke foran BAAD. Alag naam se rakhne par banda samajhta
-- hai do alag nizam hain, jab ke wapsi usi ordering ka doosra rukh hai.
update public.dashboard_features df
   set section = 'AgriBridge Ordering',
       section_order = coalesce(
         (select d2.section_order from public.dashboard_features d2
           where d2.dashboard_key = df.dashboard_key and d2.feature_key = 'agri-orders'),
         df.section_order)
 where df.feature_key in ('agri-orders', 'agri-returns')
   and exists (
     select 1 from public.dashboard_features d3
      where d3.dashboard_key = df.dashboard_key and d3.feature_key = 'agri-orders'
   );
