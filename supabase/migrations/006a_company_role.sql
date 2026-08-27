-- =====================================================================
-- AgriBridge — Migration 006a: company_rep role (RUN ALONE FIRST)
-- Same reason as 002a/002d — a new enum value can't be used in the same
-- transaction it was added in.
-- =====================================================================

alter type user_role add value if not exists 'company_rep';
