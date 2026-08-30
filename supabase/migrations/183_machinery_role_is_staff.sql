-- 183: Machinery department ka banda bhi mulazim hai.
--
-- Masla jo /admin/departments par saamne aaya: "Machinery -- 0 banday".
-- Wajah ye nahi thi ke kisi ko lagaya nahi gaya; wajah ye thi ke lagaya
-- ja hi nahi SAKTA tha:
--
--   1. /admin/users ke role wale khane mein "Machinery" ka option hi
--      nahi tha (app mein theek kiya gaya).
--   2. STAFF_ROLES mein 'machinery' nahi tha -- aisa banda login kar ke
--      /admin ke bajaye website par phenk diya jata.
--   3. Aur yahan: fn_is_any_staff() mein bhi 'machinery' nahi tha.
--
-- Teesri wajah sab se khamosh hai. RLS ki har wo policy jo is function
-- par khaRi hai, machinery wale bande ke liye JHOOT bolti -- na koi
-- error, na koi rok. Bas har safha khali. Banda kehta "kuch nazar nahi
-- aata" aur kisi log mein kuch na hota.
--
-- Ye function sirf ye poochta hai ke banda mulazim hai ya nahi. Machinery
-- wala kya kya dekh sakta hai, wo alag sawal hai aur us ka jawab
-- role_page_permissions mein hai -- wahi jise /admin/departments par
-- admin khud tay karta hai.

create or replace function public.fn_is_any_staff()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_active = true
    and role in ('owner','super_admin','admin','admin_assistant','manager',
                 'sales_staff','finance','warehouse','hr','procurement',
                 'milk_collection','machinery')
  );
$function$;
