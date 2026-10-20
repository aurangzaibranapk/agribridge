-- 681: N4 salary_payments INSERT guard. N7 banane wala khud ada nahi karta.
-- Seedha status='paid' ya apni tankhwah insert nahi. Sifar/manfi net nahi.
-- Additive. Purani paid qatarein nahi badalti.

create or replace function public.fn_salary_payment_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(current_setting('agribridge.salary_pay_fn', true), '') = 'on'
     or coalesce(current_setting('agribridge.payroll_fn', true), '') = 'on' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if auth.uid() is not null and new.profile_id = auth.uid() then
      raise exception 'Apni tankhwah khud nahi likhi ja sakti.';
    end if;
    if new.created_by is null then
      new.created_by := auth.uid();
    end if;
    if new.status = 'paid' or new.paid_by is not null or new.paid_at is not null or new.pay_txn_id is not null then
      raise exception 'Tankhwah seedha paid nahi daali ja sakti. Pehle pending, phir Ada karein.';
    end if;
    if new.net_salary is null or new.net_salary <= 0
       or coalesce(new.basic_salary, 0) < 0
       or coalesce(new.bonus, 0) < 0
       or coalesce(new.deductions, 0) < 0
       or coalesce(new.advance_deduction, 0) < 0 then
      raise exception 'Tankhwah ka adad manfi ya sifar nahi ho sakta.';
    end if;
    if exists (
      select 1 from public.salary_period_pays sp
       where sp.profile_id = new.profile_id and sp.pay_year = new.pay_year and sp.pay_month = new.pay_month
    ) then
      raise exception 'Is mahine ki tankhwah is bande ko pehle di ja chuki hai. Dobara ada nahi hogi.';
    end if;
    new.status := 'pending';
    new.paid_by := null;
    new.paid_at := null;
    new.pay_txn_id := null;
    return new;
  end if;

  if new.created_by is distinct from old.created_by then
    raise exception 'Banane wala badla nahi ja sakta.';
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
  if new.net_salary is null or new.net_salary <= 0
     or coalesce(new.basic_salary, 0) < 0
     or coalesce(new.bonus, 0) < 0
     or coalesce(new.deductions, 0) < 0
     or coalesce(new.advance_deduction, 0) < 0 then
    raise exception 'Tankhwah ka adad manfi ya sifar nahi ho sakta.';
  end if;
  if auth.uid() is not null and new.profile_id = auth.uid() then
    raise exception 'Apni tankhwah khud nahi badli ja sakti.';
  end if;
  return new;
end $$;

drop trigger if exists trg_salary_payment_guard on public.salary_payments;
create trigger trg_salary_payment_guard
  before insert or update on public.salary_payments
  for each row execute function public.fn_salary_payment_guard();
