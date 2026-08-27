-- =====================================================================
-- AgriBridge — Migration 072: Add "under_review" Status
-- =====================================================================
do $$
declare
  con_name text;
begin
  select conname into con_name
  from pg_constraint
  where conrelid = 'job_applications'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%status%';

  if con_name is not null then
    execute format('alter table job_applications drop constraint %I', con_name);
  end if;

  alter table job_applications add constraint job_applications_status_check
    check (status in ('pending','under_review','eligible','not_eligible','interview_scheduled','scored','offered','accepted','rejected','joined'));
end $$;