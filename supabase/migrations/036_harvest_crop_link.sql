-- =====================================================================
-- AgriBridge — Migration 036: Link Harvest Records to Crop History
-- =====================================================================
-- Links harvest_records to the specific crop_history entry it's
-- recording, so the Harvest form can auto-populate crop name + total
-- expense (from crop_expenses) instead of asking the farmer to
-- retype/re-enter data already captured on the My Crops page.

alter table harvest_records add column if not exists crop_history_id uuid references crop_history(id);