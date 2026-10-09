-- 513: POS stock integrity (stock_ledger_recon_20261009 ke baad)
--
-- (a) Carton bikri: wholesale counter par quantity CARTON mein hoti hai
--     (unit_price = products.wholesale_price), magar stock/batch BOTTLE mein.
--     Pehle 1 carton = 1 bottle ghatta tha (456 bottle beche, 61 ghate) --
--     nafa phoola hua aur stock zyada dikhta tha. Ab carton line par
--     units_per_pack bottle ghatte hain aur COGS bhi utne bottle ka.
--     Carton pehchan: item->>'sale_unit' = 'carton' (server action bhejta
--     hai), warna purane/offline clients ke liye: units_per_pack > 1 aur
--     unit_price > 2.5 x selling_price.
-- (b) Inventory row: pehle `limit 1` kisi bhi row ko pakaR leta tha (duplicate
--     rows par 0 wali row se ghata kar baqi stock waisa hi reh jata). Ab rows
--     zyada stock wali pehle, aur zaroorat ho to kai rows se ghatata hai.
--     Duplicate rows dekhne ke liye view: v_inventory_duplicate_rows.
--
-- Signature wohi (504 ka wrapper create_pos_sale isi ko bulata hai).

create or replace function public.pos_line_stock_units(
  p_product_id uuid, p_quantity numeric, p_unit_price numeric, p_sale_unit text default null
) returns numeric
language sql stable
set search_path = public
as $$
  select p_quantity * case
    when coalesce(p.units_per_pack, 1) > 1 and (
           p_sale_unit = 'carton'
        or (p_sale_unit is null and coalesce(p.selling_price, 0) > 0 and p_unit_price > 2.5 * p.selling_price)
      ) then p.units_per_pack
    else 1 end
  from products p where p.id = p_product_id
$$;

create or replace function public.create_pos_sale_base_504(
  p_items jsonb, p_payment_mode text, p_cash_paid numeric default 0, p_khata_amount numeric default 0,
  p_customer_id uuid default null, p_counter_id uuid default null, p_payment_lines jsonb default null,
  p_discount numeric default null, p_discount_reason text default null
) returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_dealer_id uuid;
  v_branch_id uuid;
  v_shop_id uuid;
  v_warehouse_id uuid;
  v_shift_id uuid;
  v_sale_id uuid;
  v_total numeric := 0;
  v_net numeric := 0;
  v_disc numeric := coalesce(p_discount, 0);
  v_total_cogs numeric := 0;
  v_item jsonb;
  v_khata_account_id uuid;
  v_remaining numeric;
  v_take numeric;
  v_item_id uuid;
  v_item_qty numeric;
  v_item_units numeric;
  v_item_price numeric;
  v_item_cogs numeric;
  v_product_id uuid;
  v_batch record;
  v_inv record;
  v_deducted numeric;
  v_pline jsonb;
  v_counter record;
