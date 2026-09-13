-- =====================================================================
-- 193  Ek banda, kai department -- aur database bhi ye jaanta ho
-- =====================================================================
--
-- Ab tak har bande ka ek hi department tha (profiles.role). Chhote
-- karobar mein ye haqeeqat se mel nahi khata: wohi banda Sales bhi
-- dekhta hai aur mausam mein Machinery bhi. Us ke liye ab tak do hi
-- raaste the -- ya to us ka department badal do (aur pehla kaam band ho
-- jaye), ya usay Admin bana do (aur poore karobar ka darwaza khul jaye).
-- Dono ghalat hain.
--
-- YE KAAM SIRF SAFHON KA NAHI. Safhe khol dena aasan tha, magar us se
-- aadha darwaza banta: banda safha khol leta aur qatarein khali aati,
-- kyunke database ki rok abhi bhi "ye to Sales ka banda hai" kehti. Is
-- liye rok bhi wohi baat kahegi jo safha kehta hai.
--
-- TAREEQA. Rokein 127 jagah likhi hui thin, magar sab ek hi shakl mein:
--
--   exists (select 1 from profiles
--            where id = auth.uid() and is_active
--              and role = any (array[...]))
--
-- Har jagah haath se badalna 127 mauqe hain ghalti ke. Is liye wo ek
-- hi jumla ek function mein aaya -- fn_has_dept -- aur har rok us ko
-- bulane lagi. Kal koi teesri baat sochni pari to wo bhi ek hi jagah
-- likhi jayegi.
--
-- EK ROK SAKHT HUI, JAAN BOOJH KAR. In 127 mein se 8 aisi thin jo
-- is_active poochhti hi nahi thin -- yani mulazim ko nikal dene ke baad
-- bhi us ka darwaza khula rehta. fn_has_dept hamesha is_active poochhta
-- hai, is liye wo 8 ab band ho gayin. Ye theek hai: suspend kiya hua
-- banda suspend hi hona chahiye.

-- ---------------------------------------------------------------------
-- 1. Aur kaun se department
-- ---------------------------------------------------------------------
-- Asli department (role) apni jagah rehta hai -- wohi us ka ghar hai,
-- wohi us ka dashboard banata hai. Ye khana us ke ILAWA hai.
alter table public.profiles
  add column if not exists extra_roles public.user_role[] not null default '{}';

comment on column public.profiles.extra_roles is
  'Asli department ke ILAWA jin departmenton mein ye banda kaam karta hai (193).';

-- ---------------------------------------------------------------------
-- 2. Ek hi jumla, ek hi jagah
-- ---------------------------------------------------------------------
-- SECURITY DEFINER lazmi hai: ye function khud profiles parhta hai, aur
-- profiles par bhi RLS lagi hui hai. Bagair is ke wohi purana chakkar
-- banta -- rok function ko bulati, function rok ko.
create or replace function public.fn_has_dept(p_roles public.user_role[])
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid()
       and is_active = true
       and (role = any (p_roles) or extra_roles && p_roles)
  );
$$;

comment on function public.fn_has_dept(public.user_role[]) is
  'Kya is bande ka asli ya koi bhi doosra department in mein hai (193).';

-- Staff ki pehchan bhi doosre department ko ginti mein le. Warna aisa
-- banda jis ka asli darja staff ka na ho magar usay Machinery diya gaya
-- ho, wo har staff-wali qatar se bahar reh jata.
create or replace function public.fn_is_any_staff()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.fn_has_dept(array[
    'owner','super_admin','admin','admin_assistant','manager',
    'sales_staff','finance','warehouse','hr','procurement',
    'milk_collection','machinery'
  ]::public.user_role[]);
$$;

-- ---------------------------------------------------------------------
-- 3. Sab rokein us ek jumle par
-- ---------------------------------------------------------------------
-- Yahan rok ka MATLAB nahi badal raha -- sirf wohi shart ek function ke
-- naam se likhi ja rahi hai. Jo shartein us ke aage peeche lagi hui
-- hain (organization_id, dealer ka milaan waghera) jyon ki tyon rehti
-- hain, kyunke badla sirf andar wala hissa ja raha hai.
do $$
declare
  r record;
  v_qual  text;
  v_check text;
  v_sql   text;
  v_pat   constant text :=
    'EXISTS \( SELECT 1\s+FROM profiles\s+WHERE \(\(profiles\.id = auth\.uid\(\)\)( AND \(profiles\.is_active = true\))? AND \(profiles\.role = ANY \((ARRAY\[[^]]*\])\)\)\)\)';
  v_kitni int := 0;
