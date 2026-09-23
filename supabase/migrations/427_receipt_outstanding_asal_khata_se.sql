-- =====================================================================
-- AgriBridge — Migration 427: Receipt ka "Outstanding" asal khate se
-- =====================================================================
-- Malik (16 September): "ye outstanding Mujahid k naam pay ziyada hai,
-- yahan kam kyun dikha raha hai" — receipt ne Rs 520 dikhaya, asal
-- (ledger, account 1100) Rs 13,453 tha.
--
-- Wajah: `get_sale_receipt` `khata_accounts.current_balance` parhta
-- tha — ye ek PURANA, is shakh (branch) tak mehdood cache hai jo asal
-- ledger ke sath sync nahi rehta. `customers.current_balance` wohi
-- adad hai jo `customer-udhaar.ts` aur POS checkout dono seedha ledger
-- ke sath update karte hain (account 1100 ka asal jama) -- tasdeeq:
-- Mujahid ke liye dono barabar hain (13,453 = 13,453), jab ke
-- `khata_accounts` peeche reh gaya tha.
--
-- Is liye ab receipt seedha `customers.current_balance` se poochta
-- hai -- wahi jo POS counter par gahak chunte waqt bhi dikhta hai.
-- Dealer wala raasta (khata_accounts.dealer_id) nahi chheda -- alag
-- table (dealer_customers), alag masla nahi mila.
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
    'seller_name', coalesce(d.business_name, br.name),
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
  left join dealer_customers dc on dc.id = s.customer_id
  left join customers cc on cc.id = s.crm_customer_id
  where s.id = p_sale_id;

  return v_result;
end;
$function$;
