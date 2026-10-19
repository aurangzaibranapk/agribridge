-- 610: WhatsApp = App, Phase 1 -- number se account pehchan. ADDITIVE ONLY. NOT applied.
--
-- Malik (19 Oct 2026): har role (owner, admin, staff, farmer, customer)
-- WhatsApp par wohi kar sake jo app mein. Pehla qadam: bhejne wale ka
-- number kis TASDEEQ-SHUDA account ka hai.
--
-- * Sirf parhta hai. Koi table / column nahi badalta.
-- * Har mumkin ummeedwar (candidate) wapas -- faisla (ek shakhs ya
--   "ambiguous") app ka pure code karta hai (src/lib/whatsapp/identity.ts)
--   aur yahan bhi fn_wa_resolve_identity wahi qaida chalata hai.
-- * Sirf service_role (webhook). anon / authenticated ko execute nahi.
-- * Sources (sab "linked account" wale, koi khula number nahi):
--     profiles.phone_number (active)         -> us profile ka role
--     staff_details.whatsapp_number (verified, CNIC tasdeeq) -> staff
--     farmers.phone_key + user_id (deleted nahi) -> farmer
--     customers.phone_number + user_id (active, deleted nahi) -> customer
--   admin_whatsapp_numbers sirf "listed" nishan hai (us mein profile ka
--   rishta nahi), akela pehchan nahi deta.

create or replace function public.fn_wa_identity_candidates(p_phone_key text)
returns table (source text, user_id uuid, profile_role text, branch_id uuid, full_name text,
               farmer_id uuid, customer_id uuid)
language sql stable security definer set search_path = public, auth
as $$
  with k as (select nullif(right(regexp_replace(coalesce(p_phone_key,''), '\D', '', 'g'), 10), '') as key)
  select 'profile', p.id, p.role::text, p.branch_id, p.full_name, null::uuid, null::uuid
    from public.profiles p, k
   where k.key is not null and length(k.key) = 10 and coalesce(p.is_active, true)
     and public.fn_phone_key(p.phone_number) = k.key
  union all
  select 'staff_whatsapp', s.profile_id, p.role::text, p.branch_id, p.full_name, null, null
    from public.staff_details s join public.profiles p on p.id = s.profile_id, k
   where k.key is not null and s.whatsapp_verified_at is not null and coalesce(p.is_active, true)
     and public.fn_phone_key(s.whatsapp_number) = k.key
  union all
  select 'farmer', f.user_id, p.role::text, p.branch_id, coalesce(p.full_name, f.full_name), f.id, null
    from public.farmers f left join public.profiles p on p.id = f.user_id, k
   where k.key is not null and f.phone_key = k.key and f.user_id is not null and not coalesce(f.is_deleted, false)
  union all
  select 'customer', c.user_id, p.role::text, c.branch_id, coalesce(p.full_name, c.name), c.farmer_id, c.id
    from public.customers c left join public.profiles p on p.id = c.user_id, k
   where k.key is not null and c.user_id is not null and coalesce(c.is_active, true) and not coalesce(c.is_deleted, false)
     and public.fn_phone_key(c.phone_number) = k.key
$$;

-- Ek number = ek shakhs. Do alag accounts mile to 'ambiguous' (unknown list),
-- koi na mile to 'unknown'. Role ki tarteeb: owner > admin > staff > farmer > customer.
create or replace function public.fn_wa_resolve_identity(p_phone_key text)
returns table (kind text, user_id uuid, profile_role text, branch_id uuid, full_name text,
               farmer_id uuid, customer_ids uuid[], listed_admin boolean)
language plpgsql stable security definer set search_path = public, auth
as $$
declare v_users int; v_uid uuid; v_role text; v_listed boolean;
begin
  select exists (select 1 from public.admin_whatsapp_numbers a
                  where a.is_active and a.phone_key = right(regexp_replace(coalesce(p_phone_key,''), '\D', '', 'g'), 10))
    into v_listed;
  select count(distinct c.user_id), min(c.user_id::text)::uuid into v_users, v_uid
    from public.fn_wa_identity_candidates(p_phone_key) c;
  if v_users = 0 then
    return query select 'unknown'::text, null::uuid, null::text, null::uuid, null::text, null::uuid, null::uuid[], v_listed;
    return;
  end if;
  if v_users > 1 then
    return query select 'ambiguous'::text, null::uuid, null::text, null::uuid, null::text, null::uuid, null::uuid[], v_listed;
    return;
  end if;
  select p.role::text into v_role from public.profiles p where p.id = v_uid;
  return query
  select case
           when v_role in ('owner') then 'owner'
           when v_role in ('super_admin', 'admin') then 'admin'
           when v_role = 'farmer' or (v_role is null and exists (select 1 from public.fn_wa_identity_candidates(p_phone_key) x where x.source = 'farmer')) then 'farmer'
           when v_role in ('customer', 'customer_portal') or v_role is null then 'customer'
           else 'staff'
         end,
         v_uid, v_role,
         (select p.branch_id from public.profiles p where p.id = v_uid),
         (select coalesce(p.full_name, (select x.full_name from public.fn_wa_identity_candidates(p_phone_key) x limit 1)) from (select 1) d left join public.profiles p on p.id = v_uid),
         (select f.id from public.farmers f where f.user_id = v_uid and not coalesce(f.is_deleted, false) order by f.created_at nulls last limit 1),
         (select coalesce(array_agg(c.id), array[]::uuid[]) from public.customers c
           where c.user_id = v_uid
              or c.farmer_id = (select f.id from public.farmers f where f.user_id = v_uid and not coalesce(f.is_deleted, false) order by f.created_at nulls last limit 1)),
         v_listed;
end $$;

revoke all on function public.fn_wa_identity_candidates(text) from public, anon, authenticated;
revoke all on function public.fn_wa_resolve_identity(text) from public, anon, authenticated;
grant execute on function public.fn_wa_identity_candidates(text) to service_role;
grant execute on function public.fn_wa_resolve_identity(text) to service_role;
