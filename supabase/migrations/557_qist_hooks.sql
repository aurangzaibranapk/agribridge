-- 557: Qist ko baqi nizam se jorna.
--  (a) Staff advance ada hua -> khud Qist Plan (tankhwah se, mahana).
--  (b) Har member ke liye qist ki halat ka view (overdue, wajib, ada).
-- Doodh / anaj / supplier / naqad adaigi ke waqt kattauti app (TS) se
-- fn_qist_apply ke zariye hoti hai. Additive.

create or replace function public.fn_qist_from_staff_advance()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_plan uuid; v_name text; v_i int; v_first date; v_amt numeric; v_last numeric;
begin
  if new.status <> 'paid' or old.status = 'paid' or new.qist_plan_id is not null then return new; end if;
  select full_name into v_name from public.profiles where id = new.profile_id;
  v_first := (make_date(new.first_year, new.first_month, 1) + interval '1 month - 1 day')::date;
  perform set_config('agribridge.qist_fn', 'on', true);
  insert into public.qist_plans (party_type, party_id, party_name, origin, origin_ref_table, origin_ref_id, total,
    installments_count, mode, frequency, deduct_source, start_date, status, created_by, submitted_at, approved_by, approved_at, notes)
  values ('staff', new.profile_id, v_name, 'advance', 'staff_advances', new.id, new.amount,
    new.installments, 'equal', 'monthly', 'salary', v_first, 'active', new.requested_by, new.created_at,
    new.approved_by, new.approved_at, new.reason)
  returning id into v_plan;
  v_amt := round(new.amount / new.installments, 0);
  for v_i in 1..new.installments loop
    v_last := case when v_i = new.installments then new.amount - v_amt * (new.installments - 1) else v_amt end;
    insert into public.qist_installments (plan_id, seq, due_date, period_start, period_end, amount_due)
    values (v_plan, v_i,
      (date_trunc('month', v_first) + make_interval(months => v_i - 1) + interval '1 month - 1 day')::date,
      (date_trunc('month', v_first) + make_interval(months => v_i - 1))::date,
      (date_trunc('month', v_first) + make_interval(months => v_i - 1) + interval '1 month - 1 day')::date,
      v_last);
  end loop;
  perform public.fn_qist_event(v_plan, 'created', 'Staff advance se', new.amount);
  perform public.fn_qist_event(v_plan, 'approved', 'Advance ki manzoori', new.amount);
  perform set_config('agribridge.qist_fn', 'off', true);
  new.qist_plan_id := v_plan;
  return new;
end $$;
drop trigger if exists trg_qist_from_staff_advance on public.staff_advances;
create trigger trg_qist_from_staff_advance before update on public.staff_advances
  for each row execute function public.fn_qist_from_staff_advance();
-- Trigger naam se pehle chalta hai (trg_guard... ke baad 'q' > 'g'): guard pehle,
-- phir ye. Dono BEFORE UPDATE; guard sirf setting dekhta hai.

-- Qiston ki halat (Pakistan ki aaj ki tareekh)
create or replace view public.v_qist_installment_status with (security_invoker = true) as
select i.id, i.plan_id, p.code, p.party_type, p.party_id, p.party_name, p.deduct_source, p.status as plan_status,
       i.seq, i.due_date, i.amount_due, i.amount_deducted, i.carried_out, i.is_carry, i.status,
       (i.amount_due - i.amount_deducted - i.carried_out) as remaining,
       case when i.status <> 'due' then i.status
            when i.due_date < (now() at time zone 'Asia/Karachi')::date then 'overdue'
            when i.due_date = (now() at time zone 'Asia/Karachi')::date then 'due_today'
            else 'upcoming' end as state,
       greatest((now() at time zone 'Asia/Karachi')::date - i.due_date, 0) as days_late
  from public.qist_installments i join public.qist_plans p on p.id = i.plan_id;

create or replace view public.v_qist_plan_summary with (security_invoker = true) as
select p.*, 
  coalesce((select sum(amount_deducted) from public.qist_installments i where i.plan_id = p.id), 0) as paid_amount,
  public.fn_qist_outstanding(p.id) as outstanding,
  (select min(due_date) from public.qist_installments i where i.plan_id = p.id and i.status = 'due') as next_due_date,
  (select count(*) from public.v_qist_installment_status s where s.plan_id = p.id and s.state = 'overdue') as overdue_count
from public.qist_plans p;

revoke all on public.v_qist_installment_status from anon;
revoke all on public.v_qist_plan_summary from anon;
grant select on public.v_qist_installment_status to authenticated;
grant select on public.v_qist_plan_summary to authenticated;
revoke execute on function public.fn_qist_from_staff_advance() from public, anon, authenticated;
