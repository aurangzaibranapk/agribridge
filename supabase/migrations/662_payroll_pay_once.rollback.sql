drop function if exists public.fn_payroll_release_pay_lock(uuid);
drop function if exists public.fn_payroll_claim_pay(uuid);
drop index if exists public.uq_payroll_pay_journal;
alter table public.payroll_runs drop column if exists pay_lock_at;
alter table public.payroll_runs drop column if exists pay_lock;
