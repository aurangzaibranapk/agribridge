-- Customer opening balance save ke baad total dobara ginne wali RPC ko
-- organization-safe rakho. Return type wahi hai, is liye CREATE OR REPLACE
-- purani live function par SQLSTATE 42P13 nahi dega.
create or replace function public.fn_customer_baqi(p_customer uuid)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_baqi numeric;
begin
  if not public.fn_is_any_staff() then
    return null;
  end if;

  if not exists (
    select 1
      from public.customers c
     where c.id = p_customer
       and c.organization_id = public.fn_current_user_organization_id()
  ) then
    return null;
  end if;

  select round(coalesce(sum(coalesce(l.debit, 0) - coalesce(l.credit, 0)), 0), 2)
    into v_baqi
    from public.journal_lines l
   where l.account_code = '1100'
     and l.party_type = 'customer'
     and l.party_id = p_customer;

  return coalesce(v_baqi, 0);
end;
$$;

revoke all on function public.fn_customer_baqi(uuid) from public, anon;
grant execute on function public.fn_customer_baqi(uuid) to authenticated, service_role;

comment on function public.fn_customer_baqi(uuid) is
  'Organization-guarded customer 1100 balance for signed-in staff.';
