-- =====================================================================
-- AgriBridge — Migration 046: Interview Scoring System
-- =====================================================================
-- Full hiring pipeline: Eligible check -> Interview scheduled ->
-- Scored (10 business questions + 4 soft-skill scores) -> Hire/Reject
-- decision -> (if hire) existing Offer flow.

alter table job_applications add column if not exists expected_salary numeric(12,2);
alter table job_applications add column if not exists is_eligible boolean;
alter table job_applications add column if not exists interview_date date;

-- Widen status options (old check constraint only had pending/reviewed/
-- offered/accepted/rejected).
alter table job_applications drop constraint if exists job_applications_status_check;
alter table job_applications add constraint job_applications_status_check
  check (status in ('pending', 'eligible', 'not_eligible', 'interview_scheduled', 'scored', 'offered', 'accepted', 'rejected'));

create table interview_scores (
  id uuid primary key default uuid_generate_v4(),
  application_id uuid not null references job_applications(id) on delete cascade unique,
  question_scores jsonb not null default '[]', -- array of {question, score} - up to 10, score 1-5 each
  behavior_score integer check (behavior_score between 1 and 5),
  attitude_score integer check (attitude_score between 1 and 5),
  communication_score integer check (communication_score between 1 and 5),
  cleanliness_score integer check (cleanliness_score between 1 and 5),
  total_score numeric(6,2) not null default 0,
  recommendation text check (recommendation in ('hire', 'reject')),
  notes text,
  interviewer_id uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table interview_scores enable row level security;
create policy staff_manage_interview_scores on interview_scores for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin'))
);