-- =====================================================================
-- AgriBridge — Migration 002a: New roles (RUN THIS FILE ALONE FIRST)
-- =====================================================================
-- Postgres will not let a newly-added enum value be *used* in the same
-- transaction that added it. Supabase's SQL Editor runs a whole pasted
-- script as one transaction, so this file only adds the enum values.
-- Run it, wait for it to finish, THEN run 002b_bridge_and_multitenancy.sql
-- in a separate query. Doing this out of order will fail with:
--   "unsafe use of new value of enum type" — that error means you
--   pasted both files together; split them and run 002a first.
-- =====================================================================

alter type user_role add value if not exists 'dealer';
alter type user_role add value if not exists 'investor';
