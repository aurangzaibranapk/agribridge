drop view if exists public.v_expired_batches_in_stock;
drop trigger if exists trg_guard_expired_batch_sale on public.stock_batches;
drop function if exists public.fn_guard_expired_batch_sale();
drop function if exists public.fn_batch_is_sellable(date);
