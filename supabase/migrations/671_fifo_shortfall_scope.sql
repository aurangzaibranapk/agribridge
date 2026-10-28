-- 671: Batch consume shortfall par bikri nahi rukti.
-- Jo sehat-mand batch maujood hai wo lock karke nikalti hai.
-- Jo na nikle (expire, remaining>initial, ya batch hi kam) wo
-- stock_batch_shortfalls mein likha jata hai. 42 bigri hui batches
-- yahan rewrite nahi hotin.
-- Authenticated seedha nahi chala sakta. Sirf service_role,
-- ya koi SECURITY DEFINER function jo scope check ke baad bulaye.
-- p_allow_expired sirf service_role (trusted) par manzoor.

create table if not exists public.stock_batch_shortfalls (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid,
  product_id uuid,
  requested_qty numeric not null,
  taken_qty numeric not null,
  short_qty numeric not null,
  reason text not null,
  reference_type text,
  reference_id uuid,
  created_by uuid,
  created_at timestamptz not null default now()
);

alter table public.stock_batch_shortfalls enable row level security;
drop policy if exists stock_batch_shortfalls_staff_read on public.stock_batch_shortfalls;
create policy stock_batch_shortfalls_staff_read on public.stock_batch_shortfalls
  for select to authenticated using (public.fn_is_any_staff());

create table if not exists public.stock_batch_consumptions (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid,
  warehouse_id uuid,
  product_id uuid,
  taken numeric not null,
  reference_type text,
  reference_id uuid,
  created_at timestamptz not null default now()
);

alter table public.stock_batch_consumptions enable row level security;
drop policy if exists stock_batch_consumptions_staff_read on public.stock_batch_consumptions;
create policy stock_batch_consumptions_staff_read on public.stock_batch_consumptions
  for select to authenticated using (public.fn_is_any_staff());

create or replace function public.fn_jwt_is_service()
returns boolean
language sql
stable
as $$
  select coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role';
$$;

create or replace function public.fn_warehouse_in_scope(p_actor uuid, p_warehouse uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.profiles p
      left join public.warehouses w on w.id = p_warehouse
     where p.id = p_actor
       and coalesce(p.is_active, true)
       and (
         p.role::text in ('owner', 'super_admin', 'admin')
         or (w.id is not null and w.branch_id is not null and w.branch_id = p.branch_id)
         or (w.id is not null and w.shop_id is not null and w.shop_id = p.shop_id)
       )
  );
$$;

drop function if exists public.fn_consume_sellable_fifo(uuid, uuid, numeric, boolean);

create or replace function public.fn_consume_sellable_fifo(
  p_warehouse uuid,
  p_product uuid,
  p_qty numeric,
  p_allow_expired boolean default false,
  p_actor uuid default null,
  p_reference_type text default null,
  p_reference_id uuid default null
)
returns table (batch_id uuid, taken numeric, unit_cost numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_left numeric := p_qty;
  v_take numeric;
  v_taken numeric := 0;
  v_today date := (timezone('Asia/Karachi', now()))::date;
  v_actor uuid := coalesce(auth.uid(), p_actor);
  v_trusted boolean := coalesce(current_setting('agribridge.trusted_stock', true), '') = 'on';
  v_expired boolean := coalesce(p_allow_expired, false) and public.fn_jwt_is_service();
begin
  if p_qty is null or p_qty <= 0 then
    raise exception 'Miqdar sifar se zyada honi chahiye.';
  end if;
  if v_actor is null and not v_trusted and not public.fn_jwt_is_service() then
    raise exception 'Ijazat nahi.';
  end if;
  if not v_trusted and v_actor is not null and not public.fn_warehouse_in_scope(v_actor, p_warehouse) then
    raise exception 'Ye godam aap ke scope se bahar hai.';
  end if;
  if v_expired then
    perform set_config('agribridge.allow_expired_out', 'on', true);
  end if;

  for r in
    select sb.id, sb.remaining_quantity, sb.unit_cost as batch_cost
      from public.stock_batches sb
     where sb.warehouse_id = p_warehouse
       and sb.product_id = p_product
       and coalesce(sb.remaining_quantity, 0) > 0
       and (sb.initial_quantity is null or sb.remaining_quantity <= sb.initial_quantity)
       and (
         v_expired
         or sb.expiry_date is null
         or sb.expiry_date >= v_today
       )
     order by sb.expiry_date nulls last, sb.created_at
     for update
  loop
    exit when v_left <= 0;
    v_take := least(v_left, r.remaining_quantity);
    update public.stock_batches
       set remaining_quantity = remaining_quantity - v_take
     where id = r.id
       and remaining_quantity >= v_take
       and (initial_quantity is null or remaining_quantity - v_take <= initial_quantity);
    if not found then
      continue;
    end if;
    insert into public.stock_batch_consumptions (batch_id, warehouse_id, product_id, taken, reference_type, reference_id)
    values (r.id, p_warehouse, p_product, v_take, p_reference_type, p_reference_id);
    batch_id := r.id;
    taken := v_take;
    unit_cost := coalesce(r.batch_cost, 0);
    return next;
    v_left := v_left - v_take;
    v_taken := v_taken + v_take;
  end loop;

  if v_left > 0 then
    insert into public.stock_batch_shortfalls (
      warehouse_id, product_id, requested_qty, taken_qty, short_qty, reason, reference_type, reference_id, created_by
    ) values (
      p_warehouse, p_product, p_qty, v_taken, v_left,
      'Sellable batch kam. Expire ya remaining>initial ko chheda nahi. Bikri rukti nahi.',
      p_reference_type, p_reference_id, v_actor
    );
  end if;
end $$;

revoke all on function public.fn_consume_sellable_fifo(uuid, uuid, numeric, boolean, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.fn_consume_sellable_fifo(uuid, uuid, numeric, boolean, uuid, text, uuid) to service_role;

revoke all on function public.fn_warehouse_in_scope(uuid, uuid) from public, anon;
grant execute on function public.fn_warehouse_in_scope(uuid, uuid) to authenticated, service_role;
