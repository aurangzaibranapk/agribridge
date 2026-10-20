-- 681 wapas: sirf UPDATE wala guard (593).

create or replace function public.fn_salary_payment_guard()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if coalesce(current_setting('agribridge.salary_pay_fn', true), '') = 'on'
     or coalesce(current_setting('agribridge.payroll_fn', true), '') = 'on' then
    return new;
  end if;
  if old.status = 'paid' then
    if new.status is distinct from old.status
       or new.profile_id is distinct from old.profile_id
       or new.pay_month is distinct from old.pay_month
       or new.pay_year is distinct from old.pay_year
       or new.basic_salary is distinct from old.basic_salary
       or new.bonus is distinct from old.bonus
       or new.deductions is distinct from old.deductions
       or new.advance_deduction is distinct from old.advance_deduction
       or new.net_salary is distinct from old.net_salary
       or new.paid_date is distinct from old.paid_date
       or new.paid_by is distinct from old.paid_by
       or new.paid_at is distinct from old.paid_at
       or new.pay_txn_id is distinct from old.pay_txn_id then
      raise exception 'Ye tankhwah pehle hi di ja chuki hai — ab badli ya dobara ada nahi ki ja sakti.';
    end if;
    return new;
  end if;
  if new.status = 'paid' then
    raise exception 'Tankhwah sirf "Ada karein" (fn_salary_payment_claim) se paid hoti hai.';
  end if;
  if new.paid_by is distinct from old.paid_by or new.paid_at is distinct from old.paid_at
     or new.pay_txn_id is distinct from old.pay_txn_id then
    raise exception 'Adaigi ke khane sirf adaigi ke waqt lagte hain.';
  end if;
  return new;
end $$;

drop trigger if exists trg_salary_payment_guard on public.salary_payments;
create trigger trg_salary_payment_guard
  before update on public.salary_payments
  for each row execute function public.fn_salary_payment_guard();
