-- 695 rollback: restore fn_adjust_stock body from migration 672 (pre-fix).
create or replace function public.fn_adjust_stock(
  p_inventory uuid,
  p_direction text,
  p_qty numeric,
  p_actor uuid,
  p_notes text default null,
  p_client_action text default null,
  p_unit_cost numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.inventory;
  v_actor uuid := coalesce(auth.uid(), p_actor);
  v_move uuid;
  v_cost numeric := 0;
  v_row record;
  v_existing uuid;
begin
  if v_actor is null then
    raise exception 'Ijazat nahi.';
  end if;
  if not exists (
    select 1 from public.profiles p
     where p.id = v_actor and coalesce(p.is_active, true)
       and p.role::text in ('owner', 'super_admin', 'admin', 'warehouse')
  ) then
    raise exception 'Stock badalna sirf Owner, Admin ya Warehouse kar sakta hai.';
  end if;
  if p_direction not in ('increase', 'decrease') then
    raise exception 'Direction ghalat hai.';
  end if;
  if p_qty is null or p_qty <= 0 then
    raise exception 'Miqdar sifar se zyada honi chahiye.';
  end if;
  if p_client_action is not null then
    select id into v_existing from public.stock_movements where client_action_id = p_client_action limit 1;
    if v_existing is not null then
      return jsonb_build_object('movement_id', v_existing, 'already', true, 'cost', 0);
    end if;
  end if;
  select * into v_inv from public.inventory where id = p_inventory for update;
  if not found then
    raise exception 'Inventory row nahi mila.';
  end if;
  if not public.fn_warehouse_in_scope(v_actor, v_inv.warehouse_id) then
    raise exception 'Ye godam aap ke scope se bahar hai.';
  end if;
  if p_direction = 'decrease' and coalesce(v_inv.quantity_on_hand, 0) < p_qty then
    raise exception 'Itna stock nahi — abhi sirf % hai.', v_inv.quantity_on_hand;
  end if;
  insert into public.stock_movements (
    inventory_id, movement_type, quantity, reference_type, notes, created_by, client_action_id
  ) values (
    p_inventory,
    case when p_direction = 'increase' then 'adjustment_increase' else 'adjustment_decrease' end,
    p_qty, 'manual_adjustment', p_notes, v_actor, p_client_action
  ) returning id into v_move;
  if p_direction = 'increase' then
    if coalesce(p_unit_cost, 0) <= 0 then
      raise exception 'Stock barhane ke liye khareed rate (lagat) likhein.';
    end if;
    insert into public.stock_batches (
      product_id, warehouse_id, batch_number, initial_quantity, remaining_quantity, unit_cost
    ) values (
      v_inv.product_id, v_inv.warehouse_id,
      'ADJ-' || to_char(now(), 'YYYYMMDDHH24MISS'),
      p_qty, p_qty, p_unit_cost
    );
    v_cost := p_qty * p_unit_cost;
  else
    for v_row in
      select * from public.fn_consume_sellable_fifo(
        v_inv.warehouse_id, v_inv.product_id, p_qty, false, v_actor, 'manual_adjustment', v_move
      )
    loop
      v_cost := v_cost + (v_row.taken * coalesce(v_row.unit_cost, 0));
    end loop;
  end if;
  return jsonb_build_object('movement_id', v_move, 'cost', round(v_cost, 2), 'already', false);
end $$;

revoke all on function public.fn_adjust_stock(uuid, text, numeric, uuid, text, text, numeric) from public, anon, authenticated;
grant execute on function public.fn_adjust_stock(uuid, text, numeric, uuid, text, text, numeric) to service_role;
