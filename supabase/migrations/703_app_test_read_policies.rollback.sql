-- 703 rollback. FILE ONLY. Live par mat chalana.
-- Policies aur is_test columns hataata hai. fn_staff_advance_eligibility 552 jaisi wapas.
-- staff_advances ka SELECT grant jo 703 ne diya, wapas le leta hai.

drop policy if exists activity_logs_test_read on public.activity_logs;
drop policy if exists salary_payments_test_read on public.salary_payments;
drop policy if exists purchases_test_read on public.purchases;
drop policy if exists finance_accounts_test_read on public.finance_accounts;
drop policy if exists inventory_test_read on public.inventory;
drop policy if exists pos_sale_items_test_read on public.pos_sale_items;
drop policy if exists pos_sales_test_read on public.pos_sales;

drop index if exists public.activity_logs_is_test_idx;
drop index if exists public.salary_payments_is_test_idx;
drop index if exists public.purchases_is_test_idx;
drop index if exists public.finance_accounts_is_test_idx;
drop index if exists public.inventory_is_test_idx;
drop index if exists public.pos_sales_is_test_idx;

alter table public.activity_logs drop column if exists is_test;
alter table public.salary_payments drop column if exists is_test;
alter table public.purchases drop column if exists is_test;
alter table public.finance_accounts drop column if exists is_test;
alter table public.inventory drop column if exists is_test;
alter table public.pos_sales drop column if exists is_test;

revoke select on table public.staff_advances from authenticated;

create or replace function public.fn_staff_advance_eligibility(p_profile uuid, p_amount numeric, p_installments int)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_set public.hr_payroll_settings;
  v_start date; v_months int; v_basic numeric; v_open int; v_inst numeric;
  v_reasons text[] := '{}'; v_hire date;
begin
  select * into v_set from public.hr_payroll_settings where id = 1;
  select hire_date into v_hire from public.staff_details where profile_id = p_profile;
  v_start := public.fn_staff_service_start(p_profile);
  v_months := case when v_start is null then null
    else (extract(year from age(current_date, v_start)) * 12 + extract(month from age(current_date, v_start)))::int end;
  select basic into v_basic from public.fn_salary_structure_as_of(p_profile, current_date);
  select count(*) into v_open from public.staff_advances
   where profile_id = p_profile and status in ('requested','approved','paid');
  v_inst := case when coalesce(p_installments,0) > 0 then round(p_amount / p_installments, 0) else null end;

  if v_start is null then v_reasons := v_reasons || 'Joining date system mein nahi -- HR pehle hire date darj kare.';
  elsif v_months < v_set.advance_min_service_months then
    v_reasons := v_reasons || format('Advance %s mahine ki mulazmat ke baad milta hai -- abhi %s din baqi.',
      v_set.advance_min_service_months, ((v_start + make_interval(months => v_set.advance_min_service_months))::date - current_date));
  end if;
  if v_open > 0 then v_reasons := v_reasons || 'Pehle wala advance abhi khula hai.'; end if;
  if v_basic is null then v_reasons := v_reasons || 'Manzoor shuda salary structure nahi.'; end if;
  if v_set.advance_cap_pct is not null and v_basic is not null and v_inst is not null
     and v_inst > round(v_basic * v_set.advance_cap_pct / 100, 0) then
    v_reasons := v_reasons || format('Qist Rs %s basic ke %s%% (Rs %s) se zyada hai.', v_inst, v_set.advance_cap_pct, round(v_basic * v_set.advance_cap_pct / 100, 0));
  end if;
  return jsonb_build_object(
    'eligible', cardinality(v_reasons) = 0,
    'service_start', v_start, 'service_start_is_probation', v_hire is null and v_start is not null,
    'service_months', v_months, 'min_months', v_set.advance_min_service_months,
    'open_advances', v_open, 'basic', v_basic, 'installment', v_inst,
    'cap_pct', v_set.advance_cap_pct, 'reasons', to_jsonb(v_reasons));
end $$;
