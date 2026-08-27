-- =====================================================================
-- AgriBridge — Migration 050: Add "joined" status to job_applications
-- =====================================================================
alter table job_applications drop constraint if exists job_applications_status_check;
alter table job_applications add constraint job_applications_status_check
  check (status in ('pending', 'eligible', 'not_eligible', 'interview_scheduled', 'scored', 'offered', 'accepted', 'rejected', 'joined'));