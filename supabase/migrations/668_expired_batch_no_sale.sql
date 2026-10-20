-- 668: Expire batch ki seedhi kami (bikri) band, jab tak allow_expired_out na ho.
-- Report pehle se audit safhe par hai; tareekh PKT se.

create or replace function public.fn_batch_is_sellable(p_expiry date)
returns boolean
language sql
stable
as $$
  select p_expiry is null or p_expiry >= (timezone('Asia/Karachi', now()))::date;
$$;

create or replace function public.fn_guard_expired_batch_sale()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.remaining_quantity is not null
     and old.remaining_quantity is not null
     and new.remaining_quantity < old.remaining_quantity
     and old.expiry_date is not null
     and old.expiry_date < (timezone('Asia/Karachi', now()))::date
     and current_setting('agribridge.allow_expired_out', true) is distinct from 'on' then
    raise exception 'Expire batch ki bikri band hai (batch %).', old.batch_number;
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_expired_batch_sale on public.stock_batches;
create trigger trg_guard_expired_batch_sale
  before update on public.stock_batches
  for each row execute function public.fn_guard_expired_batch_sale();

create or replace view public.v_expired_batches_in_stock
with (security_invoker = true) as
select id, batch_number, product_id, warehouse_id, expiry_date, remaining_quantity, initial_quantity, unit_cost,
       remaining_quantity * coalesce(unit_cost, 0) as stock_value
  from public.stock_batches
 where coalesce(remaining_quantity, 0) > 0
   and expiry_date is not null
   and expiry_date < (timezone('Asia/Karachi', now()))::date;

revoke all on public.v_expired_batches_in_stock from public, anon;
grant select on public.v_expired_batches_in_stock to authenticated, service_role;
