-- =====================================================================
-- AgriBridge — Migration 044: Job Application Full CV
-- =====================================================================
-- Adds experience/qualification/CNIC fields plus document upload URLs
-- (CNIC image, Qualification Certificate) so an application works like
-- a proper CV submission, not just a contact form.

alter table job_applications add column if not exists experience text;
alter table job_applications add column if not exists qualification text;
alter table job_applications add column if not exists address text;
alter table job_applications add column if not exists cnic text;
alter table job_applications add column if not exists cnic_image_url text;
alter table job_applications add column if not exists certificate_url text;