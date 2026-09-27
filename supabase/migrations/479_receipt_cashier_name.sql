-- =====================================================================
-- AgriBridge — Migration 479: Receipt par Cashier naam dikhana
-- =====================================================================
-- `get_sale_receipt` mein `cashier_name` field nahi tha — pos_sales.created_by
-- se profiles.full_name join kar ke cashier ka naam add kiya.
create or replace function public.get_sale_receipt(p_sale_id uuid)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_result json;
  v_dealer_id uuid;
  v_customer_id uuid;
  v_crm_customer_id uuid;
  v_outstanding numeric;
begin
  select dealer_id, customer_id, crm_customer_id
    into v_dealer_id, v_customer_id, v_crm_customer_id
  from pos_sales where id = p_sale_id;

  if v_dealer_id is not null then
    select current_balance into v_outstanding
    from khata_accounts
    where dealer_id = v_dealer_id and customer_id = v_customer_id;
  else
    select current_balance into v_outstanding
    from customers
    where id = v_crm_customer_id;
  end if;

  select json_build_object(
    'sale_id', s.id,
    'created_at', s.created_at,
    'payment_mode', s.payment_mode,
    'total_amount', s.total_amount,
    'cash_paid', s.cash_paid,
    'khata_amount', s.khata_amount,
    'outstanding_balance', coalesce(v_outstanding, 0),
    'seller_name', coalesce(d.business_name, case when br.is_main_branch then 'Main Branch' else br.name end),
    'shop_name', sh.name,
    'seller_phone', d.phone_number,
    'cashier_name', coalesce(pr.full_name, 'Staff'),
    'customer_name', coalesce(dc.name, cc.name, 'Walk-in'),
    'customer_phone', coalesce(dc.phone, cc.phone_number),
    'items', (
      select json_agg(json_build_object(
        'name', p.name,
        'quantity', si.quantity,
        'unit_price', si.unit_price,
        'subtotal', si.subtotal
      ))
      from pos_sale_items si
      join products p on p.id = si.product_id
      where si.sale_id = s.id
    )
  ) into v_result
  from pos_sales s
  left join dealers d on d.id = s.dealer_id
  left join branches br on br.id = s.branch_id
  left join shops sh on sh.id = s.shop_id
  left join dealer_customers dc on dc.id = s.customer_id
  left join customers cc on cc.id = s.crm_customer_id
  left join profiles pr on pr.id = s.created_by
  where s.id = p_sale_id;

  return v_result;
end;
$function$;
