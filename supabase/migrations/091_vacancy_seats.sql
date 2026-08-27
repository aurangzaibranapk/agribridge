-- =====================================================================
-- AgriBridge — Migration 091: Job Vacancy Seats (Auto-Close When Full)
-- =====================================================================

alter table job_vacancies add column if not exists seats_total integer default 1;
alter table job_vacancies add column if not exists seats_filled integer default 0;