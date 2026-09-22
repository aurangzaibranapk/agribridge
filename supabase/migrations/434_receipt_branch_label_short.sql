-- =====================================================================
-- AgriBridge — Migration 434: Receipt subtitle par sirf "Main Branch"
-- =====================================================================
-- Malik (18 September): receipt ke subtitle mein "Main Branch" ke
-- sath "Mahabali" nahi aana chahiye -- upar bold header mein shop ka
-- poora naam ("Kisaan Karyana Mahabali") already aa raha hai, is liye
-- neeche wahi location dobara likhna zaroorat nahi.
--
-- `branches.name` khud nahi badla (baqi safhon par poora context
-- chahiye) -- sirf receipt ke `seller_name` mein, main branch ho to
-- generic "Main Branch" (`is_main_branch` se, naam ka hissa kaat kar
-- nahi -- taake koi bhi shakh/location ka naam ho, ye theek rahe).
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
  where s.id = p_sale_id;

  return v_result;
end;
$function$;
