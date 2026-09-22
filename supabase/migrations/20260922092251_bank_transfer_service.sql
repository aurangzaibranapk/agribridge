-- AgriBridge: customer bank/wallet transfer service.
--
-- Customer paisa hamein deta hai; staff apne active finance account se
-- beneficiary ke bank/JazzCash/Easypaisa account mein transfer karta hai.
-- Asal transfer income nahi. Sirf service_charge aamdani hai.

insert into public.gl_accounts (code, name, account_type, normal_side, sort_order)
values ('4060', 'Bank transfer service charge', 'income', 'credit', 4060)
on conflict (code) do update set
  name = excluded.name,
  account_type = excluded.account_type,
  normal_side = excluded.normal_side,
  sort_order = excluded.sort_order;

create table if not exists public.bank_transfer_transactions (
  id uuid primary key default gen_random_uuid(),
  txn_number text not null unique,
  source_finance_account_id uuid not null references public.finance_accounts(id),
  receiving_method text not null,
  receiving_finance_account_id uuid references public.finance_accounts(id),
  destination_channel text not null,
  beneficiary_title text not null,
  beneficiary_account text not null,
  customer_id uuid references public.customers(id),
  farmer_id uuid references public.farmers(id),
  customer_name text,
  customer_phone text,
  principal numeric(14,2) not null,
  service_charge numeric(14,2),
  provider_tid text,
  status text not null default 'saboot_baqi',
  journal_entry_id uuid references public.journal_entries(id),
  branch_id uuid references public.branches(id),
  shop_id uuid references public.shops(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint chk_bank_transfer_received check (receiving_method in ('cash','bank')),
  constraint chk_bank_transfer_receiving_account check (
    (receiving_method = 'cash' and receiving_finance_account_id is null)
    or (receiving_method = 'bank' and receiving_finance_account_id is not null)
  ),
  constraint chk_bank_transfer_channel check (
    destination_channel in ('bank','jazzcash','easypaisa','other_wallet')
  ),
  constraint chk_bank_transfer_principal check (principal > 0),
  constraint chk_bank_transfer_charge check (service_charge is null or service_charge > 0),
  constraint chk_bank_transfer_status check (status in ('darj','saboot_baqi','wapas')),
  constraint chk_bank_transfer_party check (not (customer_id is not null and farmer_id is not null))
);

create index if not exists idx_bank_transfer_created
  on public.bank_transfer_transactions (created_at desc);
create index if not exists idx_bank_transfer_branch
  on public.bank_transfer_transactions (branch_id, created_at desc);
create index if not exists idx_bank_transfer_shop
  on public.bank_transfer_transactions (shop_id, created_at desc);
create index if not exists idx_bank_transfer_pending_proof
  on public.bank_transfer_transactions (created_at desc)
  where status = 'saboot_baqi';

comment on table public.bank_transfer_transactions is
  'Customer ki request par apne bank/wallet se beneficiary ko transfer. Principal income nahi; sirf service_charge income hai.';
comment on column public.bank_transfer_transactions.provider_tid is
  'Bank/wallet app ka transaction/reference ID. Khali ho to status saboot_baqi rehta hai.';

create table if not exists public.bank_transfer_counters (
  year int primary key,
  last_number int not null default 0
);

create or replace function public.fn_next_bank_transfer_number()
returns text
language plpgsql
security invoker
set search_path to 'public'
as $$
declare
  v_year int := extract(year from now())::int;
  v_next int;
begin
  insert into bank_transfer_counters (year, last_number)
  values (v_year, 1)
  on conflict (year) do update
    set last_number = bank_transfer_counters.last_number + 1
  returning last_number into v_next;

  return 'BT-' || v_year::text || '-' || lpad(v_next::text, 5, '0');
end;
$$;

revoke all on function public.fn_next_bank_transfer_number() from public, anon, authenticated;
grant execute on function public.fn_next_bank_transfer_number() to service_role;

alter table public.bank_transfer_transactions enable row level security;
alter table public.bank_transfer_counters enable row level security;

drop policy if exists staff_read_bank_transfer_transactions on public.bank_transfer_transactions;
create policy staff_read_bank_transfer_transactions
on public.bank_transfer_transactions
for select
to authenticated
using (public.fn_is_any_staff());

revoke all on public.bank_transfer_transactions from anon;
revoke insert, update, delete, truncate, references, trigger
  on public.bank_transfer_transactions from authenticated;
grant select on public.bank_transfer_transactions to authenticated;
grant all on public.bank_transfer_transactions to service_role;

revoke all on public.bank_transfer_counters from anon, authenticated;
grant select, insert, update on public.bank_transfer_counters to service_role;
