-- Rollback 593: functions aur trigger hatao. Naye khaane (paid_by, paid_at,
-- pay_txn_id) data ke saath rehte hain -- un ko girana zaroori nahi; chahein
-- to aakhri teen lines chala dein.
drop trigger if exists trg_salary_payment_guard on public.salary_payments;
drop function if exists public.fn_salary_payment_guard();
drop function if exists public.fn_salary_payment_claim(uuid);
drop function if exists public.fn_salary_payment_attach_txn(uuid, uuid);
drop function if exists public.fn_salary_payment_unclaim(uuid);
-- alter table public.salary_payments drop column if exists pay_txn_id;
-- alter table public.salary_payments drop column if exists paid_at;
-- alter table public.salary_payments drop column if exists paid_by;
