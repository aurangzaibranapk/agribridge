-- 579: Customer portal role check fix (go-live 2, 19 Oct 2026)
-- Live user_role enum mein 'cashier' aur 'accountant' nahi hain. 572/573 mein
-- role check ('...','cashier','accountant') enum cast par fail hota tha
-- ("invalid input value for enum user_role"), jis se fn_admin_customer_portal
-- har kisi ke liye aur fn_cp_staff_can staff ke liye toot jata tha.
-- Fix: role ko text bana kar compare karo. Mantiq wahi; sirf additive replace.

create or replace function public.fn_cp_staff_can(p_customer uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null or p_customer is null then return false; end if;
  -- Apna hi khata staff ki tarah nahi chala sakta
  if exists (select 1 from customers c where c.id = p_customer and c.user_id = v_uid) then return false; end if;
  if public.fn_cp_is_admin() then
    return exists (select 1 from customers c where c.id = p_customer);
  end if;
  return exists (
    select 1 from profiles p join customers c on c.id = p_customer
     where p.id = v_uid and coalesce(p.is_active, false)
       and p.branch_id is not null and c.branch_id = p.branch_id
       and (p.role::text in ('manager','sales_staff','cashier','accountant')
            or coalesce(p.extra_roles::text[], array[]::text[]) && array['manager','sales_staff','cashier','accountant']::text[]));
end $$;
revoke all on function public.fn_cp_staff_can(uuid) from public, anon;
grant execute on function public.fn_cp_staff_can(uuid) to authenticated, service_role;

create or replace function public.fn_admin_customer_portal()
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
begin
  if auth.uid() is null or not (public.fn_cp_is_admin() or exists (
      select 1 from profiles p where p.id = auth.uid() and coalesce(p.is_active, false) and p.branch_id is not null
        and p.role::text in ('manager','sales_staff','cashier','accountant'))) then
    raise exception 'Is safhe ki ijazat nahi';
  end if;
  return coalesce((select jsonb_agg(x order by x->>'name') from (
    select jsonb_build_object('id', c.id, 'code', public.fn_cp_code(c.id), 'name', c.name, 'business_name', c.business_name,
      'farmer_code', (select f.farmer_code from farmers f where f.id = c.farmer_id),
      'branch', (select b.name from branches b where b.id = c.branch_id),
      'balance', coalesce(c.current_balance, 0), 'credit_limit', coalesce(c.credit_limit, 0),
      'has_phone', c.phone_number is not null and length(trim(c.phone_number)) > 0,
      'portal', case when c.user_id is null then 'none'
                     when exists (select 1 from auth.users u where u.id = c.user_id and u.banned_until > now())
                       or exists (select 1 from profiles p where p.id = c.user_id and not coalesce(p.is_active, true)) then 'suspended'
                     else 'active' end,
      'last_seen', (select u.last_sign_in_at from auth.users u where u.id = c.user_id),
      'pending', (select count(*) from customer_payment_claims r where r.customer_id = c.id and r.status in ('submitted','checked'))
               + (select count(*) from customer_change_requests r where r.customer_id = c.id and r.status in ('submitted','checked'))
               + (select count(*) from customer_promise_requests r where r.customer_id = c.id and r.status in ('submitted','checked'))
               + (select count(*) from customer_khata_disputes r where r.customer_id = c.id and r.status = 'open')
    ) x
    from customers c where not coalesce(c.is_deleted, false) and public.fn_cp_staff_can(c.id)) z), '[]'::jsonb);
end $$;
