-- Mobile orders are requests for staff review. No payment, credit or inventory
-- ledger is posted by this function. A credit order needs its own verified
-- customer identity and approval workflow, so this endpoint rejects it.

drop policy if exists mobile_read_own_agri_orders on public.agri_orders;
create policy mobile_read_own_agri_orders on public.agri_orders
  for select to authenticated using (requested_by = (select auth.uid()));

drop policy if exists mobile_read_own_agri_order_items on public.agri_order_items;
create policy mobile_read_own_agri_order_items on public.agri_order_items
  for select to authenticated using (
    exists (select 1 from public.agri_orders o
            where o.id = order_id and o.requested_by = (select auth.uid()))
  );

drop policy if exists mobile_read_own_agri_order_timeline on public.agri_order_timeline;
create policy mobile_read_own_agri_order_timeline on public.agri_order_timeline
  for select to authenticated using (
    exists (select 1 from public.agri_orders o
            where o.id = order_id and o.requested_by = (select auth.uid()))
  );

create or replace function public.mobile_submit_agri_order(
  p_items jsonb,
  p_payment_terms text default 'Cash',
  p_notes text default null
) returns uuid
language plpgsql security definer set search_path = ''
as $function$
declare
  v_user public.profiles%rowtype;
  v_farmer public.farmers%rowtype;
  v_product public.products%rowtype;
  v_item jsonb;
  v_id uuid;
  v_product_id uuid;
  v_quantity numeric;
  v_subtotal numeric := 0;
  v_seen uuid[] := '{}';
begin
  if auth.uid() is null then raise exception 'Login required'; end if;
  select * into v_user from public.profiles
    where id = auth.uid() and is_active;
  if not found then raise exception 'Active profile required'; end if;
  select * into v_farmer from public.farmers
    where user_id = v_user.id and organization_id = v_user.organization_id
      and is_active and not is_deleted limit 1;
  if not found then raise exception 'Linked farmer profile required'; end if;
  if p_payment_terms not in ('Cash','Bank Transfer','Advance Payment') then
    raise exception 'Khata payment requires verified customer link and staff approval';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) not between 1 and 30 then
    raise exception 'Order must have 1 to 30 items';
  end if;

  -- Validate the entire cart and server prices before any order insert.
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    begin
      v_product_id := (v_item->>'product_id')::uuid;
      v_quantity := (v_item->>'quantity')::numeric;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'Invalid product or quantity';
    end;
    if v_product_id is null or v_quantity is null
       or v_quantity <= 0 or v_quantity > 1000 or v_quantity <> trunc(v_quantity) then
      raise exception 'Invalid product or quantity';
    end if;
    if v_product_id = any(v_seen) then raise exception 'Duplicate product in order'; end if;
    v_seen := array_append(v_seen, v_product_id);
    select * into v_product from public.products
      where id = v_product_id and organization_id = v_user.organization_id
        and is_available and not is_deleted and is_verified
        and selling_price > 0
        and (expiry_date is null or expiry_date >= current_date)
      for share;
    if not found then raise exception 'Product unavailable or expired'; end if;
    v_subtotal := v_subtotal + v_product.selling_price * v_quantity;
    if v_subtotal > 10000000 then raise exception 'Order total exceeds mobile limit'; end if;
  end loop;

  insert into public.agri_orders
    (order_number,order_type,order_from,order_to_type,order_to_branch_id,
     partner_name,subtotal,grand_total,payment_terms,status,requested_by,notes)
  values
    ('MOB-' || upper(replace(gen_random_uuid()::text,'-','')),
     'FMCG / Other','AgriBridge Mobile','Farmer',v_user.branch_id,
     v_farmer.full_name,v_subtotal,v_subtotal,p_payment_terms,'submitted',
     v_user.id,nullif(left(trim(coalesce(p_notes,'')),500),''))
  returning id into v_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity := (v_item->>'quantity')::numeric;
    select * into v_product from public.products where id = v_product_id;
    insert into public.agri_order_items
      (order_id,product_id,product_name,pack_size,order_qty,unit_price,net_price,line_total)
    values
      (v_id,v_product.id,v_product.name,v_product.pack_size,v_quantity,
       v_product.selling_price,v_product.selling_price,v_product.selling_price * v_quantity);
  end loop;
  insert into public.agri_order_timeline(order_id,status,note,created_by)
    values(v_id,'submitted','Mobile request; payment and stock await staff verification',v_user.id);
  return v_id;
end;
$function$;

revoke all on function public.mobile_submit_agri_order(jsonb,text,text) from public;
revoke all on function public.mobile_submit_agri_order(jsonb,text,text) from anon;
grant execute on function public.mobile_submit_agri_order(jsonb,text,text) to authenticated;

notify pgrst, 'reload schema';
