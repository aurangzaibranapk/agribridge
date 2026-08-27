-- =====================================================================
-- AgriBridge — Migration 092: Interview Mode (Online/Face-to-Face/Call)
-- =====================================================================

alter table job_applications add column if not exists interview_mode text check (interview_mode in ('online','face_to_face','call'));
alter table job_applications add column if not exists interview_location text;