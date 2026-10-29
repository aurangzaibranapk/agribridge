-- Signed-in Dealer/Supplier profile for the mobile Business Munshi.
-- Security definer resolves the merchant from auth.uid(); callers cannot pass an id.
create or replace function public.fn_my_merchant_profile(p_role text)
returns table (
  business_name text,
  contact_person text,
  phone_number text,
  address text,
  bank_name text,
  bank_account_title text,
  bank_account_number text,
  bank_iban text,
  verification_status text,
  current_payable numeric
)
language plpgsql
stable
security definer
set search_path = '' as $$
declare
  v_role text := lower(coalesce(p_role, ''));
  v_merchant_id uuid;
begin
  if v_role not in ('dealer','supplier') then
    raise exception 'Merchant role theek nahi.';
  end if;

  if v_role = 'dealer' then
    select d.id into v_merchant_id
    from public.dealers d
    where d.user_id = auth.uid() and d.is_active
    order by d.created_at limit 1;
  else
    select s.id into v_merchant_id
    from public.suppliers s
    where s.user_id = auth.uid() and s.is_active
    order by s.created_at limit 1;
  end if;

  if v_merchant_id is null and to_regclass('public.app_test_links') is not null then
    select l.record_id into v_merchant_id
    from public.app_test_links l
    join public.app_test_accounts a on a.profile_id = l.account_id
    where l.account_id = auth.uid()
      and l.role = v_role
      and l.record_table = case when v_role = 'dealer' then 'dealers' else 'suppliers' end
    limit 1;
  end if;
  if v_merchant_id is null then return; end if;

  if v_role = 'dealer' then
    return query
    select d.business_name, d.contact_person, d.phone_number, d.address,
           d.bank_name, d.bank_account_title, d.bank_account_number, d.bank_iban,
           d.verification_status, d.current_payable
    from public.dealers d where d.id = v_merchant_id;
  else
    return query
    select coalesce(s.company_name, s.name), s.contact_person, s.phone_number, s.address,
           s.bank_name, s.bank_account_title, s.bank_account_number, s.bank_iban,
           s.status, s.current_payable
    from public.suppliers s where s.id = v_merchant_id;
  end if;
end
$$;

revoke execute on function public.fn_my_merchant_profile(text) from public, anon;
grant execute on function public.fn_my_merchant_profile(text) to authenticated;

comment on function public.fn_my_merchant_profile(text) is
  'Returns only the signed-in Dealer/Supplier profile, including an explicitly linked TEST merchant.';
