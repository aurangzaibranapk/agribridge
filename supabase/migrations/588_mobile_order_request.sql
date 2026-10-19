-- 588: Mobile se order DARKHWAST (safe checkout).
-- Port of testing 378 + 381 + 20261010165000 (aakhri, sab se mehfooz shakal).
--  * Qeemat server products se parhta hai; app total nahi bhej sakti.
--  * Koi paisa, khata, ya stock entry nahi -- status 'submitted' aur staff
--    ki tasdeeq (sales -> finance -> approve, purana flow + SOD trigger).
--  * Khata/udhaar (Credit) mobile se mana -- us ke liye staff ki manzoori.
--  * Sirf apni organization ki verified, qeemat wali, bina expiry cheezein.
--  * Ek ghante mein 10 order tak (spam rok).
--  * Kisan apna hi order parh sakta hai (requested_by = auth.uid()).
-- Sirf additive. Live par sirf owner ki manzoori ke baad.

drop policy if exists mobile_read_own_agri_orders on public.agri_orders;
create policy mobile_read_own_agri_orders on public.agri_orders
  for select to authenticated using (requested_by = (select auth.uid()));

drop policy if exists mobile_read_own_agri_order_items on public.agri_order_items;
create policy mobile_read_own_agri_order_items on public.agri_order_items
  for select to authenticated using (
    exists (select 1 from public.agri_orders o
             where o.id = agri_order_items.order_id and o.requested_by = (select auth.uid())));

drop policy if exists mobile_read_own_agri_order_timeline on public.agri_order_timeline;
create policy mobile_read_own_agri_order_timeline on public.agri_order_timeline
  for select to authenticated using (
    exists (select 1 from public.agri_orders o
             where o.id = agri_order_timeline.order_id and o.requested_by = (select auth.uid())));

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
  v_today date := (now() at time zone 'Asia/Karachi')::date;
begin
  if auth.uid() is null then raise exception 'Login zaroori hai'; end if;
  select * into v_user from public.profiles where id = auth.uid() and coalesce(is_active, true);
  if not found then raise exception 'Active profile zaroori hai'; end if;
  select * into v_farmer from public.farmers
   where user_id = v_user.id and organization_id is not distinct from v_user.organization_id
     and coalesce(is_active, true) and not coalesce(is_deleted, false)
   order by created_at nulls last limit 1;
  if not found then raise exception 'Kisan profile jura hona zaroori hai'; end if;
  if coalesce(p_payment_terms, 'Cash') not in ('Cash', 'Bank Transfer', 'Advance Payment') then
    raise exception 'Khata/udhaar order ke liye staff ki manzoori chahiye; mobile se sirf Cash, Bank Transfer ya Advance';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 30 then
    raise exception 'Order mein 1 se 30 cheezein';
  end if;
  if (select count(*) from public.agri_orders o
       where o.requested_by = v_user.id and o.order_from = 'AgriBridge Mobile'
         and o.created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Ek ghante mein 10 se zyada mobile order nahi';
  end if;

  -- Poora cart aur server ki qeematein pehle check, phir insert.
  for v_item in select value from jsonb_array_elements(p_items) loop
    begin
      v_product_id := (v_item->>'product_id')::uuid;
      v_quantity := (v_item->>'quantity')::numeric;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'Cheez ya tadaad durust nahi';
    end;
    if v_product_id is null or v_quantity is null or v_quantity <= 0 or v_quantity > 1000
       or v_quantity <> trunc(v_quantity) then
      raise exception 'Cheez ya tadaad durust nahi';
    end if;
    if v_product_id = any(v_seen) then raise exception 'Ek cheez order mein do dafa'; end if;
    v_seen := array_append(v_seen, v_product_id);
    select * into v_product from public.products
     where id = v_product_id and organization_id = v_user.organization_id
       and coalesce(is_available, false) and not coalesce(is_deleted, false) and coalesce(is_verified, false)
       and coalesce(selling_price, 0) > 0 and (expiry_date is null or expiry_date >= v_today);
    if not found then raise exception 'Cheez dastiyab nahi ya expiry guzar chuki'; end if;
    v_subtotal := v_subtotal + v_product.selling_price * v_quantity;
    if v_subtotal > 10000000 then raise exception 'Mobile order ki had (1 crore) se zyada'; end if;
  end loop;

  insert into public.agri_orders
    (order_number, order_type, order_from, order_to_type, order_to_branch_id,
     partner_name, mobile_number, subtotal, grand_total, payment_terms, status,
     requested_by, notes, party_link_state)
  values
    ('MOB-' || upper(replace(gen_random_uuid()::text, '-', '')),
     'FMCG / Other', 'AgriBridge Mobile', 'Farmer', coalesce(v_user.branch_id, v_farmer.branch_id),
     v_farmer.full_name, v_farmer.phone_number, v_subtotal, v_subtotal, coalesce(p_payment_terms, 'Cash'), 'submitted',
     v_user.id, nullif(left(trim(coalesce(p_notes, '')), 500), ''), 'unlinked_unknown')
  returning id into v_id;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity := (v_item->>'quantity')::numeric;
    select * into v_product from public.products where id = v_product_id;
    insert into public.agri_order_items
      (order_id, product_id, product_name, pack_size, order_qty, unit_price, net_price, line_total)
    values
      (v_id, v_product.id, v_product.name, v_product.pack_size, v_quantity,
       v_product.selling_price, v_product.selling_price, v_product.selling_price * v_quantity);
  end loop;
  insert into public.agri_order_timeline (order_id, status, note, created_by)
  values (v_id, 'submitted', 'Mobile darkhwast; paisa aur stock staff ki tasdeeq ke baad', v_user.id);
  return v_id;
end;
$function$;
revoke all on function public.mobile_submit_agri_order(jsonb, text, text) from public, anon;
grant execute on function public.mobile_submit_agri_order(jsonb, text, text) to authenticated;

notify pgrst, 'reload schema';
