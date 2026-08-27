-- =====================================================================
-- AgriBridge — Migration 037: Farm Verification System
-- =====================================================================
-- New farms default to unverified - work isn't blocked, but admin can
-- confirm the land actually exists. Total Land on the profile is now
-- computed from the sum of farms.area_acres (auto), rather than a
-- manually-entered number that could drift out of sync.

alter table farms add column if not exists is_verified boolean not null default false;
alter table farms add column if not exists verified_at timestamptz;
alter table farms add column if not exists verified_by uuid references auth.users(id);