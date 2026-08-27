-- =====================================================================
-- AgriBridge — Migration 003: Digital Wallet foundation (Phase 7)
-- No enum-in-same-transaction issue here — wallet_owner_type and
-- wallet_transaction_type are brand new types, not new values added to
-- an existing one, so this can run as a single script, unlike 002a/002d.
-- =====================================================================

create type wallet_owner_type as enum ('farmer', 'dealer', 'investor', 'customer', 'platform');

create type wallet_transaction_type as enum (
  'manual_topup', 'withdrawal', 'manual_adjustment',
  'cashback', 'referral_bonus', 'incentive', 'subsidy',
  'loan_disbursement', 'loan_repayment', 'commission_credit',
  'escrow_hold', 'escrow_release', 'escrow_refund'
);

create type wallet_transaction_direction as enum ('credit', 'debit');

-- One wallet per entity. `owner_id` is null only for the 'platform' wallet
-- (AgriBridge itself doesn't have a row in any of the other tables).
create table wallets (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null default fn_default_organization_id() references organizations(id),
  owner_type wallet_owner_type not null,
  owner_id uuid,
  balance numeric(14,2) not null default 0,
  -- Funds moved into escrow_hold sit here, separate from the spendable
  -- balance, until released or refunded. Full multi-party escrow flows
  -- (hold on one wallet, release to another) are a Phase 7+ follow-up —
  -- this column exists now so that work has a home without another
  -- migration; only escrow_hold/escrow_refund touch it in this pass.
  held_balance numeric(14,2) not null default 0,
  currency_code text not null default 'PKR',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (owner_type, owner_id)
);
create index idx_wallets_owner on wallets(owner_type, owner_id);

create table wallet_transactions (
  id uuid primary key default uuid_generate_v4(),
  wallet_id uuid not null references wallets(id) on delete restrict,
  type wallet_transaction_type not null,
  direction wallet_transaction_direction not null,
  amount numeric(14,2) not null check (amount > 0),
  balance_after numeric(14,2) not null,
  reference_type text,
  reference_id uuid,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index idx_wallet_transactions_wallet on wallet_transactions(wallet_id, created_at);

-- Keeps wallets.balance in sync, same append-only-ledger pattern as
-- customer_ledger/investment_ledger/stock_movements elsewhere in this
-- schema. escrow_hold moves balance -> held_balance (net zero); everything
-- else is a straightforward credit/debit against balance.
create or replace function fn_apply_wallet_transaction() returns trigger as $$
declare
  v_balance numeric(14,2);
  v_held numeric(14,2);
begin
  select balance, held_balance into v_balance, v_held from wallets where id = new.wallet_id for update;

  if new.type = 'escrow_hold' then
    update wallets set balance = balance - new.amount, held_balance = held_balance + new.amount
      where id = new.wallet_id returning balance into new.balance_after;
  elsif new.type = 'escrow_refund' then
    update wallets set balance = balance + new.amount, held_balance = held_balance - new.amount
      where id = new.wallet_id returning balance into new.balance_after;
  else
    update wallets set balance = balance + (case when new.direction = 'credit' then new.amount else -new.amount end)
      where id = new.wallet_id returning balance into new.balance_after;
  end if;

  return new;
end;
$$ language plpgsql;

create trigger trg_wallet_transaction_apply
  before insert on wallet_transactions
  for each row execute function fn_apply_wallet_transaction();

-- Auto-provision a wallet the moment a farmer/dealer/investor/customer
-- row is created — nobody has to remember to create one by hand.
create or replace function fn_create_wallet_for_new_entity() returns trigger as $$
declare
  v_owner_type wallet_owner_type;
begin
  v_owner_type := case tg_table_name
    when 'farmers' then 'farmer'
    when 'dealers' then 'dealer'
    when 'investors' then 'investor'
    when 'customers' then 'customer'
  end;

  insert into wallets (owner_type, owner_id) values (v_owner_type, new.id)
    on conflict (owner_type, owner_id) do nothing;

  return new;
end;
$$ language plpgsql;

do $$
declare t text;
begin
  for t in select unnest(array['farmers', 'dealers', 'investors', 'customers'])
  loop
    execute format(
      'create trigger trg_create_wallet after insert on %I for each row execute function fn_create_wallet_for_new_entity();',
      t
    );
  end loop;
end $$;

-- Backfill wallets for anyone who already existed before this migration,
-- plus the one platform wallet for AgriBridge itself.
insert into wallets (owner_type, owner_id)
  select 'farmer'::wallet_owner_type, id from farmers
  union all select 'dealer'::wallet_owner_type, id from dealers
  union all select 'investor'::wallet_owner_type, id from investors
  union all select 'customer'::wallet_owner_type, id from customers
on conflict (owner_type, owner_id) do nothing;

insert into wallets (owner_type, owner_id) values ('platform', null)
  on conflict (owner_type, owner_id) do nothing;

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table wallets enable row level security;
alter table wallet_transactions enable row level security;

create policy staff_all_access on wallets for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin','manager','sales_staff'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin','manager','sales_staff'))
);
create policy staff_all_access on wallet_transactions for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin','manager','sales_staff'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin','manager','sales_staff'))
);

-- Each entity can see (read-only) their own wallet and its transactions —
-- posting a transaction is a staff-only action in this phase (see
-- src/actions/wallet.ts); self-service top-up/withdrawal is a later
-- feature once a real payment gateway is wired in.
create policy farmer_own_wallet on wallets for select using (
  owner_type = 'farmer' and exists (select 1 from farmers f where f.id = wallets.owner_id and f.user_id = auth.uid())
);
create policy dealer_own_wallet on wallets for select using (
  owner_type = 'dealer' and exists (select 1 from dealers d where d.id = wallets.owner_id and d.user_id = auth.uid())
);
create policy investor_own_wallet on wallets for select using (
  owner_type = 'investor' and exists (select 1 from investors i where i.id = wallets.owner_id and i.user_id = auth.uid())
);
create policy customer_own_wallet on wallets for select using (
  owner_type = 'customer' and exists (select 1 from customers c where c.id = wallets.owner_id and c.user_id = auth.uid())
);

create policy own_wallet_transactions on wallet_transactions for select using (
  exists (
    select 1 from wallets w
    where w.id = wallet_transactions.wallet_id
    and (
      (w.owner_type = 'farmer' and exists (select 1 from farmers f where f.id = w.owner_id and f.user_id = auth.uid()))
      or (w.owner_type = 'dealer' and exists (select 1 from dealers d where d.id = w.owner_id and d.user_id = auth.uid()))
      or (w.owner_type = 'investor' and exists (select 1 from investors i where i.id = w.owner_id and i.user_id = auth.uid()))
      or (w.owner_type = 'customer' and exists (select 1 from customers c where c.id = w.owner_id and c.user_id = auth.uid()))
    )
  )
);
