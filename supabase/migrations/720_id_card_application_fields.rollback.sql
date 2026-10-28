-- 720 rollback. Naye application columns hataata hai.
-- staff_details par jo phone/CNIC copy ho chuke, unhein wapas khali
-- nahi karta — wo asal hiring record hain, dash nahi.
-- Live par mat chalao jab tak backup verify na ho.

alter table public.job_applications drop constraint if exists chk_job_application_blood_group;

alter table public.job_applications
  drop column if exists blood_group,
  drop column if exists emergency_contact_name,
  drop column if exists emergency_contact_phone,
  drop column if exists photo_url;
