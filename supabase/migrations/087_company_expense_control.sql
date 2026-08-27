-- =====================================================================
-- AgriBridge — Migration 087: Company Expense Control (Phase 1)
-- =====================================================================
-- ANY company expense (Rent/Salary/Utility/Supplier Payment/Inventory
-- Purchase/Other) is first REQUESTED, then must be APPROVED by Admin
-- before it's counted as an actual outflow - full record + approval
-- chain for every rupee spent.

create table if not exists company_expense_requests (
  id uuid primary key default uuid_generate_v4(),
  expense_number text not null unique,

  category text not null check (category in (
    'inventory_purchase','rent','salary','utility_bill','supplier_payment','maintenance','other'
  )),
  amount numeric(12,2) not null,
  description text not null,
  document_url text,

  -- Optional links to the related record (e.g. which supplier/branch)
  supplier_id uuid references suppliers(id),
  branch_id uuid references branches(id),

  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_by uuid references profiles(id),
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  rejection_reason text,

  created_at timestamptz not null default now()
);

create table if not exists company_expense_counters (
  year integer primary key,
  last_number integer not null default 0
);

alter table company_expense_requests enable row level security;
create policy staff_manage_expense_requests on company_expense_requests for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager','sales_staff','finance'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager','sales_staff','finance'))
);

alter table company_expense_counters enable row level security;
create policy staff_manage_expense_counters on company_expense_counters for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager','sales_staff','finance'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager','sales_staff','finance'))
);

insert into storage.buckets (id, name, public)
values ('expense-documents', 'expense-documents', true)
on conflict (id) do nothing;