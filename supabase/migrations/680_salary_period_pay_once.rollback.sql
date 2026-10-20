-- 680 wapas: naya qatal hatao, 662/593/553 wale functions lautao.
-- created_by khana rehta hai (khali). Paisa nahi badalta.

create or replace function public.fn_payroll_claim_pay(p_run uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.payroll_runs;
begin
  if not public.fn_payroll_is_approver() then
    raise exception 'Payroll ada karna sirf Admin ya Owner ka kaam hai.';
  end if;
  select * into r from public.payroll_runs where id = p_run for update;
  if not found then
    raise exception 'Payroll run nahi mili.';
  end if;
  if r.status = 'paid' or r.pay_journal_id is not null then
    return 'already_paid';
  end if;
  if r.status <> 'approved' or r.approve_journal_id is null then
    raise exception 'Pehle manzoori aur journal.';
  end if;
  if r.created_by = auth.uid() then
    raise exception 'Banane wala khud ada nahi kar sakta.';
  end if;
  if r.pay_lock is not null
     and r.pay_lock is distinct from auth.uid()
     and coalesce(r.pay_lock_at, now()) > now() - interval '10 minutes' then
    raise exception 'Adaigi pehle se chal rahi hai.';
  end if;
  perform set_config('agribridge.payroll_fn', 'on', true);
  update public.payroll_runs
     set pay_lock = auth.uid(),
         pay_lock_at = now()
   where id = p_run;
  perform set_config('agribridge.payroll_fn', 'off', true);
  return 'claimed';
end $$;

create or replace function public.fn_payroll_release_pay_lock(p_run uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.fn_payroll_is_approver() then
    raise exception 'Ijazat nahi.';
  end if;
  perform set_config('agribridge.payroll_fn', 'on', true);
  update public.payroll_runs
     set pay_lock = null,
         pay_lock_at = null
   where id = p_run
     and status = 'approved'
     and pay_journal_id is null
     and pay_lock = auth.uid();
  perform set_config('agribridge.payroll_fn', 'off', true);
end $$;

create or replace function public.fn_salary_payment_claim(p_payment uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  r public.salary_payments;
  v_n int;
begin
  if v_actor is null or not exists (
    select 1 from public.profiles p
    where p.id = v_actor and p.is_active and p.role::text in ('admin','owner','super_admin')) then
    raise exception 'Tankhwah ada karna sirf Admin ya Owner ka kaam hai.';
  end if;
  select * into r from public.salary_payments where id = p_payment;
  if not found then raise exception 'Ye tankhwah nahi mili.'; end if;
  if r.profile_id = v_actor then raise exception 'Apni tankhwah khud ada nahi ki ja sakti.'; end if;
  perform set_config('agribridge.salary_pay_fn', 'on', true);
  update public.salary_payments
     set status = 'paid',
         paid_date = (now() at time zone 'Asia/Karachi')::date,
         paid_by = v_actor,
         paid_at = now()
   where id = p_payment and status <> 'paid'
  returning * into r;
  get diagnostics v_n = row_count;
  perform set_config('agribridge.salary_pay_fn', 'off', true);
  if v_n = 0 then
    raise exception 'Ye tankhwah pehle hi di ja chuki hai.' using errcode = 'P0001', hint = 'already_paid';
  end if;
  return jsonb_build_object(
    'id', r.id, 'profile_id', r.profile_id, 'net_salary', r.net_salary,
    'advance_deduction', r.advance_deduction, 'pay_month', r.pay_month, 'pay_year', r.pay_year);
end $$;

create or replace function public.fn_salary_payment_unclaim(p_payment uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.salary_payments;
begin
  select * into r from public.salary_payments where id = p_payment for update;
  if not found or r.status <> 'paid' or r.paid_by is distinct from auth.uid()
     or r.paid_at is null or r.paid_at < now() - interval '15 minutes' then
    raise exception 'Ye adaigi wapas nahi li ja sakti.';
  end if;
  if r.pay_txn_id is not null
     and exists (select 1 from public.finance_transactions t where t.id = r.pay_txn_id) then
    raise exception 'Cash book mein qatar maujood hai — adaigi wapas nahi li ja sakti.';
  end if;
  perform set_config('agribridge.salary_pay_fn', 'on', true);
  update public.salary_payments
     set status = 'pending', paid_date = null, paid_by = null, paid_at = null, pay_txn_id = null
   where id = p_payment;
  perform set_config('agribridge.salary_pay_fn', 'off', true);
end $$;

create or replace function public.fn_payroll_set_journal(p_run uuid, p_kind text, p_journal uuid, p_account uuid default null, p_txn uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.payroll_runs; l record;
begin
  if not public.fn_payroll_is_approver() then raise exception 'Ijazat nahi.'; end if;
  select * into r from public.payroll_runs where id = p_run for update;
  perform set_config('agribridge.payroll_fn', 'on', true);
  if p_kind = 'approve' then
    if r.status <> 'approved' or r.approve_journal_id is not null then raise exception 'Journal pehle se laga hai ya run manzoor nahi.'; end if;
    update public.payroll_runs set approve_journal_id = p_journal where id = p_run;
  elsif p_kind = 'pay' then
    if r.status <> 'approved' or r.approve_journal_id is null then raise exception 'Pehle manzoori aur journal.'; end if;
    if r.created_by = auth.uid() then raise exception 'Banane wala khud ada nahi kar sakta.'; end if;
    update public.payroll_runs set status = 'paid', paid_by = auth.uid(), paid_at = now(),
      pay_account_id = p_account, pay_txn_id = p_txn, pay_journal_id = p_journal where id = p_run;
    for l in select * from public.payroll_lines where run_id = p_run loop
      insert into public.salary_payments (profile_id, pay_month, pay_year, basic_salary, bonus, deductions,
        advance_deduction, net_salary, status, paid_date, notes)
      values (l.profile_id, r.pay_month, r.pay_year, l.basic, l.allowances, l.absent_deduction + l.other_deductions,
        l.advance_deduction, l.net, 'paid', current_date, 'Payroll run ' || p_run::text)
      on conflict (profile_id, pay_month, pay_year) do nothing;
    end loop;
  else raise exception 'Ghalat kind'; end if;
  perform set_config('agribridge.payroll_fn', 'off', true);
end $$;

drop function if exists public.fn_payroll_pay_guard(uuid);
drop function if exists public.fn_salary_period_release(uuid, int, int, text, uuid);
drop function if exists public.fn_salary_period_take(uuid, int, int, text, uuid);
drop function if exists public.fn_payroll_can_pay();
drop function if exists public.fn_payroll_duplicate_pay_journal_count();
drop table if exists public.salary_period_pays;
alter table public.hr_payroll_settings drop constraint if exists hr_payroll_settings_pay_role;
alter table public.hr_payroll_settings drop column if exists pay_role;
