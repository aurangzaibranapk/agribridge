-- =====================================================================
-- AgriBridge — Migration 630: procurement atomic RPCs
-- =====================================================================
-- 629 COMMIT hone ke BAAD. Apply nahi kiya gaya.
-- Receive ek transaction: status lock 'receiving', phir lines + stock
-- + status received. Dedupe key doosri movement rok-ti hai.
-- Purchase create ek transaction: header + har line, warna kuch nahi.
-- GRN ek transaction: header + items + stock + batch.
-- =====================================================================

create or replace function public.fn_lock_purchase_receiving(p_id uuid)
returns text
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_status public.purchase_status;
  v_review text;
begin
  select status, review_status into v_status, v_review
  from public.purchases
  where id = p_id
  for update;
  if not found then return 'missing'; end if;
  if v_review is distinct from 'approved' then return 'not_approved'; end if;
  if v_status = 'received' then return 'received'; end if;
  if v_status = 'cancelled' then return 'cancelled'; end if;
  if v_status = 'receiving' then return 'resume'; end if;
  if v_status <> 'pending' then return 'blocked'; end if;
  update public.purchases
  set status = 'receiving'
  where id = p_id and status = 'pending';
  return 'locked';
end $$;

create or replace function public.fn_release_purchase_receiving(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  update public.purchases p
  set status = 'pending'
  where p.id = p_id
    and p.status = 'receiving'
    and not exists (
      select 1 from public.stock_movements m
      where m.reference_type = 'purchase'
        and m.reference_id = p_id
        and m.movement_type = 'purchase_in'
    );
end $$;

create or replace function public.fn_commit_purchase_receive(p_id uuid, p_lines jsonb, p_patch jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_status public.purchase_status;
  line jsonb;
  v_item uuid;
  v_qty numeric;
  v_received numeric;
  v_damaged numeric;
  v_short numeric;
  v_batch uuid;
  v_inv uuid;
  v_wh uuid;
begin
  select status into v_status from public.purchases where id = p_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'missing', 'error', 'Purchase not found.'); end if;
  if v_status = 'received' then return jsonb_build_object('ok', false, 'code', 'received'); end if;
  if v_status <> 'receiving' then
    return jsonb_build_object('ok', false, 'code', 'not_receiving', 'error', 'Receive lock nahi laga. Dobara koshish karein.');
  end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Receive lines khali hain';
  end if;

  for line in select value from jsonb_array_elements(p_lines) loop
    v_item := (line->>'item_id')::uuid;
    v_received := coalesce((line->>'received')::numeric, 0);
    v_damaged := coalesce((line->>'damaged')::numeric, 0);
    v_short := coalesce((line->>'short')::numeric, 0);
    select quantity into v_qty from public.purchase_items where id = v_item and purchase_id = p_id for update;
    if v_qty is null then raise exception 'Purchase line nahi mili'; end if;
    if v_received < 0 or v_damaged < 0 or v_short < 0 or v_received + v_damaged + v_short <> v_qty then
      raise exception 'Line ki ginti invoice se nahi milti';
    end if;
    update public.purchase_items
    set received_qty = v_received,
        damaged_qty = v_damaged,
        short_qty = v_short,
        grn_note = nullif(line->>'note', ''),
        line_total = round(v_received * coalesce((line->>'unit_cost')::numeric, unit_cost), 2)
    where id = v_item;

    v_batch := nullif(line->>'batch_id', '')::uuid;
    if v_received <= 0 then
      if v_batch is not null then
        update public.stock_batches
        set initial_quantity = 0, remaining_quantity = 0, unit_cost = coalesce((line->>'stock_unit_cost')::numeric, unit_cost)
        where id = v_batch;
      end if;
      continue;
    end if;

    v_wh := nullif(line->>'warehouse_id', '')::uuid;
    if v_wh is null then raise exception 'Warehouse nahi mila'; end if;

    if v_batch is not null then
      update public.stock_batches
      set warehouse_id = v_wh,
          initial_quantity = v_received,
          remaining_quantity = v_received,
          unit_cost = coalesce((line->>'stock_unit_cost')::numeric, unit_cost),
          dedupe_key = coalesce(dedupe_key, nullif(line->>'batch_dedupe_key', ''))
      where id = v_batch;
    else
      insert into public.stock_batches (product_id, warehouse_id, batch_number, initial_quantity, remaining_quantity, unit_cost, dedupe_key)
      values (
        (line->>'product_id')::uuid,
        v_wh,
        coalesce(nullif(line->>'batch_number', ''), v_item::text),
        v_received,
        v_received,
        coalesce((line->>'stock_unit_cost')::numeric, 0),
        nullif(line->>'batch_dedupe_key', '')
      )
      on conflict (dedupe_key) where dedupe_key is not null do nothing
      returning id into v_batch;
      if v_batch is null then
        select id into v_batch from public.stock_batches where dedupe_key = line->>'batch_dedupe_key';
      end if;
      if v_batch is null then raise exception 'Batch nahi bana'; end if;
      update public.purchase_items set batch_id = v_batch where id = v_item;
    end if;

    select id into v_inv
    from public.inventory
    where product_id = (line->>'product_id')::uuid and warehouse_id = v_wh
    limit 1;
    if v_inv is null then
      insert into public.inventory (product_id, warehouse_id, batch_id, quantity_on_hand)
      values ((line->>'product_id')::uuid, v_wh, v_batch, 0)
      returning id into v_inv;
    elsif v_batch is not null then
      update public.inventory set batch_id = v_batch where id = v_inv and batch_id is null;
    end if;

    insert into public.stock_movements (inventory_id, movement_type, quantity, reference_type, reference_id, notes, created_by, dedupe_key)
    values (
      v_inv,
      'purchase_in',
      v_received,
      'purchase',
      p_id,
      nullif(line->>'movement_note', ''),
      nullif(p_patch->>'received_by', '')::uuid,
      nullif(line->>'dedupe_key', '')
    )
    on conflict (dedupe_key) where dedupe_key is not null do nothing;
  end loop;

  update public.purchases
  set status = 'received',
      invoice_total = coalesce(invoice_total, nullif(p_patch->>'invoice_total', '')::numeric, total_amount),
      total_amount = coalesce(nullif(p_patch->>'total_amount', '')::numeric, total_amount),
      grn_photo_url = coalesce(nullif(p_patch->>'grn_photo_url', ''), grn_photo_url),
      grn_note = coalesce(nullif(p_patch->>'grn_note', ''), grn_note),
      received_at = now(),
      received_by = nullif(p_patch->>'received_by', '')::uuid
  where id = p_id and status = 'receiving';

  return jsonb_build_object('ok', true);
end $$;

create or replace function public.fn_create_purchase_atomic(p_purchase jsonb, p_lines jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  line jsonb;
  v_goods numeric := 0;
  v_n integer := 0;
  v_qty numeric;
  v_cost numeric;
  v_header numeric;
  v_discount numeric;
  v_tax numeric;
  v_net numeric;
  v_held numeric;
  v_id uuid;
  v_batch uuid;
  v_ord integer := 0;
begin
  if jsonb_typeof(p_lines) <> 'array' then raise exception 'Purchase lines khali hain'; end if;
  for line in select value from jsonb_array_elements(p_lines) loop
    v_qty := (line->>'quantity')::numeric;
    v_cost := (line->>'unit_cost')::numeric;
    if v_qty is null or v_qty <= 0 or v_cost is null or v_cost < 0 or nullif(line->>'product_id', '') is null then
      raise exception 'Purchase line invalid';
    end if;
    v_goods := round(v_goods + round(v_qty * v_cost, 2), 2);
    v_n := v_n + 1;
  end loop;
  if v_n = 0 then raise exception 'Purchase needs lines'; end if;
  v_header := (p_purchase->>'total_amount')::numeric;
  v_discount := coalesce((p_purchase->>'discount_amount')::numeric, 0);
  v_tax := coalesce((p_purchase->>'tax_amount')::numeric, 0);
  v_net := round(v_goods - v_discount + v_tax, 2);
  if v_header is null or (abs(v_header - v_goods) > 0.05 and abs(v_header - v_net) > 0.05) then
    raise exception 'purchase total % does not match lines %', v_header, v_goods;
  end if;
  if jsonb_typeof(p_purchase->'held_payment') = 'object' then
    v_held := (p_purchase->'held_payment'->>'amount')::numeric;
    if v_held is not null and v_held > v_header + 0.05 then
      raise exception 'held payment exceeds total';
    end if;
  end if;

  insert into public.purchases (
    purchase_number, supplier_id, branch_id, purchase_date, supplier_bill_no, warehouse_id,
    status, review_status, total_amount, invoice_total, discount_amount, tax_amount, tax_label,
    payment_terms, credit_days, due_date, notes, payment_proof_url, created_by, held_payment, bill_no_key
  ) values (
    p_purchase->>'purchase_number',
    (p_purchase->>'supplier_id')::uuid,
    nullif(p_purchase->>'branch_id', '')::uuid,
    coalesce(nullif(p_purchase->>'purchase_date', '')::date, (now() at time zone 'Asia/Karachi')::date),
    nullif(p_purchase->>'supplier_bill_no', ''),
    nullif(p_purchase->>'warehouse_id', '')::uuid,
    coalesce(nullif(p_purchase->>'status', '')::public.purchase_status, 'pending'),
    coalesce(nullif(p_purchase->>'review_status', ''), 'submitted'),
    v_header,
    nullif(p_purchase->>'invoice_total', '')::numeric,
    nullif(p_purchase->>'discount_amount', '')::numeric,
    nullif(p_purchase->>'tax_amount', '')::numeric,
    nullif(p_purchase->>'tax_label', ''),
    coalesce(nullif(p_purchase->>'payment_terms', ''), 'credit'),
    nullif(p_purchase->>'credit_days', '')::integer,
    nullif(p_purchase->>'due_date', '')::date,
    nullif(p_purchase->>'notes', ''),
    nullif(p_purchase->>'payment_proof_url', ''),
    nullif(p_purchase->>'created_by', '')::uuid,
    case when jsonb_typeof(p_purchase->'held_payment') = 'object' then p_purchase->'held_payment' else null end,
    nullif(p_purchase->>'bill_no_key', '')
  ) returning id into v_id;

  for line in select value from jsonb_array_elements(p_lines) loop
    v_ord := v_ord + 1;
    v_qty := (line->>'quantity')::numeric;
    v_cost := (line->>'unit_cost')::numeric;
    insert into public.stock_batches (product_id, batch_number, manufacture_date, expiry_date, initial_quantity, dedupe_key)
    values (
      (line->>'product_id')::uuid,
      coalesce(nullif(line->>'batch_number', ''), v_id::text || '-' || v_ord::text),
      nullif(line->>'manufacture_date', '')::date,
      nullif(line->>'expiry_date', '')::date,
      v_qty,
      'po-batch:' || v_id::text || ':' || v_ord::text
    ) returning id into v_batch;
    insert into public.purchase_items (purchase_id, product_id, batch_id, quantity, unit_cost, line_total)
    values (v_id, (line->>'product_id')::uuid, v_batch, v_qty, v_cost, round(v_qty * v_cost, 2));
  end loop;

  return jsonb_build_object('ok', true, 'id', v_id, 'lines', v_n);
end $$;

create or replace function public.fn_create_agri_grn_atomic(p_grn jsonb, p_items jsonb, p_stock jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  item jsonb;
  row jsonb;
  v_inv uuid;
  v_batch uuid;
begin
  if exists (select 1 from public.agri_grns where order_id = (p_grn->>'order_id')::uuid) then
    return jsonb_build_object('ok', false, 'code', 'exists', 'error', 'Is order ki GRN pehle se hai — dobara stock nahi barhega.');
  end if;

  insert into public.agri_grns (
    grn_number, order_id, dispatch_id, receiving_date, ordered_value, received_value,
    shortage_amount, damage_amount, discount_adjustment, additional_charges, payable_amount,
    notes, discrepancy_status, created_by
  ) values (
    p_grn->>'grn_number',
    (p_grn->>'order_id')::uuid,
    nullif(p_grn->>'dispatch_id', '')::uuid,
    (p_grn->>'receiving_date')::date,
    coalesce((p_grn->>'ordered_value')::numeric, 0),
    coalesce((p_grn->>'received_value')::numeric, 0),
    coalesce((p_grn->>'shortage_amount')::numeric, 0),
    coalesce((p_grn->>'damage_amount')::numeric, 0),
    coalesce((p_grn->>'discount_adjustment')::numeric, 0),
    coalesce((p_grn->>'additional_charges')::numeric, 0),
    coalesce((p_grn->>'payable_amount')::numeric, 0),
    nullif(p_grn->>'notes', ''),
    coalesce(nullif(p_grn->>'discrepancy_status', ''), 'none'),
    nullif(p_grn->>'created_by', '')::uuid
  ) returning id into v_id;

  for item in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    insert into public.agri_grn_items (
      grn_id, order_item_id, product_name, batch_no, expiry_date, manufacturing_date, unit_price,
      ordered_qty, received_qty, damaged_qty, difference_qty, difference_type, seal_condition,
      packaging_condition, quality_status, rejection_reason
    ) values (
      v_id,
      nullif(item->>'order_item_id', '')::uuid,
      item->>'product_name',
      nullif(item->>'batch_no', ''),
      nullif(item->>'expiry_date', '')::date,
      nullif(item->>'manufacturing_date', '')::date,
      coalesce((item->>'unit_price')::numeric, 0),
      coalesce((item->>'ordered_qty')::numeric, 0),
      coalesce((item->>'received_qty')::numeric, 0),
      coalesce((item->>'damaged_qty')::numeric, 0),
      coalesce((item->>'difference_qty')::numeric, 0),
      coalesce(nullif(item->>'difference_type', ''), 'None'),
      nullif(item->>'seal_condition', ''),
      nullif(item->>'packaging_condition', ''),
      coalesce(nullif(item->>'quality_status', ''), 'Accepted'),
      nullif(item->>'rejection_reason', '')
    );
  end loop;

  for row in select value from jsonb_array_elements(coalesce(p_stock, '[]'::jsonb)) loop
    if coalesce((row->>'quantity')::numeric, 0) <= 0 then continue; end if;
    if nullif(row->>'product_id', '') is null or nullif(row->>'warehouse_id', '') is null then continue; end if;

    select id into v_inv
    from public.inventory
    where product_id = (row->>'product_id')::uuid and warehouse_id = (row->>'warehouse_id')::uuid
    limit 1;
    if v_inv is null then
      insert into public.inventory (product_id, warehouse_id, quantity_on_hand)
      values ((row->>'product_id')::uuid, (row->>'warehouse_id')::uuid, 0)
      returning id into v_inv;
    end if;

    insert into public.stock_movements (inventory_id, movement_type, quantity, reference_type, reference_id, created_by, dedupe_key)
    values (
      v_inv,
      'purchase_in',
      (row->>'quantity')::numeric,
      'agri_grn',
      (row->>'reference_id')::uuid,
      nullif(row->>'created_by', '')::uuid,
      nullif(row->>'dedupe_key', '')
    )
    on conflict (dedupe_key) where dedupe_key is not null do nothing;

    insert into public.stock_batches (
      product_id, warehouse_id, batch_number, expiry_date, manufacture_date,
      initial_quantity, remaining_quantity, unit_cost, dedupe_key
    ) values (
      (row->>'product_id')::uuid,
      (row->>'warehouse_id')::uuid,
      coalesce(nullif(row->>'batch_number', ''), 'GRN-' || v_id::text),
      nullif(row->>'expiry_date', '')::date,
      nullif(row->>'manufacturing_date', '')::date,
      (row->>'quantity')::numeric,
      (row->>'quantity')::numeric,
      coalesce((row->>'unit_cost')::numeric, 0),
      nullif(row->>'batch_dedupe_key', '')
    )
    on conflict (dedupe_key) where dedupe_key is not null do nothing
    returning id into v_batch;

    if v_batch is not null then
      update public.inventory set batch_id = v_batch where id = v_inv and batch_id is null;
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

revoke all on function public.fn_lock_purchase_receiving(uuid) from public, anon;
revoke all on function public.fn_release_purchase_receiving(uuid) from public, anon;
revoke all on function public.fn_commit_purchase_receive(uuid, jsonb, jsonb) from public, anon;
revoke all on function public.fn_create_purchase_atomic(jsonb, jsonb) from public, anon;
revoke all on function public.fn_create_agri_grn_atomic(jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.fn_lock_purchase_receiving(uuid) to authenticated, service_role;
grant execute on function public.fn_release_purchase_receiving(uuid) to authenticated, service_role;
grant execute on function public.fn_commit_purchase_receive(uuid, jsonb, jsonb) to authenticated, service_role;
grant execute on function public.fn_create_purchase_atomic(jsonb, jsonb) to authenticated, service_role;
grant execute on function public.fn_create_agri_grn_atomic(jsonb, jsonb, jsonb) to authenticated, service_role;
