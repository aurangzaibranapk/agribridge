-- =====================================================================
-- AgriBridge — Migration 013: Product unit, barcode, manufacture/expiry
-- =====================================================================
alter table products add column if not exists unit text;
alter table products add column if not exists barcode text;
alter table products add column if not exists manufacture_date date;
alter table products add column if not exists expiry_date date;
