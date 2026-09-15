-- =====================================================================
-- AgriBridge — Migration 343: Ohda TEMPLATE bane, khud chalne wala taala nahi
-- =====================================================================
-- Malik (6 September), Sales Staff ke login ki tasveer bhej kar:
--
--   *"is ko maine kuch bhi permission nahi kia howa lakin is ke paas
--   phir ye sab kuch aa raha hai."*
--
-- Aur jab teen raaste rakhe gaye to unhon ne (c) chuna -- "ohde se sab
-- hata dein" -- magar sath ye shart bhi rakhi:
--
--   *"lekin hamein aasani honi chahiye: ye kis stage par banda aaya hai,
--   usi stage se ko kya kya dena hai wo easy ho."*
--
-- =====================================================================
-- MASLA
-- =====================================================================
--
-- Ijazat bande ko nahi, OHDE ko lagi hui thi. Anwar Ul Hassan ki apni
-- ijazat SIFAR qatarein thin -- magar us ka ohda (`sales_staff`) 20
-- features khud-ba-khud de raha tha, aur un mein se aksar par `create`
-- aur `edit` dono khule the.
--
-- Isi liye har safhe par "Add", "Edit", "Import" ke button nazar aa rahe
-- the -- jab ke malik ka usool ye hai ke **staff tajweez kare, karne ka
-- ikhtiyar sirf us ko mile jise wo dein**.
--
-- =====================================================================
-- KYA BADAL RAHA HAI
-- =====================================================================
--
-- `role_feature_permissions` ab **TEMPLATE** hai -- ek tayyar fehrist,
-- jo naye bande par EK DABAO se lagti hai. Wo khud kisi ko kuch nahi
-- deti.
--
-- Ijazat ab sirf ek jagah se aati hai: `user_feature_permissions` --
-- yani us BANDE ki apni fehrist, jis par naam aur tareekh dono likhe
-- hote hain.
--
-- =====================================================================
-- TARTEEB AHEM HAI: PEHLE NAQAL, PHIR TABDEELI
-- =====================================================================
--
-- Agar view pehle badla jata to us lamhe HAR bande ki ijazat sifar ho
-- jati -- gyarah logon ka menu khali, aur kaam ruk jata.
--
-- Is liye pehle har bande ki MOJOODA ijazat us ke apne khate mein naqal
-- ho rahi hai. Aaj kisi ka kuch nahi badlega. Farq kal se shuru hoga:
-- naya banda bharti ho to us ko khud kuch nahi milega -- malik template
-- lagayenge, aur phir us mein se kam ya zyada karenge.
--
-- Naqal un logon ki bhi ho rahi hai jo abhi band hain (`is_active =
-- false`) -- warna wo dobara chaalu hone par khali haath rehte, aur wajah
-- kisi ko samajh na aati.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) Har bande ki mojooda ijazat us ke apne khate mein
-- ---------------------------------------------------------------------
insert into public.user_feature_permissions
  (profile_id, feature_key, actions, data_scope, reason, granted_by)
select p.id,
       rfp.feature_key,
       rfp.actions,
       rfp.data_scope,
       'Ohde (' || rfp.role || ') se naqal — 343. Us din tak ye ijazat ohde ke sath khud milti thi.',
       null
  from public.profiles p
  join public.role_feature_permissions rfp on rfp.role = p.role::text
  join public.features f on f.key = rfp.feature_key and f.is_active
 where not exists (
   select 1 from public.user_feature_permissions u
    where u.profile_id = p.id and u.feature_key = rfp.feature_key
 );

-- Jin ke paas doosre ohde bhi the (extra_roles), un ka hissa bhi.
insert into public.user_feature_permissions
  (profile_id, feature_key, actions, data_scope, reason, granted_by)
select p.id,
       rfp.feature_key,
       rfp.actions,
       rfp.data_scope,
       'Doosre ohde (' || rfp.role || ') se naqal — 343.',
       null
  from public.profiles p
  cross join lateral unnest(p.extra_roles) er(role)
  join public.role_feature_permissions rfp on rfp.role = er.role::text
  join public.features f on f.key = rfp.feature_key and f.is_active
 where not exists (
   select 1 from public.user_feature_permissions u
    where u.profile_id = p.id and u.feature_key = rfp.feature_key
 );


-- ---------------------------------------------------------------------
-- 2) Ab ijazat sirf bande ki apni fehrist se
-- ---------------------------------------------------------------------
-- Ohde wale do hissay yahan se nikal gaye. Owner/Admin par is ka koi
-- asar nahi -- wo `UNRESTRICTED_ROLES` se guzarte hain aur ye view
-- parhte hi nahi.
create or replace view public.v_user_feature_access as
select ufp.profile_id,
       f.key   as feature_key,
       f.route,
       ufp.actions,
       ufp.data_scope,
       ufp.expires_at is not null as is_temporary,
       ufp.expires_at
  from public.user_feature_permissions ufp
  join public.features f on f.key = ufp.feature_key and f.is_active
 where (ufp.starts_at is null or ufp.starts_at <= now())
   and (ufp.expires_at is null or ufp.expires_at > now());

comment on view public.v_user_feature_access is
  'Kis bande ko kya khulta hai. Sirf us ki APNI fehrist se -- ohda ab template hai, taala nahi (343).';


-- ---------------------------------------------------------------------
-- 3) Template lagane ka ek dabao
-- ---------------------------------------------------------------------
-- Malik ki shart: "ye kis stage par banda aaya hai, usi stage se ko kya
-- kya dena hai wo easy ho."
--
-- Ye function ek tayyar fehrist (ohde ka template) kisi bande par laga
-- deta hai. Jo cheez us ke paas pehle se hai, wo chhui nahi jati --
-- yani malik ne agar kuch kam kiya tha to wo dobara nahi aa jata.
--
-- Sirf Owner/Admin. Ijazat lagana wo kaam hai jo sirf malik ke haath
-- mein rehna chahiye -- AI ya koi aur ise khud nahi karta.
create or replace function public.fn_apply_role_template(
  p_profile uuid,
  p_template text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kitni integer;
  v_mera  text;
begin
  select role::text into v_mera from profiles where id = auth.uid();
  if v_mera is null or v_mera not in ('owner', 'super_admin', 'admin') then
    raise exception 'Template lagana sirf Owner ya Admin ka kaam hai.';
  end if;

  if not exists (select 1 from profiles where id = p_profile) then
    raise exception 'Ye banda nahi mila.';
  end if;

  if not exists (select 1 from role_feature_permissions where role = p_template) then
    raise exception 'Is naam ka koi template nahi: %', p_template;
  end if;

  insert into user_feature_permissions
    (profile_id, feature_key, actions, data_scope, reason, granted_by)
  select p_profile, rfp.feature_key, rfp.actions, rfp.data_scope,
         'Template lagaya: ' || p_template,
         auth.uid()
    from role_feature_permissions rfp
    join features f on f.key = rfp.feature_key and f.is_active
   where rfp.role = p_template
     and not exists (
       select 1 from user_feature_permissions u
        where u.profile_id = p_profile and u.feature_key = rfp.feature_key
     );

  get diagnostics v_kitni = row_count;
  return v_kitni;
end;
$$;

comment on function public.fn_apply_role_template(uuid, text) is
  'Ek tayyar fehrist (ohde ka template) kisi bande par lagata hai. Jo pehle se hai wo chhua nahi jata. Sirf Owner/Admin (343).';

grant execute on function public.fn_apply_role_template(uuid, text) to authenticated;
