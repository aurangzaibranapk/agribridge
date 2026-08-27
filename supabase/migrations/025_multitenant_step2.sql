-- =====================================================================
-- AgriBridge — Migration 025: Multi-Tenant Isolation (Step 2 of 5)
-- =====================================================================
-- warehouses and finance_accounts are the only two tables built in
-- this session that don't already inherit organization_id from a
-- parent row (farmers, products, etc.) — everything else (milk_entries,
-- grain_procurement_entries, stock_batches, ...) will be scoped via a
-- join to a table that already has organization_id, in later steps.

alter table warehouses add column organization_id uuid references organizations(id);
update warehouses set organization_id = fn_default_organization_id() where organization_id is null;
alter table warehouses alter column organization_id set not null;
alter table warehouses alter column organization_id set default fn_default_organization_id();

alter table finance_accounts add column organization_id uuid references organizations(id);
update finance_accounts set organization_id = fn_default_organization_id() where organization_id is null;
alter table finance_accounts alter column organization_id set not null;
alter table finance_accounts alter column organization_id set default fn_default_organization_id();