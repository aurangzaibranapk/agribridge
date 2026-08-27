-- =====================================================================
-- AgriBridge — Migration 088: Capital/Investment Source Tracking
-- =====================================================================
-- Records WHERE the money that went into the business came from -
-- Owner's own capital, Bank Loan, Borrowed from someone, or Profit
-- reinvested back into the business.

create table if not exists capital_injections (
  id uuid primary key default uuid_generate_v4(),
  source_type text not null check (source_type in ('owner_capital','bank_loan','borrowed','reinvested_profit')),
  source_name text,
  amount numeric(12,2) not null,
  injection_date date not null,
  document_url text,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table capital_injections enable row level security;
create policy staff_manage_capital_injections on capital_injections for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin'))
);