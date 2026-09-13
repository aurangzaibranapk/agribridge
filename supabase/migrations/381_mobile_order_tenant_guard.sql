-- Mobile orders must never accept a product belonging to another organization.

create or replace function public.mobile_submit_agri_order(
  p_items jsonb,
  p_payment_terms text default 'Cash',
  p_notes text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user profiles%rowtype;
  v_order_id uuid;
  v_order_number text;
  v_item jsonb;
  v_product products%rowtype;
  v_quantity numeric;
  v_subtotal numeric := 0;
  v_payment text;
begin
  if auth.uid() is null then raise exception 'Login required'; end if;
  select * into v_user from profiles where id = auth.uid() and is_active = true;
  if not found then raise exception 'Active profile required'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Order must contain at least one item'; end if;
  if jsonb_array_length(p_items) > 100 then raise exception 'Too many order items'; end if;

  v_payment := case p_payment_terms
    when 'Bank Transfer' then 'Bank Transfer'
    when 'Credit' then 'Credit'
    when 'Advance Payment' then 'Advance Payment'
    when 'Partial Payment' then 'Partial Payment'
    else 'Cash'
  end;
  v_order_number := 'MOB-' || to_char(clock_timestamp(), 'YYYYMMDD-HH24MISS') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into agri_orders (
    order_number, order_type, order_from, order_to_type, order_to_branch_id,
    subtotal, grand_total, payment_terms, status, requested_by, notes
  ) values (
    v_order_number, 'FMCG / Other', 'AgriBridge Mobile',
    case
      when v_user.role::text in ('farmer','kisan') then 'Farmer'
      when v_user.role::text in ('dealer','agri_dealer') then 'Agri Dealer'
      else 'Branch'
    end,
    v_user.branch_id, 0, 0, v_payment, 'submitted', v_user.id,
    nullif(left(trim(coalesce(p_notes, '')), 500), '')
  ) returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    begin
      v_quantity := (v_item->>'quantity')::numeric;
    exception when others then
      raise exception 'Invalid quantity';
    end;
    if v_quantity <= 0 or v_quantity > 100000 then raise exception 'Invalid quantity'; end if;

    select * into v_product from products
      where id = (v_item->>'product_id')::uuid
        and organization_id = v_user.organization_id
        and is_available = true and is_deleted = false;
    if not found then raise exception 'Product unavailable'; end if;

    insert into agri_order_items (
      order_id, product_id, product_name, pack_size, order_qty, unit_price,
      net_price, line_total, available_stock_snapshot
    ) values (
      v_order_id, v_product.id, v_product.name, v_product.pack_size, v_quantity,
      v_product.selling_price, v_product.selling_price,
      v_product.selling_price * v_quantity, null
    );
    v_subtotal := v_subtotal + (v_product.selling_price * v_quantity);
  end loop;

  update agri_orders set subtotal = v_subtotal, grand_total = v_subtotal where id = v_order_id;
  insert into agri_order_timeline(order_id, status, note, created_by)
    values (v_order_id, 'submitted', 'Submitted from AgriBridge mobile app', v_user.id);
  return v_order_id;
end;
$$;

revoke all on function public.mobile_submit_agri_order(jsonb, text, text) from public;
grant execute on function public.mobile_submit_agri_order(jsonb, text, text) to authenticated;

notify pgrst, 'reload schema';
