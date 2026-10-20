-- 662: Payroll ek dafa ada. Doosri click paisa dobara nahi likhti.
-- pay_lock qatal hai. Banane wala khud ada nahi karta.
-- ADDITIVE columns. Koi purani adaigi nahi mit-ti.

alter table public.payroll_runs add column if not exists pay_lock uuid;
alter table public.payroll_runs add column if not exists pay_lock_at timestamptz;

-- Read-only. Index se PEHLE ye ginti. Koi update nahi. 0 hona chahiye.
-- select pay_journal_id, count(*) as kitne
--   from public.payroll_runs
--  where pay_journal_id is not null
--  group by pay_journal_id
-- having count(*) > 1;
do $$
declare n int;
begin
  select count(*)::int into n from (
    select pay_journal_id
      from public.payroll_runs
     where pay_journal_id is not null
     group by pay_journal_id
    having count(*) > 1
  ) d;
  if n > 0 then
    raise exception 'pay_journal_id % dafa dohra hai. Index se pehle upar wali SELECT chalao. Koi raqam mat badlo.', n;
  end if;
end $$;

create unique index if not exists uq_payroll_pay_journal
  on public.payroll_runs (pay_journal_id)
  where pay_journal_id is not null;

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

revoke all on function public.fn_payroll_claim_pay(uuid) from public, anon;
revoke all on function public.fn_payroll_release_pay_lock(uuid) from public, anon;
grant execute on function public.fn_payroll_claim_pay(uuid) to authenticated;
grant execute on function public.fn_payroll_release_pay_lock(uuid) to authenticated;
