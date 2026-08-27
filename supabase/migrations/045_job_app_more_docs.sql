-- =====================================================================
-- AgriBridge — Migration 045: More Job Application Documents
-- =====================================================================
alter table job_applications add column if not exists cnic_back_image_url text;
alter table job_applications add column if not exists experience_certificate_url text;
alter table job_applications add column if not exists cv_url text;