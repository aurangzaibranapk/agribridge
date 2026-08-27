-- =====================================================================
-- AgriBridge — Migration 070: Link Job Application to Created Profile
-- =====================================================================
alter table job_applications add column if not exists created_profile_id uuid references profiles(id);