-- =====================================================================
-- AgriBridge — Migration 279: Nayi tables par ijazat (GRANT)
-- =====================================================================
-- Safhe par saaf error aaya: "permission denied for table
-- access_conflict_findings". Ye RLS nahi -- ye GRANT hai. RLS ki rok
-- KHALI jawab deti hai; GRANT ki rok saaf mana karti hai. Isi liye
-- pehle sirf sifar nazar aa rahe the aur wajah chhupi hui thi.
--
-- Jarh: jo tables migration ke zariye banayi gayin, un par anon /
-- authenticated / service_role ko koi haq mila hi nahi. 58 tables aur
-- views is haal mein thin -- yani 265 se aage ka har naya feature
-- (access requests, takraao, tajaweez, training, units, supplier bill
-- reads...) database tak pahunch hi nahi sakta tha. Live par bhi yehi
-- hota.
--
-- Tarteeb yahan soch kar rakhi gayi hai:
--
--   Table + RLS  -> authenticated aur service_role dono. Rok RLS karti
--                   hai, GRANT nahi -- yehi Supabase ka apna tareeqa
--                   hai aur baqi database bhi isi par hai.
--   Table, RLS nahin -> sirf service_role. Ye teen andar ke khane hain
--                   (counters, repairs) jinhen sirf server chhoota hai;
--                   in par bina RLS ke authenticated ko haq dena
--                   darwaza khula chhoRna hota.
--   View         -> `security_invoker = on` PEHLE, phir SELECT. Views par
--                   RLS nahi chalti: bina is ke har logged-in banda (kisan
--                   bhi) staff ke supplier dues wagera parh sakta tha.
--                   security_invoker se view poochne wale ki apni RLS ke
--                   sath chalta hai. Service client (server) waise hi
--                   sab dekhta hai.
--
-- anon ko jaan boojh kar kuch nahi diya: in tables ka har raasta server
-- ke service client se guzarta hai (dekhein farmers/otp.ts, suggestions,
-- access-requests). Bina zaroorat ke darwaza kholna is project ka usool
-- nahi.
-- =====================================================================

do $$
declare r record;
begin
  for r in
    select c.relname, c.relkind, c.relrowsecurity
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind in ('r','v','m')
       and not exists (
             select 1 from information_schema.role_table_grants g
              where g.table_schema = 'public'
                and g.table_name = c.relname
                and g.grantee = 'service_role')
  loop
    if r.relkind = 'r' then
      execute format('grant select, insert, update, delete on public.%I to service_role', r.relname);
      if r.relrowsecurity then
        execute format('grant select, insert, update, delete on public.%I to authenticated', r.relname);
      end if;
    else
      execute format('alter view public.%I set (security_invoker = on)', r.relname);
      execute format('grant select on public.%I to service_role, authenticated', r.relname);
    end if;
  end loop;
end $$;

select pg_notify('pgrst', 'reload schema');
