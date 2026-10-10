-- Finance review #8 (10 Oct 2026): transfer ka paisa "Cash in Transit"
-- (1020) mein tab tak nazar aaye jab tak doosri taraf wusooli darj na ho.
-- Additive only: nullable column + index. NOT applied automatically.
alter table public.finance_transactions
  add column if not exists transfer_to_account_id uuid null references public.finance_accounts(id);

create index if not exists finance_transactions_pending_transfer_idx
  on public.finance_transactions (related_transfer_id)
  where transaction_type = 'transfer_out' and transfer_to_account_id is not null;
