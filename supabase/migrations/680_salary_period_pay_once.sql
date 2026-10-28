-- 680: Ek mahina, ek banda, ek adaigi (N1).
-- Purana salary_payments raasta aur payroll run ab ek hi qatal se guzarte hain.
-- S6: jis ki apni line is run mein hai wo ada nahi karta.
-- N8: jis ne run bheja wo ada nahi karta.
-- HR pay role (settings.pay_role, default hr) bhi ada kar sakti hai; maker-checker rehta hai.
-- Additive. Purani raqmein nahi badalti. Migrations apply nahi hoti is commit se.

alter table public.payroll_runs add column if not exists pay_lock uuid;
alter table public.payroll_runs add column if not exists pay_lock_at timestamptz;

alter table public.hr_payroll_settings
  add column if not exists pay_role text not null default 'hr';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'hr_payroll_settings_pay_role') then
    alter table public.hr_payroll_settings
      add constraint hr_payroll_settings_pay_role
      check (pay_role in ('hr','finance','admin','owner','super_admin'));
  end if;
end $$;

alter table public.salary_payments
  add column if not exists created_by uuid;

create table if not exists public.salary_period_pays (
  profile_id uuid not null references public.profiles(id),
  pay_year int not null,
  pay_month int not null check (pay_month between 1 and 12),
  source text not null check (source in ('salary_payment','payroll_run')),
  source_id uuid not null,
  paid_by uuid,
  paid_at timestamptz not null default now(),
  primary key (profile_id, pay_year, pay_month)
);

alter table public.salary_period_pays enable row level security;
revoke all on table public.salary_period_pays from public, anon, authenticated;

-- Pehle se di hui tankhwah ka nishan. Paisa nahi badalta. Do dafa di ho to pehli rehti hai.
insert into public.salary_period_pays (profile_id, pay_year, pay_month, source, source_id)
select profile_id, pay_year, pay_month, 'salary_payment', id
  from public.salary_payments
 where status = 'paid'
on conflict (profile_id, pay_year, pay_month) do nothing;

insert into public.salary_period_pays (profile_id, pay_year, pay_month, source, source_id)
select l.profile_id, r.pay_year, r.pay_month, 'payroll_run', r.id
  from public.payroll_lines l
  join public.payroll_runs r on r.id = l.run_id
 where r.status = 'paid'
on conflict (profile_id, pay_year, pay_month) do nothing;

create or replace function public.fn_payroll_duplicate_pay_journal_count()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from (
    select pay_journal_id
      from public.payroll_runs
     where pay_journal_id is not null
     group by pay_journal_id
    having count(*) > 1
  ) d
$$;

create or replace function public.fn_payroll_can_pay()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.fn_payroll_is_approver()
    or public.fn_payroll_my_role() = (select s.pay_role from public.hr_payroll_settings s where s.id = 1),
    false)
$$;

