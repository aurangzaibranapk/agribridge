-- =====================================================================
-- AgriBridge — Migration 077: Company Stamp/Seal (Applied to All Agreements)
-- =====================================================================
alter table company_billing_settings add column if not exists company_stamp_url text;