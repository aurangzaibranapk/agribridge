-- =====================================================================
-- AgriBridge — Migration 294: Malik ka apna haath cheezon par
-- =====================================================================
-- 293 par kaam karte hue ye saamne aaya, aur ye pehle se chala aa raha
-- hai:
--
--   `products` par likhne ki ijazat in ko hai --
--     super_admin, admin, manager, sales_staff, finance, warehouse
--
--   aur `owner` is fehrist mein HAI HI NAHI.
--
-- Ye us qism ki kharabi hai jo shor nahi machati. RLS se ruka hua UPDATE
-- ghalti nahi deta -- wo bas SIFAR qatarein badalta hai. Yani malik khud
-- kisi cheez ka rate badlein, safha kehta hai "ho gaya", aur database
-- mein kuch nahi hota. Pata us waqt chalta hai jab koi mahine baad
-- poochta hai ke rate badla kyun nahi.
--
-- Nizam ke apne qanoon mein owner un teen rolon mein hai jin par koi rok
-- nahi (UNRESTRICTED_ROLES: owner, super_admin, admin). Database us se
-- ikhtilaf kar raha tha. Ab dono ek baat kehte hain.
-- =====================================================================

drop policy if exists tenant_scoped_access on public.products;

create policy tenant_scoped_access on public.products
  for all to public
  using (
    fn_has_dept(array[
      'owner'::user_role,
      'super_admin'::user_role,
      'admin'::user_role,
      'manager'::user_role,
      'sales_staff'::user_role,
      'finance'::user_role,
      'warehouse'::user_role
    ])
    and organization_id = fn_current_user_organization_id()
  );

notify pgrst, 'reload schema';
