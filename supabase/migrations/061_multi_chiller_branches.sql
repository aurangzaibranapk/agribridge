-- =====================================================================
-- AgriBridge — Migration 061: Multi-Chiller (Branch) Support
-- =====================================================================
-- Every chiller becomes its own Branch (reusing the existing Branches
-- system). All milk/fleet/billing tables get a branch_id so data can
-- be scoped per-chiller for staff, and viewed combined or separately
-- by Owner/Admin.

alter table milk_entries add column if not exists branch_id uuid references branches(id);
alter table vehicles add column if not exists branch_id uuid references branches(id);
alter table generator_logs add column if not exists branch_id uuid references branches(id);
alter table maintenance_logs add column if not exists branch_id uuid references branches(id);
alter table milk_route_collections add column if not exists branch_id uuid references branches(id);
alter table monthly_expenses add column if not exists branch_id uuid references branches(id);

-- Backfill existing records to the Main branch so nothing breaks for
-- data already entered before this migration.
update milk_entries set branch_id = (select id from branches where is_main_branch = true limit 1) where branch_id is null;
update vehicles set branch_id = (select id from branches where is_main_branch = true limit 1) where branch_id is null;
update generator_logs set branch_id = (select id from branches where is_main_branch = true limit 1) where branch_id is null;
update maintenance_logs set branch_id = (select id from branches where is_main_branch = true limit 1) where branch_id is null;
update milk_route_collections set branch_id = (select id from branches where is_main_branch = true limit 1) where branch_id is null;