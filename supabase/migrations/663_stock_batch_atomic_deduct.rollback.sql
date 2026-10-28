drop function if exists public.fn_consume_sellable_fifo(uuid, uuid, numeric, boolean);
drop trigger if exists trg_guard_batch_remaining on public.stock_batches;
drop function if exists public.fn_guard_batch_remaining();
alter table public.stock_batches drop constraint if exists stock_batches_remaining_within_initial;
alter table public.stock_batches drop constraint if exists stock_batches_remaining_nonnegative;
