-- =====================================================================
-- AgriBridge — Migration 593: Tankhwah sirf ek dafa ada (B1)
-- =====================================================================
-- HR audit (B1): markSalaryPaid pehle row parhta, phir cash book +
-- ledger likhta, aur aakhir mein BINA status ki shart ke 'paid' lagata.
-- Do dafa button dabane (ya do tab) par dono "pending" dekhte, dono
-- paisa nikalte -- tankhwah do dafa.
--
-- Ab tankhwah pehle "claim" hoti hai, ek hi SQL mein:
--     update ... set status='paid' where id = ? and status <> 'paid'
-- Jo pehle pahuncha wo jeeta; doosre ko saaf error milta hai
-- ("pehle hi di ja chuki hai") aur us ka koi paisa nahi nikalta.
-- Cash book/ledger fail ho to wohi Admin (15 minute ke andar, aur jab
-- cash book ki qatar hat chuki ho) claim wapas le sakta hai.
--
-- Aur: paid tankhwah ki raqam/status ab chup chaap nahi badalti. 'paid'
-- sirf in functions (ya payroll run, 553) se lagta hai.
-- Additive: naye khaane paid_by, paid_at, pay_txn_id. Purana data waisa.
-- Rollback: supabase/rollbacks/593_*.sql
-- =====================================================================

alter table public.salary_payments
  add column if not exists paid_by uuid references public.profiles(id),
  add column if not exists paid_at timestamptz,
  add column if not exists pay_txn_id uuid;

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
    -- notes jaise khaane chal sakte hain
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
end;
$$;

drop trigger if exists trg_salary_payment_guard on public.salary_payments;
create trigger trg_salary_payment_guard
  before update on public.salary_payments
  for each row execute function public.fn_salary_payment_guard();

-- ---------------------------------------------------------------------
-- Claim: ek hi dafa
-- ---------------------------------------------------------------------
create or replace function public.fn_salary_payment_claim(p_payment uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
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
  get diagnostics v_n = row_count;   -- FOUND ko neeche wala PERFORM badal deta hai
  perform set_config('agribridge.salary_pay_fn', 'off', true);

  if v_n = 0 then
    raise exception 'Ye tankhwah pehle hi di ja chuki hai.' using errcode = 'P0001', hint = 'already_paid';
  end if;

  return jsonb_build_object(
    'id', r.id, 'profile_id', r.profile_id, 'net_salary', r.net_salary,
    'advance_deduction', r.advance_deduction, 'pay_month', r.pay_month, 'pay_year', r.pay_year);
end;
$$;

-- Cash book ki qatar ka hawala (claim karne wala hi, ek dafa)
create or replace function public.fn_salary_payment_attach_txn(p_payment uuid, p_txn uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_n int;
begin
  perform set_config('agribridge.salary_pay_fn', 'on', true);
  update public.salary_payments set pay_txn_id = p_txn
   where id = p_payment and status = 'paid' and paid_by = auth.uid() and pay_txn_id is null;
  get diagnostics v_n = row_count;
  perform set_config('agribridge.salary_pay_fn', 'off', true);
  if v_n = 0 then raise exception 'Is tankhwah par cash book ka hawala nahi lag sakta.'; end if;
end;
$$;

-- Claim wapas: sirf jab cash book/ledger fail hua ho
create or replace function public.fn_salary_payment_unclaim(p_payment uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
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
end;
$$;

revoke execute on function public.fn_salary_payment_claim(uuid) from public, anon;
revoke execute on function public.fn_salary_payment_attach_txn(uuid, uuid) from public, anon;
revoke execute on function public.fn_salary_payment_unclaim(uuid) from public, anon;
grant execute on function public.fn_salary_payment_claim(uuid) to authenticated, service_role;
grant execute on function public.fn_salary_payment_attach_txn(uuid, uuid) to authenticated, service_role;
grant execute on function public.fn_salary_payment_unclaim(uuid) to authenticated, service_role;

comment on function public.fn_salary_payment_claim(uuid) is
  'Tankhwah ek hi dafa: status <> paid ki shart ke saath claim. Dobara par error (593).';
