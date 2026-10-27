-- 696 rollback (created_by NOT NULL wapas sirf agar koi auto run na ho)
drop trigger if exists trg_guard_payroll_adjuster_approve on public.payroll_runs;
drop function if exists public.fn_guard_payroll_adjuster_approve();
drop function if exists public.fn_payroll_line_adjust(uuid, text, numeric, text);
drop function if exists public.fn_payroll_auto_draft(int, int);
drop function if exists public.fn_payroll_fill_lines_system(uuid);
drop function if exists public.fn_payroll_advance_due_system(uuid, int, int, numeric);
drop table if exists public.payroll_line_adjustments;
drop table if exists public.payroll_run_warnings;
alter table public.payroll_runs drop column if exists auto_created;
-- alter table public.payroll_runs alter column created_by set not null;  -- sirf jab created_by null wale rows na hon
