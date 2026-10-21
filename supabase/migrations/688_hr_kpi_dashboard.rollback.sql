-- Rollback 688 (sirf zaroorat par; naye tables ka data khatam ho jayega -- pehle backup).
begin;
drop function if exists public.fn_hr_pulse_summary(date, date);
drop trigger if exists trg_hr_perf_decide on public.hr_performance_reviews;
drop trigger if exists trg_hr_target_decide on public.hr_department_targets;
drop function if exists public.fn_hr_kpi_decide_guard();
drop trigger if exists trg_staff_hr_fields_audit on public.staff_details;
drop function if exists public.fn_staff_hr_fields_audit();
drop table if exists public.hr_pulse_responses, public.hr_department_targets, public.hr_performance_reviews, public.hr_training_records;
drop function if exists public.fn_hr_kpi_audit();
drop table if exists public.hr_kpi_audit;
drop trigger if exists trg_job_app_stage_stamp on public.job_applications;
drop function if exists public.fn_job_app_stage_stamp();
drop function if exists public.fn_job_app_stage_rank(text);
-- Columns (screened_at..stage_changed_by, staff_details.gender) jaan boojh kar rehne diye -- data na jaye.
commit;
