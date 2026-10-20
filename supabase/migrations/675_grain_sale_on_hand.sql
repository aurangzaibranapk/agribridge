-- 675: Anaj ki rok khareed-ka-jorh nahi. Godam ki locked ginti hai.
-- Owner/Admin purani bikri ki miqdar kam kar sakein (correction).
-- Nayi bikri: sale + batch + movement + cost/profit ek transaction.
-- 664 wala sold>bought guard yahan replace ho jata hai.
-- 24,500 kg phantom aur OPENING-OWN-20261016 is file mein NAHI chalte.
-- Sirf label. total_amount nahi badalta. Purani file ne legacy_as_stored likha ho to per_kg.
update public.grain_sales
   set rate_unit = 'per_kg'
 where rate_unit = 'legacy_as_stored';

create or replace function public.fn_guard_grain_sale_qty()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_product uuid;
  v_on numeric;
  v_need numeric;
  v_hq boolean;
begin
  if tg_op = 'UPDATE' and new.quantity_kg is not distinct from old.quantity_kg
     and new.warehouse_id is not distinct from old.warehouse_id then
    return new;
  end if;

  v_hq := exists (
    select 1 from public.profiles p
     where p.id = auth.uid() and coalesce(p.is_active, true)
       and p.role::text in ('owner', 'super_admin', 'admin')
  );

  if tg_op = 'UPDATE' and coalesce(new.quantity_kg, 0) <= coalesce(old.quantity_kg, 0) and v_hq then
    return new;
  end if;

  select product_id into v_product
    from public.grain_type_products
   where grain_type = new.grain_type
   limit 1;

  if new.warehouse_id is null or v_product is null then
    raise exception 'Anaj ki bikri ke liye godam aur product zaroori hain.';
  end if;

  select quantity_on_hand into v_on
    from public.inventory
   where warehouse_id = new.warehouse_id
     and product_id = v_product
   for update;
  if not found then
    v_on := 0;
  end if;

  if tg_op = 'UPDATE' then
    v_need := coalesce(new.quantity_kg, 0) - coalesce(old.quantity_kg, 0);
  else
    v_need := coalesce(new.quantity_kg, 0);
  end if;

  if v_need > coalesce(v_on, 0) + 0.001 then
    raise exception 'Is godam mein itna anaj nahi (maujood % kg, darkar % kg).',
      round(coalesce(v_on, 0), 3), round(v_need, 3);
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_grain_sale_qty on public.grain_sales;
create trigger trg_guard_grain_sale_qty
  before insert or update of quantity_kg, warehouse_id, grain_type on public.grain_sales
  for each row execute function public.fn_guard_grain_sale_qty();

create or replace function public.fn_post_grain_sale(
  p_buyer uuid,
  p_customer uuid,
  p_grain_type text,
  p_warehouse uuid,
  p_product uuid,
  p_qty numeric,
  p_rate numeric,
  p_total numeric,
  p_delivery text,
  p_bardana numeric,
  p_mazdoori numeric,
  p_sale_date date,
  p_notes text,
  p_actor uuid,
  p_draft uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := coalesce(auth.uid(), p_actor);
  v_id uuid;
  v_number text;
  v_year int := extract(year from now())::int % 100;
  v_seq int;
  v_cost numeric := 0;
  v_row record;
  v_inv uuid;
  v_profit numeric;
begin
  if v_actor is null then
    raise exception 'Ijazat nahi.';
  end if;
  if auth.uid() is not null and p_actor is distinct from auth.uid() then
    raise exception 'Actor match nahi karta.';
  end if;
  if p_qty is null or p_qty <= 0 then
    raise exception 'Miqdar sifar se zyada honi chahiye.';
  end if;
  if p_rate is null or p_rate < 1000 or p_rate > 20000 then
    raise exception 'Rate fi mand 1,000 se 20,000 ke darmiyan honi chahiye.';
  end if;
  if not public.fn_warehouse_in_scope(v_actor, p_warehouse) then
    raise exception 'Ye godam aap ke scope se bahar hai.';
  end if;

  select id into v_inv
    from public.inventory
   where warehouse_id = p_warehouse and product_id = p_product
   for update;
  if v_inv is null then
    raise exception 'Is godam mein is anaj ka stock record nahi.';
  end if;

  v_seq := public.fn_next_year_counter('grain_sale', v_year);
  v_number := 'GRN-SALE-' || v_year::text || '-' || lpad(v_seq::text, 5, '0');

  insert into public.grain_sales (
    sale_number, buyer_id, customer_id, grain_type, warehouse_id,
    quantity_kg, rate_per_kg, rate_unit, total_amount, total_cogs,
    delivery_term, bardana_cost, mazdoori_cost, profit, sale_date, notes, created_by, draft_id
  ) values (
    v_number, p_buyer, p_customer, p_grain_type, p_warehouse,
    p_qty, p_rate, 'per_maund', p_total, 0,
    p_delivery, coalesce(p_bardana, 0), coalesce(p_mazdoori, 0),
    p_total - coalesce(p_bardana, 0) - coalesce(p_mazdoori, 0),
    p_sale_date, p_notes, v_actor, p_draft
  ) returning id into v_id;

  perform set_config('agribridge.trusted_stock', 'on', true);
  for v_row in
    select * from public.fn_consume_sellable_fifo(
      p_warehouse, p_product, p_qty, false, v_actor, 'grain_sale', v_id
    )
  loop
    v_cost := v_cost + (v_row.taken * coalesce(v_row.unit_cost, 0));
  end loop;
  perform set_config('agribridge.trusted_stock', 'off', true);

  v_profit := p_total - v_cost - coalesce(p_bardana, 0) - coalesce(p_mazdoori, 0);
  update public.grain_sales
     set total_cogs = round(v_cost, 2), profit = round(v_profit, 2)
   where id = v_id;

  insert into public.stock_movements (
    inventory_id, movement_type, quantity, reference_type, reference_id, created_by
  ) values (
    v_inv, 'sale_out', p_qty, 'grain_sale', v_id, v_actor
  );

  return jsonb_build_object(
    'id', v_id,
    'sale_number', v_number,
    'cost', round(v_cost, 2),
    'profit', round(v_profit, 2)
  );
end $$;

revoke all on function public.fn_post_grain_sale(uuid, uuid, text, uuid, uuid, numeric, numeric, numeric, text, numeric, numeric, date, text, uuid, uuid) from public, anon;
grant execute on function public.fn_post_grain_sale(uuid, uuid, text, uuid, uuid, numeric, numeric, numeric, text, numeric, numeric, date, text, uuid, uuid) to authenticated, service_role;
