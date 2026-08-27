-- =====================================================================
-- AgriBridge — Migration 079: Order From Branch (Shop-to-Shop support)
-- =====================================================================
-- order_to_branch_id already exists (destination). Adding
-- order_from_branch_id lets any branch order from any other branch
-- OR the Main Warehouse - not just Main Warehouse to a shop.

alter table agri_orders add column if not exists order_from_branch_id uuid references branches(id);