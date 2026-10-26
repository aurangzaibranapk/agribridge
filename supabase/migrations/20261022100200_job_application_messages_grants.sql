-- Grants for job_application_messages (RLS still applies). No sequences: id is uuid.
grant select, insert on public.job_application_messages to authenticated;
grant all on public.job_application_messages to service_role;
