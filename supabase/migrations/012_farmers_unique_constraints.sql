-- =====================================================================
-- AgriBridge — Migration 012: Unique constraints on farmers table
-- =====================================================================
-- registerFarmer() already checks for duplicate CNIC/email/phone before
-- inserting, but that check-then-insert has a small race-condition
-- window (two people submitting the same CNIC at almost the same
-- moment). A database-level unique constraint closes that gap
-- completely — the second insert simply fails outright.
-- =====================================================================

-- Note: farmers.cnic was already declared `unique` in the base schema.sql,
-- so no constraint is added here for it — only email and phone_number,
-- which were not previously unique.
alter table farmers add constraint farmers_email_key unique (email);
alter table farmers add constraint farmers_phone_number_key unique (phone_number);