create or replace function public.fn_salary_period_take(
  p_profile uuid, p_year int, p_month int, p_source text, p_source_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.salary_period_pays (profile_id, pay_year, pay_month, source, source_id, paid_by)
  values (p_profile, p_year, p_month, p_source, p_source_id, auth.uid());
exception when unique_violation then
  raise exception 'Is mahine ki tankhwah is bande ko pehle di ja chuki hai. Dobara ada nahi hogi.';
end $$;

create or replace function public.fn_salary_period_release(
  p_profile uuid, p_year int, p_month int, p_source text, p_source_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.salary_period_pays
   where profile_id = p_profile and pay_year = p_year and pay_month = p_month
     and source = p_source and source_id = p_source_id;
end $$;

-- S6 + N8 + pay role. Claim aur journal dono isi se guzarte hain.
create or replace function public.fn_payroll_pay_guard(p_run uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare r public.payroll_runs;
begin
  if not public.fn_payroll_can_pay() then
    raise exception 'Payroll ada karna sirf HR (pay role) ya Admin/Owner ka kaam hai.';
  end if;
  select * into r from public.payroll_runs where id = p_run;
  if not found then
    raise exception 'Payroll run nahi mili.';
  end if;
  if r.created_by = auth.uid() then
    raise exception 'Banane wala khud ada nahi kar sakta.';
  end if;
  if r.submitted_by = auth.uid() then
    raise exception 'Bhejne wala khud ada nahi kar sakta.';
  end if;
  if exists (select 1 from public.payroll_lines where run_id = p_run and profile_id = auth.uid()) then
    raise exception 'Is run mein aap ki apni tankhwah hai — koi aur ada kare.';
  end if;
end $$;

create or replace function public.fn_payroll_claim_pay(p_run uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.payroll_runs;
begin
  perform public.fn_payroll_pay_guard(p_run);
  select * into r from public.payroll_runs where id = p_run for update;
  if r.status = 'paid' or r.pay_journal_id is not null then
    return 'already_paid';
  end if;
  if r.status <> 'approved' or r.approve_journal_id is null then
    raise exception 'Pehle manzoori aur journal.';
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
  if not public.fn_payroll_can_pay() then
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

  select * into r from public.salary_payments where id = p_payment for update;
  if not found then raise exception 'Ye tankhwah nahi mili.'; end if;
  if r.profile_id = v_actor then raise exception 'Apni tankhwah khud ada nahi ki ja sakti.'; end if;
  if r.created_by = v_actor then raise exception 'Jis ne tankhwah banayi wo khud ada nahi kar sakta.'; end if;
  if r.status = 'paid' then raise exception 'Ye tankhwah pehle hi di ja chuki hai.'; end if;

  perform public.fn_salary_period_take(r.profile_id, r.pay_year, r.pay_month, 'salary_payment', r.id);

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
  perform public.fn_salary_period_release(r.profile_id, r.pay_year, r.pay_month, 'salary_payment', r.id);
end $$;

create or replace function public.fn_payroll_set_journal(
  p_run uuid, p_kind text, p_journal uuid, p_account uuid default null, p_txn uuid default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare r public.payroll_runs; l record;
begin
  select * into r from public.payroll_runs where id = p_run for update;
  if not found then raise exception 'Payroll run nahi mili.'; end if;
  perform set_config('agribridge.payroll_fn', 'on', true);
  if p_kind = 'approve' then
    if not public.fn_payroll_is_approver() then raise exception 'Ijazat nahi.'; end if;
    if r.status <> 'approved' or r.approve_journal_id is not null then
      raise exception 'Journal pehle se laga hai ya run manzoor nahi.';
    end if;
    update public.payroll_runs set approve_journal_id = p_journal where id = p_run;
  elsif p_kind = 'pay' then
    perform public.fn_payroll_pay_guard(p_run);
    if r.status <> 'approved' or r.approve_journal_id is null then
      raise exception 'Pehle manzoori aur journal.';
    end if;
    if r.status = 'paid' or r.pay_journal_id is not null then
      raise exception 'Ye payroll pehle hi ada ho chuki hai.';
    end if;
    for l in select * from public.payroll_lines where run_id = p_run loop
      perform public.fn_salary_period_take(l.profile_id, r.pay_year, r.pay_month, 'payroll_run', p_run);
    end loop;
    update public.payroll_runs set status = 'paid', paid_by = auth.uid(), paid_at = now(),
      pay_account_id = p_account, pay_txn_id = p_txn, pay_journal_id = p_journal where id = p_run;
    for l in select * from public.payroll_lines where run_id = p_run loop
      insert into public.salary_payments (
        profile_id, pay_month, pay_year, basic_salary, bonus, deductions,
        advance_deduction, net_salary, status, paid_date, notes)
      values (
        l.profile_id, r.pay_month, r.pay_year, l.basic, l.allowances,
        l.absent_deduction + l.other_deductions, l.advance_deduction, l.net, 'paid',
        (now() at time zone 'Asia/Karachi')::date, 'Payroll run ' || p_run::text)
      on conflict (profile_id, pay_month, pay_year) do update
        set status = 'paid',
            paid_date = excluded.paid_date,
            basic_salary = excluded.basic_salary,
            bonus = excluded.bonus,
            deductions = excluded.deductions,
            advance_deduction = excluded.advance_deduction,
            net_salary = excluded.net_salary,
            notes = excluded.notes
      where public.salary_payments.status is distinct from 'paid';
    end loop;
  else
    raise exception 'Ghalat kind';
  end if;
  perform set_config('agribridge.payroll_fn', 'off', true);
end $$;

revoke all on function public.fn_payroll_claim_pay(uuid) from public, anon;
revoke all on function public.fn_payroll_release_pay_lock(uuid) from public, anon;
revoke all on function public.fn_salary_payment_claim(uuid) from public, anon;
revoke all on function public.fn_salary_payment_unclaim(uuid) from public, anon;
revoke all on function public.fn_payroll_set_journal(uuid, text, uuid, uuid, uuid) from public, anon;
revoke all on function public.fn_payroll_duplicate_pay_journal_count() from public, anon;
revoke all on function public.fn_payroll_can_pay() from public, anon;
revoke all on function public.fn_salary_period_take(uuid, int, int, text, uuid) from public, anon, authenticated;
revoke all on function public.fn_salary_period_release(uuid, int, int, text, uuid) from public, anon, authenticated;
revoke all on function public.fn_payroll_pay_guard(uuid) from public, anon, authenticated;
grant execute on function public.fn_payroll_duplicate_pay_journal_count() to authenticated;
grant execute on function public.fn_payroll_can_pay() to authenticated;
grant execute on function public.fn_payroll_claim_pay(uuid) to authenticated;
grant execute on function public.fn_payroll_release_pay_lock(uuid) to authenticated;
grant execute on function public.fn_salary_payment_claim(uuid) to authenticated, service_role;
grant execute on function public.fn_salary_payment_unclaim(uuid) to authenticated, service_role;
grant execute on function public.fn_payroll_set_journal(uuid, text, uuid, uuid, uuid) to authenticated;
