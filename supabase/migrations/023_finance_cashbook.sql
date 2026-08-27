-- =====================================================================
-- AgriBridge — Migration 023: Finance Module (Cash Book)
-- =====================================================================
-- Flexible multi-account cash book: create as many accounts (Cash,
-- Bank, Mobile Wallet, etc.) as needed. Every transaction is either
-- income, expense, or a transfer between two accounts. current_balance
-- is a cached running total kept in sync by a trigger, same
-- append-only-ledger pattern used throughout this schema.

create type finance_account_type as enum ('cash', 'bank', 'mobile_wallet', 'other');
create type finance_transaction_type as enum ('income', 'expense', 'transfer_in', 'transfer_out');

create table finance_accounts (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  account_type finance_account_type not null default 'cash',
  opening_balance numeric(14,2) not null default 0,
  current_balance numeric(14,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table finance_transactions (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references finance_accounts(id) on delete restrict,
  transaction_type finance_transaction_type not null,
  category text,
  amount numeric(14,2) not null check (amount > 0),
  transaction_date date not null default current_date,
  notes text,
  related_transfer_id uuid, -- links the two sides of a transfer to each other
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index idx_finance_txn_account on finance_transactions(account_id, transaction_date);

-- Keep finance_accounts.current_balance in sync with every transaction -
-- income and transfer_in increase it, expense and transfer_out decrease it.
create or replace function fn_apply_finance_transaction() returns trigger as $$
declare
  v_delta numeric(14,2);
begin
  v_delta := case
    when new.transaction_type in ('income', 'transfer_in') then new.amount
    else -new.amount
  end;

  update finance_accounts set current_balance = current_balance + v_delta
    where id = new.account_id;

  return new;
end;
$$ language plpgsql;

create trigger trg_finance_transaction_apply
  after insert on finance_transactions
  for each row execute function fn_apply_finance_transaction();

-- Seed opening_balance into current_balance whenever an account is created.
create or replace function fn_init_finance_account_balance() returns trigger as $$
begin
  new.current_balance := new.opening_balance;
  return new;
end;
$$ language plpgsql;

create trigger trg_finance_account_init
  before insert on finance_accounts
  for each row execute function fn_init_finance_account_balance();

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table finance_accounts enable row level security;
alter table finance_transactions enable row level security;

do $$
declare t text;
begin
  for t in select unnest(array['finance_accounts', 'finance_transactions'])
  loop
    execute format('create policy staff_all_access on %I for all using (
      exists (select 1 from profiles where id = auth.uid() and is_active = true
        and role in (''super_admin'',''admin'',''manager'',''sales_staff''))
    ) with check (
      exists (select 1 from profiles where id = auth.uid() and is_active = true
        and role in (''super_admin'',''admin'',''manager'',''sales_staff''))
    );', t);
  end loop;
end $$;