begin
  for r in
    select schemaname, tablename, policyname, qual, with_check
      from pg_policies
     where schemaname = 'public'
       and (coalesce(qual,'') || coalesce(with_check,'')) like '%profiles.role%'
  loop
    v_qual  := case when r.qual is null then null
                    else regexp_replace(r.qual, v_pat, 'fn_has_dept(\2)', 'g') end;
    v_check := case when r.with_check is null then null
                    else regexp_replace(r.with_check, v_pat, 'fn_has_dept(\2)', 'g') end;

    -- Kuch nahi badla to chhoona bhi nahi. Aisi rokein maujood hain jo
    -- role ka zikr kisi aur shakl mein karti hain; unhen andaze se
    -- badalna un ka matlab badal deta.
    if v_qual is not distinct from r.qual and v_check is not distinct from r.with_check then
      continue;
    end if;

    v_sql := format('alter policy %I on public.%I', r.policyname, r.tablename);
    if v_qual is not null then
      v_sql := v_sql || format(' using (%s)', v_qual);
    end if;
    if v_check is not null then
      v_sql := v_sql || format(' with check (%s)', v_check);
    end if;

    execute v_sql;
    v_kitni := v_kitni + 1;
  end loop;

  raise notice '193: % rokein fn_has_dept par aa gayin', v_kitni;
end $$;

-- ---------------------------------------------------------------------
-- 4. Safhe bhi -- feature ki fehrist doosre department ko bhi gine
-- ---------------------------------------------------------------------
-- Menu aur safhe kholne ki rok dono v_user_feature_access se banti hain
-- (104). Wo view sirf p.role dekhti thi. Us mein doosre department na
-- jorte to darwaza aadha rehta: database qatarein de deta magar safha
-- menu mein aata hi nahi -- aur banda samajhta ke usay kuch mila hi
-- nahi.
--
-- Teesra hissa bilkul pehle wale jaisa hai, farq sirf itna ke role ek
-- ke bajaye extra_roles ki fehrist se aata hai. Ek hi feature dono
-- taraf se mile to do qatarein aati hain -- ye pehle se hota aa raha hai
-- (shakhs ki apni ijazat bhi isi tarah upar se aati hai) aur parhne wale
-- dono jagah har qatar ko alag dekhte hain.
create or replace view public.v_user_feature_access as
 SELECT p.id AS profile_id,
    f.key AS feature_key,
    f.route,
    rfp.actions,
    rfp.data_scope,
    false AS is_temporary,
    NULL::timestamp with time zone AS expires_at
   FROM profiles p
     JOIN role_feature_permissions rfp ON rfp.role = p.role::text
     JOIN features f ON f.key = rfp.feature_key AND f.is_active
  WHERE p.is_active
UNION ALL
 SELECT p.id AS profile_id,
    f.key AS feature_key,
    f.route,
    rfp.actions,
    rfp.data_scope,
    false AS is_temporary,
    NULL::timestamp with time zone AS expires_at
   FROM profiles p
     CROSS JOIN LATERAL unnest(p.extra_roles) AS er(role)
     JOIN role_feature_permissions rfp ON rfp.role = er.role::text
     JOIN features f ON f.key = rfp.feature_key AND f.is_active
  WHERE p.is_active
UNION ALL
 SELECT ufp.profile_id,
    f.key AS feature_key,
    f.route,
    ufp.actions,
    ufp.data_scope,
    ufp.expires_at IS NOT NULL AS is_temporary,
    ufp.expires_at
   FROM user_feature_permissions ufp
     JOIN features f ON f.key = ufp.feature_key AND f.is_active
  WHERE (ufp.starts_at IS NULL OR ufp.starts_at <= now())
    AND (ufp.expires_at IS NULL OR ufp.expires_at > now());
