create or replace function public.fn_my_merchant_orders(p_role text)
returns table (
  id uuid,
  number text,
  status text,
  amount numeric,
  order_date date,
  guarantee_status text
)
language plpgsql
stable
security definer
set search_path = '' as $$
declare
  v_role text := lower(coalesce(p_role, ''));
  v_merchant_id uuid;
begin
  if v_role not in ('dealer','supplier') then raise exception 'Merchant role theek nahi.'; end if;

  if v_role = 'dealer' then
    select d.id into v_merchant_id from public.dealers d
    where d.user_id = auth.uid() and d.is_active order by d.created_at limit 1;
  else
    select s.id into v_merchant_id from public.suppliers s
    where s.user_id = auth.uid() and s.is_active order by s.created_at limit 1;
  end if;

  if v_merchant_id is null then
    select l.record_id into v_merchant_id
    from public.app_test_links l
    join public.app_test_accounts a on a.profile_id = l.account_id
    where l.account_id = auth.uid() and l.role = v_role
      and l.record_table = case when v_role = 'dealer' then 'dealers' else 'suppliers' end
    limit 1;
  end if;
  if v_merchant_id is null then return; end if;

  if v_role = 'dealer' then
    return query
    select o.id, o.order_number, o.status::text, o.subtotal, o.placed_at::date,
           o.guarantee_status
    from public.bridge_orders o
    where o.assigned_dealer_id = v_merchant_id
    order by o.placed_at desc limit 50;
  else
    return query
    select p.id, coalesce(p.purchase_number, p.supplier_bill_no), p.status::text,
           p.total_amount, p.purchase_date, 'not_applicable'::text
    from public.purchases p
    where p.supplier_id = v_merchant_id
    order by p.purchase_date desc, p.created_at desc limit 50;
  end if;
end
$$;

revoke execute on function public.fn_my_merchant_orders(text) from public, anon;
grant execute on function public.fn_my_merchant_orders(text) to authenticated;

comment on function public.fn_my_merchant_orders(text) is
  'Server-resolved Dealer guaranteed orders or Supplier purchase bills; never an admin-wide list during TEST role switch.';
