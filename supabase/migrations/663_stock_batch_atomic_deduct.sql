-- 663: Batch nikalna ek qatal (row lock) aur check.
-- remaining >= 0, aur sehat-mand batch par remaining <= initial.
-- CHECK NOT VALID: jin 42 batches par remaining > initial hai unhein ye file NAHI cherti.
-- Un par UPDATE tabhi chalega jab nayi qeemat check ke andar aa jaye.
-- fn_consume_sellable_fifo un bigri hui batches ko chhorti hai, taake
-- baqi sehat-mand stock bik sake. Unka hisaab owner ki SQL se (docs).

alter table public.stock_batches drop constraint if exists stock_batches_remaining_nonnegative;
alter table public.stock_batches
  add constraint stock_batches_remaining_nonnegative
  check (remaining_quantity is null or remaining_quantity >= 0) not valid;

alter table public.stock_batches drop constraint if exists stock_batches_remaining_within_initial;
alter table public.stock_batches
  add constraint stock_batches_remaining_within_initial
  check (
    remaining_quantity is null
    or initial_quantity is null
    or remaining_quantity <= initial_quantity
  ) not valid;

create or replace function public.fn_guard_batch_remaining()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.remaining_quantity is not null and new.remaining_quantity < 0 then
    raise exception 'Batch remaining manfi nahi ho sakti.' using errcode = '23514';
  end if;
  if new.initial_quantity is not null and new.remaining_quantity is not null and new.remaining_quantity > new.initial_quantity then
    if tg_op = 'INSERT' then
      raise exception 'Batch remaining initial se zyada nahi ho sakti.' using errcode = '23514';
    end if;
    if old.remaining_quantity is null or new.remaining_quantity > old.remaining_quantity or old.remaining_quantity <= old.initial_quantity then
      raise exception 'Batch remaining initial se zyada nahi ho sakti.' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_batch_remaining on public.stock_batches;
create trigger trg_guard_batch_remaining
  before insert or update on public.stock_batches
  for each row execute function public.fn_guard_batch_remaining();

create or replace function public.fn_consume_sellable_fifo(
  p_warehouse uuid,
  p_product uuid,
  p_qty numeric,
  p_allow_expired boolean default false
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
  v_today date := (timezone('Asia/Karachi', now()))::date;
begin
  if p_qty is null or p_qty <= 0 then
    raise exception 'Miqdar sifar se zyada honi chahiye.';
  end if;
  if not public.fn_is_any_staff() then
    raise exception 'Ijazat nahi.';
  end if;
  if p_allow_expired then
    perform set_config('agribridge.allow_expired_out', 'on', true);
  end if;

  for r in
    select sb.id, sb.remaining_quantity, sb.initial_quantity, sb.unit_cost as batch_cost, sb.expiry_date
      from public.stock_batches sb
     where sb.warehouse_id = p_warehouse
       and sb.product_id = p_product
       and coalesce(sb.remaining_quantity, 0) > 0
       and (sb.initial_quantity is null or sb.remaining_quantity <= sb.initial_quantity)
       and (
         p_allow_expired
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
       and remaining_quantity >= v_take;
    if not found then
      raise exception 'Batch stock kam hai.';
    end if;
    batch_id := r.id;
    taken := v_take;
    unit_cost := coalesce(r.batch_cost, 0);
    return next;
    v_left := v_left - v_take;
  end loop;

  if v_left > 0 then
    raise exception 'Bechne layak batch stock kam hai (%. bacha). Expire ya bigri hui batch nahi bechi jati.', v_left;
  end if;
end $$;

revoke all on function public.fn_consume_sellable_fifo(uuid, uuid, numeric, boolean) from public, anon;
grant execute on function public.fn_consume_sellable_fifo(uuid, uuid, numeric, boolean) to authenticated, service_role;
