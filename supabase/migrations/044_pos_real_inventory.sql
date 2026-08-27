-- ============================================================
-- 044: POS ko ad-hoc "branch_inventory" se hata kar asal
-- purchase-driven inventory/warehouses/stock_movements system
-- par migrate kiya — taake Purchases se aane wala stock aur POS
-- se jaane wala stock ek hi jagah, sahi tarah se track ho.
-- ============================================================

insert into inventory (product_id, warehouse_id, quantity_on_hand)
select bi.product_id, w.id, bi.stock_quantity
from branch_inventory bi
join warehouses w on w.branch_id = bi.branch_id and w.code = 'MAIN';

drop table if exists branch_inventory;

create or replace function public.create_pos_sale(
  p_customer_id uuid,
  p_payment_mode text,
  p_cash_paid numeric,
  p_khata_amount numeric,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_dealer_id uuid;
  v_branch_id uuid;
  v_warehouse_id uuid;
  v_sale_id uuid;
  v_total numeric := 0;
  v_item jsonb;
  v_khata_account_id uuid;
  v_remaining numeric;
  v_inv_row record;
  v_take numeric;
begin
  v_dealer_id := current_dealer_id();
  if v_dealer_id is null then
    v_branch_id := fn_current_user_branch_id();
    if v_branch_id is not null then
      select id into v_warehouse_id from warehouses where branch_id = v_branch_id and code = 'MAIN' limit 1;
    end if;
  end if;

  if v_dealer_id is null and v_branch_id is null then
    raise exception 'No dealer or branch found for current user';
  end if;

  if p_payment_mode in ('khata', 'split') and p_customer_id is null then
    raise exception 'Khata or split sale requires a customer';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_total := v_total + ((v_item->>'quantity')::numeric * (v_item->>'unit_price')::numeric);
  end loop;

  insert into pos_sales (
    dealer_id, branch_id, customer_id, crm_customer_id,
    payment_mode, total_amount, cash_paid, khata_amount, created_by
  )
  values (
    v_dealer_id, v_branch_id,
    case when v_dealer_id is not null then p_customer_id else null end,
    case when v_branch_id is not null then p_customer_id else null end,
    p_payment_mode, v_total, p_cash_paid, p_khata_amount, auth.uid()
  )
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into pos_sale_items (sale_id, product_id, quantity, unit_price, subtotal)
    values (
      v_sale_id,
      (v_item->>'product_id')::uuid,
      (v_item->>'quantity')::numeric,
      (v_item->>'unit_price')::numeric,
      (v_item->>'quantity')::numeric * (v_item->>'unit_price')::numeric
    );

    if v_dealer_id is not null then
      update dealer_inventory
      set stock_quantity = stock_quantity - (v_item->>'quantity')::numeric
      where dealer_id = v_dealer_id and product_id = (v_item->>'product_id')::uuid;
    else
      v_remaining := (v_item->>'quantity')::numeric;
      for v_inv_row in
        select i.id, i.quantity_on_hand
        from inventory i
        left join stock_batches sb on sb.id = i.batch_id
        where i.warehouse_id = v_warehouse_id
          and i.product_id = (v_item->>'product_id')::uuid
          and i.quantity_on_hand > 0
        order by sb.expiry_date asc nulls last, i.updated_at asc
      loop
        exit when v_remaining <= 0;
        v_take := least(v_remaining, v_inv_row.quantity_on_hand);
        insert into stock_movements (inventory_id, movement_type, quantity, balance_after, reference_type, reference_id, created_by)
        values (v_inv_row.id, 'sale_out', v_take, 0, 'pos_sale', v_sale_id, auth.uid());
        v_remaining := v_remaining - v_take;
      end loop;
    end if;
  end loop;

  if p_khata_amount > 0 then
    if v_dealer_id is not null then
      select id into v_khata_account_id from khata_accounts where dealer_id = v_dealer_id and customer_id = p_customer_id;
      if v_khata_account_id is null then
        insert into khata_accounts (dealer_id, customer_id, current_balance)
        values (v_dealer_id, p_customer_id, 0)
        returning id into v_khata_account_id;
      end if;
    else
      select id into v_khata_account_id from khata_accounts where branch_id = v_branch_id and crm_customer_id = p_customer_id;
      if v_khata_account_id is null then
        insert into khata_accounts (branch_id, crm_customer_id, current_balance)
        values (v_branch_id, p_customer_id, 0)
        returning id into v_khata_account_id;
      end if;
    end if;

    insert into khata_transactions (khata_account_id, type, amount, reference_sale_id, note, created_by)
    values (v_khata_account_id, 'debit', p_khata_amount, v_sale_id, 'POS sale', auth.uid());

    update khata_accounts
    set current_balance = current_balance + p_khata_amount
    where id = v_khata_account_id;
  end if;

  return v_sale_id;
end;
$function$;