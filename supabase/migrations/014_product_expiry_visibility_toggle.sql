-- =====================================================================
-- AgriBridge — Migration 014: Admin-controlled expiry date visibility
-- =====================================================================
-- Expiry date defaults to internal-only (admin decides, per product,
-- whether to show it to customers) rather than being shown by default.
alter table products add column if not exists show_expiry_to_customer boolean not null default false;