begin
  v_dealer_id := current_dealer_id();
  if v_dealer_id is null then
    if p_counter_id is not null then
      select * into v_counter from pos_counters where id = p_counter_id and is_active;
      if not found then
        raise exception 'Ye POS counter nahi mila ya band hai.';
      end if;
      if not exists (
        select 1 from pos_counter_staff
        where counter_id = p_counter_id and profile_id = auth.uid() and is_active
      ) then
        raise exception 'Aapko is counter par bikri ki ijazat nahi hai.';
      end if;
      select id into v_shift_id from pos_shifts
        where counter_id = p_counter_id and staff_id = auth.uid() and status = 'open'
        order by opened_at desc limit 1;
      if v_shift_id is null then
        raise exception 'Is counter par aapka Shift khula nahi hai -- pehle Shift Open karein.';
      end if;
      v_branch_id := v_counter.branch_id;
      v_shop_id := v_counter.shop_id;
      v_warehouse_id := v_counter.warehouse_id;
      if v_warehouse_id is null then
        raise exception 'Is counter ka stock source (warehouse) set nahi hai.';
      end if;
    else
      v_branch_id := fn_current_user_branch_id();
      v_warehouse_id := fn_current_user_warehouse_id();
      select shop_id into v_shop_id from profiles where id = auth.uid();
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

  if v_disc < 0 then
    raise exception 'Discount manfi nahi hota.';
  end if;
  if v_disc > v_total then
    raise exception 'Discount bill se zyada nahi ho sakta (bill Rs %, discount Rs %).', v_total, v_disc;
  end if;
  if v_disc > 0 and coalesce(length(trim(p_discount_reason)), 0) < 3 then
    raise exception 'Discount ki wajah likhna zaroori hai.';
  end if;

  v_net := v_total - v_disc;

  insert into pos_sales (
    dealer_id, branch_id, shop_id, customer_id, crm_customer_id,
    payment_mode, total_amount, gross_amount, discount_amount, discount_reason,
    cash_paid, khata_amount, created_by, counter_id, shift_id
  )
  values (
    v_dealer_id, v_branch_id, v_shop_id,
    case when v_dealer_id is not null then p_customer_id else null end,
    case when v_branch_id is not null then p_customer_id else null end,
    p_payment_mode, v_net,
    case when v_disc > 0 then v_total else null end,
    nullif(v_disc, 0),
    case when v_disc > 0 then trim(p_discount_reason) else null end,
    p_cash_paid, p_khata_amount, auth.uid(), p_counter_id, v_shift_id
  )
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_item_qty := (v_item->>'quantity')::numeric;
    v_item_price := (v_item->>'unit_price')::numeric;
    v_item_cogs := 0;
    -- (a) bottle/base units jo stock se nikalne hain
    v_item_units := coalesce(
      public.pos_line_stock_units(v_product_id, v_item_qty, v_item_price, nullif(v_item->>'sale_unit', '')),
      v_item_qty);

    insert into pos_sale_items (sale_id, product_id, quantity, unit_price, subtotal)
    values (v_sale_id, v_product_id, v_item_qty, v_item_price, v_item_qty * v_item_price)
    returning id into v_item_id;

    if v_dealer_id is not null then
      update dealer_inventory
      set stock_quantity = stock_quantity - v_item_qty
      where dealer_id = v_dealer_id and product_id = v_product_id;
    else
      v_remaining := v_item_units;
      for v_batch in
        select id as batch_id, remaining_quantity, unit_cost
        from stock_batches
        where warehouse_id = v_warehouse_id
          and product_id = v_product_id
          and remaining_quantity > 0
        order by created_at asc
        for update
      loop
        exit when v_remaining <= 0;
        v_take := least(v_remaining, v_batch.remaining_quantity);
        update stock_batches set remaining_quantity = remaining_quantity - v_take where id = v_batch.batch_id;
        v_item_cogs := v_item_cogs + (v_take * coalesce(v_batch.unit_cost, 0));
        v_remaining := v_remaining - v_take;
      end loop;

      if v_remaining > 0 then
        v_item_cogs := v_item_cogs + (v_remaining * coalesce((select purchase_price from products where id = v_product_id), 0));
      end if;

      -- (b) zyada stock wali row pehle; zaroorat ho to agli rows se bhi
      v_remaining := v_item_units;
      for v_inv in
        select id, quantity_on_hand
        from inventory
        where warehouse_id = v_warehouse_id and product_id = v_product_id and quantity_on_hand > 0
        order by quantity_on_hand desc, id
        for update
      loop
        exit when v_remaining <= 0;
        v_deducted := least(v_remaining, v_inv.quantity_on_hand);
        insert into stock_movements (inventory_id, movement_type, quantity, balance_after, reference_type, reference_id, created_by)
        values (v_inv.id, 'sale_out', v_deducted, v_inv.quantity_on_hand - v_deducted, 'pos_sale', v_sale_id, auth.uid());
        v_remaining := v_remaining - v_deducted;
      end loop;
    end if;

    update pos_sale_items
       set unit_cost = case when v_item_qty > 0 then v_item_cogs / v_item_qty else 0 end,
           line_cogs = v_item_cogs
     where id = v_item_id;
    v_total_cogs := v_total_cogs + v_item_cogs;
  end loop;

  update pos_sales set total_cogs = v_total_cogs, profit = v_net - v_total_cogs where id = v_sale_id;

  if p_payment_lines is not null then
    for v_pline in select * from jsonb_array_elements(p_payment_lines) loop
      if (v_pline->>'amount')::numeric > 0 then
        insert into pos_sale_payment_details (sale_id, payment_method, amount, transaction_reference, receipt_url)
        values (v_sale_id, v_pline->>'method', (v_pline->>'amount')::numeric, nullif(v_pline->>'reference', ''), nullif(v_pline->>'receipt_url', ''));
      end if;
    end loop;
  end if;

  for v_batch in
    select psd.payment_method, psd.amount, pmam.finance_account_id
    from pos_sale_payment_details psd
    left join payment_method_account_map pmam on pmam.payment_method = psd.payment_method
    where psd.sale_id = v_sale_id and psd.payment_method != 'khata' and psd.amount > 0
  loop
    if v_batch.finance_account_id is not null then
      insert into finance_transactions (account_id, transaction_type, category, amount, transaction_date, notes, created_by)
      values (v_batch.finance_account_id, 'income', 'pos_sale', v_batch.amount, current_date, 'POS sale payment (' || v_batch.payment_method || ')', auth.uid());
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

    if v_dealer_id is null and p_customer_id is not null then
      update customers
      set current_balance = current_balance + p_khata_amount
      where id = p_customer_id;
    end if;
  end if;

  return v_sale_id;
end;
$function$;

-- Duplicate inventory rows (same product + godam) -- consolidate manually after review.
create or replace view public.v_inventory_duplicate_rows
with (security_invoker = true) as
select product_id, warehouse_id, count(*) as row_count, sum(quantity_on_hand) as total_on_hand,
       array_agg(id order by quantity_on_hand desc) as inventory_ids
  from public.inventory
 group by product_id, warehouse_id
having count(*) > 1;

notify pgrst, 'reload schema';
