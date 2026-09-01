-- =====================================================================
-- AgriBridge — Migration 025: Multi-Tenant Isolation (Step 2 of 5)
-- =====================================================================
-- warehouses and finance_accounts are the only two tables built in
-- this session that don't already inherit organization_id from a
-- parent row (farmers, products, etc.) — everything else (milk_entries,
-- grain_procurement_entries, stock_batches, ...) will be scoped via a
-- join to a table that already has organization_id, in later steps.
--
-- `if not exists` yahan zaroori hai, sajawat nahi: warehouses ke paas ye
-- column PEHLE SE hai -- 005 ne table hi is ke sath banaya tha. Migration
-- 027 apne comment mein khud ye baat likhti hai ("warehouses: already had
-- organization_id, discovered in Step 2") -- yani ye baat us waqt bhi
-- saamne aa gayi thi, magar sirf 027 mein likhi gayi; 025 waisi hi rahi.
--
-- Nateeja ye ke ye file sifar se kabhi nahi chal sakti thi. Live par ye
-- kabhi pakri nahi gayi kyunki wahan 005 aur 025 ek hi silsile mein
-- dobara nahi chale.

alter table warehouses add column if not exists organization_id uuid references organizations(id);
update warehouses set organization_id = fn_default_organization_id() where organization_id is null;
alter table warehouses alter column organization_id set not null;
alter table warehouses alter column organization_id set default fn_default_organization_id();

alter table finance_accounts add column if not exists organization_id uuid references organizations(id);
update finance_accounts set organization_id = fn_default_organization_id() where organization_id is null;
alter table finance_accounts alter column organization_id set not null;
alter table finance_accounts alter column organization_id set default fn_default_organization_id();
