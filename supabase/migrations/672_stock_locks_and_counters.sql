-- 672: Adjustment aur stock-count par qatal, number sequence, dispatch ek order.
-- Koi purana row rewrite nahi.

create unique index if not exists grain_sale_counters_year_uidx on public.grain_sale_counters (year);
create unique index if not exists stock_loss_counters_year_uidx on public.stock_loss_counters (year);
create unique index if not exists agri_dispatch_counters_year_uidx on public.agri_dispatch_counters (year);

create or replace function public.fn_next_year_counter(p_table text, p_year int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next int;
  v_table text;
begin
  if p_table in (
    'pos_deposit_counters', 'pos_shift_counters', 'agri_order_counters',
    'agri_payment_counters', 'agri_return_counters',
    'grain_sale_counters', 'stock_loss_counters', 'agri_dispatch_counters'
  ) then
    v_table := p_table;
  elsif p_table = 'grain_sale' then
    v_table := 'grain_sale_counters';
  elsif p_table = 'stock_loss' then
    v_table := 'stock_loss_counters';
  elsif p_table = 'agri_dispatch' then
    v_table := 'agri_dispatch_counters';
  else
    raise exception 'Counter table not allowed.';
  end if;
  if p_year is null or p_year < 0 or p_year > 99 then
    raise exception 'Counter year is wrong.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('counter:' || v_table || ':' || p_year::text, 0));
  execute format(
    'insert into public.%I as c (year, last_number) values ($1, 1)
     on conflict (year) do update set last_number = c.last_number + 1
     returning last_number',
    v_table
  ) into v_next using p_year;
  return v_next;
end $$;

revoke all on function public.fn_next_year_counter(text, int) from public, anon, authenticated;
grant execute on function public.fn_next_year_counter(text, int) to service_role;

do $$
begin
  if to_regclass('public.agri_dispatches') is null then
    return;
  end if;
  if exists (
    select 1 from public.agri_dispatches
     where order_id is not null
     group by order_id
    having count(*) > 1
  ) then
    raise notice 'agri_dispatches par duplicate order_id hai. Unique index nahi bani. Dekho docs/NEEDS-OWNER-APPROVAL-660.md';
  elsif not exists (
    select 1 from pg_indexes where schemaname = 'public' and indexname = 'agri_dispatches_order_uidx'
  ) then
    create unique index agri_dispatches_order_uidx on public.agri_dispatches (order_id);
  end if;
end $$;

alter table public.stock_counts add column if not exists post_lock uuid;
alter table public.stock_counts add column if not exists post_lock_at timestamptz;

create or replace function public.fn_claim_stock_count_post(p_count uuid, p_actor uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.stock_counts;
  v_actor uuid := coalesce(auth.uid(), p_actor);
begin
  if v_actor is null then
    raise exception 'Ijazat nahi.';
  end if;
  if auth.uid() is not null and p_actor is not null and auth.uid() is distinct from p_actor then
    raise exception 'Actor match nahi karta.';
  end if;
  select * into r from public.stock_counts where id = p_count for update;
  if not found then
    raise exception 'Ginti nahi mili.';
  end if;
  if r.status = 'posted' then
    return 'already';
  end if;
  if r.status not in ('verified', 'counting') then
    raise exception 'Ye ginti post ke qabil nahi.';
  end if;
  if r.post_lock is not null
     and r.post_lock is distinct from v_actor
     and coalesce(r.post_lock_at, now()) > now() - interval '10 minutes' then
    raise exception 'Ginti pehle se post ho rahi hai.';
  end if;
  update public.stock_counts
     set post_lock = v_actor, post_lock_at = now()
   where id = p_count;
  return 'claimed';
end $$;

create or replace function public.fn_release_stock_count_post(p_count uuid, p_actor uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := coalesce(auth.uid(), p_actor);
begin
  update public.stock_counts
     set post_lock = null, post_lock_at = null
   where id = p_count
     and status is distinct from 'posted'
     and post_lock = v_actor;
end $$;

revoke all on function public.fn_claim_stock_count_post(uuid, uuid) from public, anon;
revoke all on function public.fn_release_stock_count_post(uuid, uuid) from public, anon;
grant execute on function public.fn_claim_stock_count_post(uuid, uuid) to authenticated, service_role;
grant execute on function public.fn_release_stock_count_post(uuid, uuid) to authenticated, service_role;

create or replace function public.fn_record_stock_out(
  p_warehouse uuid,
  p_product uuid,
  p_qty numeric,
  p_movement text,
  p_reference_type text,
  p_reference_id uuid,
  p_actor uuid,
  p_allow_expired boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv uuid;
  v_move uuid;
  v_cost numeric := 0;
  v_row record;
begin
  if p_actor is null and auth.uid() is null then
    raise exception 'Ijazat nahi.';
  end if;
  if not public.fn_warehouse_in_scope(coalesce(auth.uid(), p_actor), p_warehouse) then
    raise exception 'Ye godam aap ke scope se bahar hai.';
  end if;
  if p_allow_expired and p_movement not in ('expired_out', 'damaged_out') then
    raise exception 'Expire batch sirf expiry ya damage ke raaste se nikal sakti hai.';
  end if;
  select id into v_inv
    from public.inventory
   where warehouse_id = p_warehouse and product_id = p_product
   order by quantity_on_hand desc
   limit 1
   for update;
  if v_inv is null then
    raise exception 'Stock record nahi mila.';
  end if;
  insert into public.stock_movements (
    inventory_id, movement_type, quantity, reference_type, reference_id, created_by
  ) values (
    v_inv, p_movement, p_qty, p_reference_type, p_reference_id, coalesce(auth.uid(), p_actor)
  ) returning id into v_move;
  for v_row in
    select * from public.fn_consume_sellable_fifo(
      p_warehouse, p_product, p_qty,
      p_allow_expired and public.fn_jwt_is_service(),
      coalesce(auth.uid(), p_actor),
      p_reference_type, p_reference_id
    )
  loop
    v_cost := v_cost + (v_row.taken * coalesce(v_row.unit_cost, 0));
  end loop;
  return jsonb_build_object('movement_id', v_move, 'cost', round(v_cost, 2), 'inventory_id', v_inv);
end $$;

revoke all on function public.fn_record_stock_out(uuid, uuid, numeric, text, text, uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.fn_record_stock_out(uuid, uuid, numeric, text, text, uuid, uuid, boolean) to service_role;

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
