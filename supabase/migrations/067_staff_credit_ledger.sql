-- =====================================================================
-- AgriBridge — Migration 067: Staff Khata (Salary Credit Ledger)
-- =====================================================================
-- Mirrors the Farmer Credit Ledger pattern, but for staff: daily wage
-- credits automatically when a staff member completes check-in +
-- check-out, and they can spend against this balance (e.g. buying
-- from Grocery). At month-end, the remaining balance becomes their
-- Salary Due, which admin marks Paid once transferred to bank.

create table if not exists staff_credit_ledger (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references profiles(id) on delete cascade,
  ledger_type text not null check (ledger_type in ('credit', 'debit')),
  source_type text not null,
  amount numeric(10,2) not null check (amount > 0),
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table staff_credit_ledger enable row level security;
create policy staff_manage_credit_ledger on staff_credit_ledger for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin'))
);
create policy staff_view_own_credit_ledger on staff_credit_ledger for select using (profile_id = auth.uid());