drop trigger if exists trg_guard_stock_loss_maker on public.stock_loss_records;
drop function if exists public.fn_guard_stock_loss_maker();
drop function if exists public.fn_release_stock_loss_claim(uuid);
drop function if exists public.fn_decide_stock_loss(uuid, text, text);
drop table if exists public.stock_loss_ledger_claims;
