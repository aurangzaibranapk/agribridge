-- =====================================================================
-- AgriBridge — Migration 084: Store Credit Limit + Advance Wallet
-- =====================================================================
-- Each branch/shop gets a persistent credit_limit set by admin.
-- Advance Payments credit their account; approved Orders debit it.
-- Available credit = credit_limit - (order charges - advance payments).

create table if not exists branch_credit_accounts (
  id uuid primary key default uuid_generate_v4(),
  branch_id uuid not null unique references branches(id) on delete cascade,
  credit_limit numeric(12,2) not null default 0,
  notes text,
  updated_at timestamptz not null default now()
);

create table if not exists branch_credit_transactions (
  id uuid primary key default uuid_generate_v4(),
  branch_id uuid not null references branches(id) on delete cascade,
  transaction_type text not null check (transaction_type in ('advance_payment','order_charge','adjustment','refund')),
  amount numeric(12,2) not null,
  order_id uuid references agri_orders(id),
  payment_method text,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table branch_credit_accounts enable row level security;
create policy staff_manage_branch_credit_accounts on branch_credit_accounts for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager'))
);

alter table branch_credit_transactions enable row level security;
create policy staff_manage_branch_credit_transactions on branch_credit_transactions for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager','sales_staff'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager','sales_staff'))
);