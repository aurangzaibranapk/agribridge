-- =====================================================================
-- AgriBridge — Migration 560: Login hai magar profile nahi -- khud theek
-- =====================================================================
-- 17 October: malik ka kisan login (FRM-000003) "Account setup adhoora
-- hai" deta raha. auth.users mein banda tha, farmers.user_id juda tha,
-- magar public.profiles mein qatar hi nahi thi.
--
-- Signup trigger (trg_on_auth_user_created -> fn_handle_new_user, 355)
-- har naye login par profile banata hai -- wo theek hai. Profile BAAD
-- mein gum hui: deleteStaff/deleteApplication pehle profile mitate the,
-- phir auth user -- aur auth delete fail ho jaye (farmers.user_id ka FK)
-- to wo ghalti chupke se nigli jati thi. Natija: login baqi, profile
-- ghaib. App ka wo hissa alag theek hua hai; ye migration database ki
-- taraf ka jaal hai.
--
-- Sirf nayi cheezein (additive):
--   * fn_profile_seed_for_user(uuid)   -- juRe record se darja/org/branch
--   * fn_ensure_profile(uuid)          -- service_role: na ho to banao
--   * fn_ensure_my_profile()           -- authenticated: sirf apni
--   * fn_auth_users_without_profile()  -- service_role: fehrist (report)
--   * fn_handle_new_user               -- wohi body + `on conflict do
--                                         nothing` (dobara chale to na toote)
--
-- USOOL:
--   * Staff ka darja KABHI khud nahi banta. Sirf wahi darja jo juRe
--     record se sabit ho (farmers -> farmer, customers/dealers/buyers/
--     investors -> customer [app ka mojooda usool, dealers.ts/buyers.ts/
--     investors.ts], machinery_vendors -> machinery_vendor, company_reps
--     -> company_rep). Koi juRa record nahi -> kuch nahi banta.
--   * Naya khud-bana kisan approval mein hi rehta hai -- wo pehra
--     farmers.signup_approval_status par hai (535), profile par nahi.
--   * Mojooda profile ko kabhi nahi chhuta (on conflict do nothing).
--   * Mitaya hua (is_deleted) kisan/customer profile nahi banwata.
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
  )
  on conflict (id) do nothing;
  return new;
end;
$function$;

-- juRe record se: darja, naam, phone, org, branch, shop. Pehla match jeetta hai.
create or replace function public.fn_profile_seed_for_user(p_user uuid)
returns table (role text, full_name text, phone_number text, organization_id uuid, branch_id uuid, shop_id uuid, source text)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select x.r_role, x.r_name, x.r_phone, x.r_org, x.r_branch, x.r_shop, x.r_source from (
    select 'farmer'::text as r_role, f.full_name::text as r_name, f.phone_number::text as r_phone, f.organization_id as r_org,
           f.branch_id as r_branch, null::uuid as r_shop, 'farmers'::text as r_source, 1 as prio
      from public.farmers f where f.user_id = p_user and coalesce(f.is_deleted, false) = false
    union all
    select 'customer', coalesce(c.name, c.business_name)::text, c.phone_number::text, c.organization_id, c.branch_id, c.shop_id, 'customers', 2
      from public.customers c where c.user_id = p_user and coalesce(c.is_deleted, false) = false
    union all
    select 'machinery_vendor', v.vendor_name::text, v.phone::text, null::uuid, null::uuid, null::uuid, 'machinery_vendors', 3
      from public.machinery_vendors v where v.user_id = p_user
    union all
    select 'customer', d.business_name::text, d.phone_number::text, d.organization_id, null::uuid, null::uuid, 'dealers', 4
      from public.dealers d where d.user_id = p_user
    union all
    select 'customer', b.business_name::text, b.phone_number::text, b.organization_id, null::uuid, null::uuid, 'buyers', 5
      from public.buyers b where b.user_id = p_user
    union all
    select 'customer', i.full_name::text, i.phone_number::text, i.organization_id, null::uuid, null::uuid, 'investors', 6
      from public.investors i where i.user_id = p_user
    union all
    select 'company_rep', r.full_name::text, r.phone_number::text, null::uuid, null::uuid, null::uuid, 'company_reps', 7
      from public.company_reps r where r.user_id = p_user
  ) x
  order by x.prio
  limit 1;
$function$;

-- Na ho to banao. Jawab: profile ka darja (pehle se tha ya abhi bana),
-- ya null jab koi juRa record hi nahi (staff khud nahi banta).
create or replace function public.fn_ensure_profile(p_user uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_role text;
  s record;
begin
  if p_user is null then return null; end if;

  select p.role::text into v_role from public.profiles p where p.id = p_user;
  if v_role is not null then return v_role; end if;

  if not exists (select 1 from auth.users u where u.id = p_user) then return null; end if;

  select * into s from public.fn_profile_seed_for_user(p_user);
  if s.role is null then return null; end if;

  insert into public.profiles (id, full_name, role, phone_number, organization_id, branch_id, shop_id, is_active)
  values (
    p_user,
    coalesce(nullif(trim(s.full_name), ''), (select u.email from auth.users u where u.id = p_user), 'Member'),
    s.role::public.user_role,
    s.phone_number,
    coalesce(s.organization_id, public.fn_default_organization_id()),
    s.branch_id,
    s.shop_id,
    true
  )
  on conflict (id) do nothing;

  select p.role::text into v_role from public.profiles p where p.id = p_user;
  return v_role;
end;
$function$;

-- Login ke waqt: sirf APNI profile. Kisi aur ka id dene ka raasta nahi.
create or replace function public.fn_ensure_my_profile()
returns text
language sql
volatile
security definer
set search_path to 'public'
as $function$
  select public.fn_ensure_profile(auth.uid());
$function$;

-- Report: kaun se login bina profile ke hain (koi raaz nahi -- sirf
-- id, domain, metadata darja, juRa record).
create or replace function public.fn_auth_users_without_profile()
returns table (user_id uuid, email_domain text, meta_role text, created_at timestamptz, seed_role text, seed_source text)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select u.id, split_part(u.email, '@', 2), u.raw_user_meta_data->>'role', u.created_at, s.role, s.source
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join lateral public.fn_profile_seed_for_user(u.id) s on true
  where p.id is null
  order by u.created_at;
$function$;

revoke execute on function public.fn_profile_seed_for_user(uuid) from public, anon, authenticated;
revoke execute on function public.fn_ensure_profile(uuid) from public, anon, authenticated;
revoke execute on function public.fn_ensure_my_profile() from public, anon;
revoke execute on function public.fn_auth_users_without_profile() from public, anon, authenticated;
grant execute on function public.fn_profile_seed_for_user(uuid) to service_role;
grant execute on function public.fn_ensure_profile(uuid) to service_role;
grant execute on function public.fn_ensure_my_profile() to authenticated, service_role;
grant execute on function public.fn_auth_users_without_profile() to service_role;
