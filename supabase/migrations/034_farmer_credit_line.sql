-- =====================================================================
-- AgriBridge — Migration 034: Unified Farmer Credit Line
-- =====================================================================
-- One combined credit ledger covering Seed/Fertilizer/Pesticide/
-- Machinery credit given to a farmer, and automatic repayment
-- deduction when their produce is sold back to us. Append-only ledger
-- pattern, same as customer_ledger/investment_ledger elsewhere.

create type credit_ledger_type as enum ('debit', 'credit');
create type credit_source_type as enum ('seed', 'fertilizer', 'pesticide', 'machinery', 'produce_repayment', 'other');

create table farmer_credit_ledger (
  id uuid primary key default uuid_generate_v4(),
  farmer_id uuid not null references farmers(id) on delete restrict,
  source_type credit_source_type not null,
  ledger_type credit_ledger_type not null,
  amount numeric(14,2) not null check (amount > 0),
  balance_after numeric(14,2) not null,
  reference_id uuid,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index idx_farmer_credit_ledger_farmer on farmer_credit_ledger(farmer_id, created_at);

-- Keeps a running balance the same way customer_ledger does.
create or replace function fn_apply_farmer_credit_entry() returns trigger as $$
declare
  v_current numeric(14,2);
begin
  select coalesce(sum(case when ledger_type = 'debit' then amount else -amount end), 0)
    into v_current
    from farmer_credit_ledger
    where farmer_id = new.farmer_id;

  new.balance_after := v_current + (case when new.ledger_type = 'debit' then new.amount else -new.amount end);
  return new;
end;
$$ language plpgsql;

create trigger trg_farmer_credit_entry
  before insert on farmer_credit_ledger
  for each row execute function fn_apply_farmer_credit_entry();

-- Quick lookup of current balance per farmer.
create view farmer_credit_balances as
select
  f.id as farmer_id,
  f.full_name,
  f.farmer_code,
  coalesce(sum(case when l.ledger_type = 'debit' then l.amount else -l.amount end), 0) as balance_due
from farmers f
left join farmer_credit_ledger l on l.farmer_id = f.id
where f.is_deleted = false
group by f.id, f.full_name, f.farmer_code;

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table farmer_credit_ledger enable row level security;

create policy staff_all_access on farmer_credit_ledger for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true
    and role in ('super_admin','admin','manager','sales_staff'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true
    and role in ('super_admin','admin','manager','sales_staff'))
);

create policy farmer_own_credit_ledger on farmer_credit_ledger for select using (
  exists (select 1 from farmers f where f.id = farmer_credit_ledger.farmer_id and f.user_id = auth.uid())
);