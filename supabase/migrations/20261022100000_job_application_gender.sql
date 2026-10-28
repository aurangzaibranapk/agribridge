-- =====================================================================
-- Job applications: gender (additive)
-- =====================================================================
-- Purani darkhwastein gender ke baghair rehti hain (column null).
-- Nayi public darkhwast teen values mein se ek bhejti hai.
-- Koi row update nahi. Live par ye file is change ke sath nahi chali.

alter table public.job_applications
  add column if not exists gender text;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'chk_job_application_gender'
  ) then
    alter table public.job_applications
      add constraint chk_job_application_gender
      check (gender is null or gender in ('male', 'female', 'other'));
  end if;
end $$;

comment on column public.job_applications.gender is
  'male, female, or other. Null on rows from before this column. Staff profile uses the same three values.';
