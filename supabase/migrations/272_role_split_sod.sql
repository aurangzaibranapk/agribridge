-- =====================================================================
-- AgriBridge — Migration 272: Role split (Separation of Duties, malik ka faisla 2 Sep)
-- =====================================================================
-- 271 ke baseline scan mein 9 takraao mile, sab ROLE ki ijazat se (104 ka
-- seed), kisi banday ki alag ijazat se nahi. Malik: "Finance ka
-- SOD-PAY-REVERSE current shakl mein qabool nahi -- role design se alag
-- karein, override se nahi." Baqi HIGH par "prefer role split".
--
-- Ye migration sirf role_feature_permissions badalti hai. Kisi user ki
-- apni ijazat (user_feature_permissions) ko haath nahi lagati.
-- Pehle kya tha, yahan likha hai -- wapas laana ho to yahi qatarein.
--
--   finance  submissions    [view, approve, reject]  -> [view]
--   finance  cash-handover  [view, create, export]   -> [view, export]
--   finance  cash-close     [view, export]           -> [view, create, export]   (close ab finance kare)
--   hr       staff-khata    [view, create, edit]     -> [view]                   (adaigi finance banaye)
--   manager  stock-count    [view, create, approve]  -> [view, create]           (approve finance/Owner)
--   manager  cash-close     [view, create]           -> [view]                   (close finance kare)
--
-- Kaun kya karta hai, is ke baad:
--   Adaigi banana: finance.   Manzoor: manager / Owner (submissions).
--   Cash haath badalna: manager (branch).   Cash close + milaan: finance.
--   Ginti: warehouse / manager.   Ginti manzoor: finance / Owner.
--   Staff ka record: hr.   Staff ko adaigi: finance.
-- Owner / super_admin / admin par koi hadd nahi (unrestricted), waise hi.
-- =====================================================================

update role_feature_permissions set actions = array['view']::text[]
 where role = 'finance' and feature_key = 'submissions';

update role_feature_permissions set actions = array['view','export']::text[]
 where role = 'finance' and feature_key = 'cash-handover';

update role_feature_permissions set actions = array['view','create','export']::text[]
 where role = 'finance' and feature_key = 'cash-close';

update role_feature_permissions set actions = array['view']::text[]
 where role = 'hr' and feature_key = 'staff-khata';

update role_feature_permissions set actions = array['view','create']::text[]
 where role = 'manager' and feature_key = 'stock-count';

update role_feature_permissions set actions = array['view']::text[]
 where role = 'manager' and feature_key = 'cash-close';

-- Help ka jumla: cash close ab finance ka kaam
update feature_help
   set who_uses = 'Finance (close karta hai); Sales/Shop staff aur Manager dekhte hain'
 where feature_key = 'cash-close' and lang = 'rm';
update feature_help
   set who_uses = 'Finance (closes); sales/shop staff and managers view'
 where feature_key = 'cash-close' and lang = 'en';

-- Dobara scan: jo takraao role split se khatam hue, wo 'resolved'
-- (no_longer_detected) ho jayen, silsile ke sath.
select fn_run_access_conflict_scan('manual', null);
