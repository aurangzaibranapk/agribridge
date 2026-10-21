-- 691 rollback: sab kuch wapas. Naye columns ka data mit jayega (backup pehle).
delete from public.dashboard_features where feature_key = 'hr.increments';
delete from public.features where key = 'hr.increments';

drop function if exists public.fn_verify_salary_slip(text);
drop function if exists public.fn_salary_slip(uuid);
drop function if exists public.fn_mask_account(text);
drop function if exists public.fn_payroll_line_set_payment(uuid, text, text, timestamptz);
drop trigger if exists trg_payroll_line_slip_no on public.payroll_lines;
drop function if exists public.fn_payroll_line_slip_no();
drop index if exists public.uq_payroll_lines_slip_no;
drop index if exists public.uq_payroll_lines_verify_code;
alter table public.payroll_lines drop column if exists pay_ref, drop column if exists pay_method,
  drop column if exists paid_at, drop column if exists verify_code, drop column if exists slip_no;
drop sequence if exists public.payroll_slip_seq;
drop function if exists public.fn_new_verify_code();

drop view if exists public.v_upcoming_increments;
drop function if exists public.fn_salary_structure_from_offer(uuid, uuid, date);
drop trigger if exists trg_salary_structure_next_due on public.staff_salary_structures;
drop function if exists public.fn_salary_structure_next_due();
drop trigger if exists trg_salary_structure_increment_fill on public.staff_salary_structures;
drop function if exists public.fn_salary_structure_increment_fill();
alter table public.staff_salary_structures drop column if exists increment_pct, drop column if exists increment_amount,
  drop column if exists prev_structure_id, drop column if exists change_reason, drop column if exists source_offer_id;

drop trigger if exists trg_staff_details_offer_self_guard on public.staff_details;
drop function if exists public.fn_staff_details_offer_self_guard();
alter table public.staff_details drop column if exists next_increment_due, drop column if exists department,
  drop column if exists bank_name, drop column if exists father_name, drop column if exists application_id,
  drop column if exists offer_id;

drop policy if exists job_offers_hr_update on public.job_offers;
drop policy if exists job_offers_hr_insert on public.job_offers;
drop policy if exists job_offers_hr_read on public.job_offers;
drop table if exists public.job_offer_events;
drop function if exists public.fn_guard_job_offer_events();
drop trigger if exists trg_job_offer_status_event on public.job_offers;
drop function if exists public.fn_job_offer_status_event();
drop function if exists public.fn_job_offer_total(public.job_offers);

-- Naye status wali offers ko purane teen mein le aayen, phir purana check.
update public.job_offers set status = 'pending' where status = 'countered';
update public.job_offers set status = 'rejected' where status = 'withdrawn';
alter table public.job_offers drop constraint if exists job_offers_status_check;
alter table public.job_offers add constraint job_offers_status_check check (status in ('pending','accepted','rejected'));
alter table public.job_offers drop column if exists created_by, drop column if exists superseded_by,
  drop column if exists accepted_at, drop column if exists accepted_total, drop column if exists joining_date,
  drop column if exists probation_months, drop column if exists incentive_rule, drop column if exists incentive_pct,
  drop column if exists bonus, drop column if exists mobile, drop column if exists travel,
  drop column if exists house_rent, drop column if exists basic;
drop function if exists public.fn_hr_offer_writer();
