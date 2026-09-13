-- =====================================================================
-- AgriBridge — Migration 355: Naya signup khudbakhud staff nahi banta
-- =====================================================================
-- ERP ki poori review ke doraan (6 September) mila -- malik ne khud
-- nahi poocha tha, review karte hue nikla.
--
-- Malik ka usool: koi bhi cheez apne aap staff na ban jaye.
--
-- fn_handle_new_user() har naye auth.users insert par chalta hai --
-- chahe app ke apne signup form se ho, chahe koi seedha Supabase Auth
-- API (public anon key se, jo har website ki JS mein khula hota hai)
-- istemal kar le. Ab tak agar role metadata mein nahi bheja jata tha
-- (ya koi na-pehchana hua role bheja jata), to banda seedha
-- 'sales_staff' ban jata tha -- aur fn_is_any_staff() 'sales_staff' ko
-- staff manta hai.
--
-- App ke andar har jagah jahan staff banaya jata hai (hr.ts, jobs.ts,
-- vendor-portal.ts) wahan role turant profiles.upsert se seedha likha
-- jata hai -- is default par kisi ka inhisar nahi. Is liye ise
-- 'sales_staff' se hata kar 'customer' (bilkul ijazat wala nahi) karna
-- kisi mojooda kaam ko nahi torhta, sirf ek khula darwaza band karta
-- hai.
-- =====================================================================

create or replace function public.fn_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_is_first boolean;
  v_requested_role text;
begin
  select count(*) = 0 into v_is_first from public.profiles;
  v_requested_role := new.raw_user_meta_data->>'role';

  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    case
      when v_is_first then 'super_admin'::public.user_role
      when v_requested_role in ('farmer', 'customer', 'dealer', 'investor', 'machinery_vendor', 'company_rep') then v_requested_role::public.user_role
      else 'customer'::public.user_role
    end
  );
  return new;
end;
$function$;
