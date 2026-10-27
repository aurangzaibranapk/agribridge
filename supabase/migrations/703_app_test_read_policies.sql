-- 703: TEST home reads. FILE ONLY — Live par mat chalana.
-- Testing project par owner chalaye. Is file ne khud SQL nahi chalayi.
-- is_test default false. Purani qatarein is_test nahi ki jaati. Koi mass update nahi.
-- pos_sale_items par is_test column nahi. Policy parent pos_sales se.
-- fn_staff_advance_eligibility pehle se maujood hai. Naya function nahi.
-- text || text[] "malformed array literal" deta tha. Ab array_append.

alter table public.pos_sales add column if not exists is_test boolean not null default false;
alter table public.inventory add column if not exists is_test boolean not null default false;
alter table public.finance_accounts add column if not exists is_test boolean not null default false;
alter table public.purchases add column if not exists is_test boolean not null default false;
alter table public.salary_payments add column if not exists is_test boolean not null default false;
alter table public.activity_logs add column if not exists is_test boolean not null default false;

comment on column public.pos_sales.is_test is
  'TEST bill. Mobile test login sirf is_test = true parhta hai.';
comment on column public.inventory.is_test is
  'TEST stock. Purani qatarein default false rehti hain.';
comment on column public.finance_accounts.is_test is
  'TEST cash/bank. Default false. Koi purana account is_test nahi hota.';
comment on column public.purchases.is_test is
  'TEST khareed. Default false.';
comment on column public.salary_payments.is_test is
  'TEST tankhwah. Sirf apni profile_id.';
comment on column public.activity_logs.is_test is
  'TEST activity. Purane logs default false. Unhein is_test nahi banaya.';

create index if not exists pos_sales_is_test_idx on public.pos_sales (created_at) where is_test;
create index if not exists inventory_is_test_idx on public.inventory (product_id) where is_test;
create index if not exists finance_accounts_is_test_idx on public.finance_accounts (id) where is_test;
create index if not exists purchases_is_test_idx on public.purchases (purchase_date) where is_test;
create index if not exists salary_payments_is_test_idx on public.salary_payments (profile_id, pay_year, pay_month) where is_test;
create index if not exists activity_logs_is_test_idx on public.activity_logs (created_at) where is_test;

drop policy if exists pos_sales_test_read on public.pos_sales;
create policy pos_sales_test_read on public.pos_sales
  for select to authenticated
  using (is_test and (select public.fn_is_app_test_account()));

drop policy if exists pos_sale_items_test_read on public.pos_sale_items;
create policy pos_sale_items_test_read on public.pos_sale_items
  for select to authenticated
  using (
    (select public.fn_is_app_test_account())
    and exists (
      select 1 from public.pos_sales s
      where s.id = pos_sale_items.sale_id and s.is_test
    )
  );

drop policy if exists inventory_test_read on public.inventory;
create policy inventory_test_read on public.inventory
  for select to authenticated
  using (is_test and (select public.fn_is_app_test_account()));

drop policy if exists finance_accounts_test_read on public.finance_accounts;
create policy finance_accounts_test_read on public.finance_accounts
  for select to authenticated
  using (is_test and (select public.fn_is_app_test_account()));

drop policy if exists purchases_test_read on public.purchases;
create policy purchases_test_read on public.purchases
  for select to authenticated
  using (is_test and (select public.fn_is_app_test_account()));

drop policy if exists salary_payments_test_read on public.salary_payments;
create policy salary_payments_test_read on public.salary_payments
  for select to authenticated
  using (
    is_test
    and profile_id = (select auth.uid())
    and (select public.fn_is_app_test_account())
  );

drop policy if exists activity_logs_test_read on public.activity_logs;
create policy activity_logs_test_read on public.activity_logs
  for select to authenticated
  using (is_test and (select public.fn_is_app_test_account()));

-- 403: authenticated ke paas SELECT grant nahi tha. RLS policy pehle se apni rows par hai.
grant select on table public.staff_advances to authenticated;

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

  if v_start is null then v_reasons := array_append(v_reasons, 'Joining date system mein nahi -- HR pehle hire date darj kare.');
  elsif v_months < v_set.advance_min_service_months then
    v_reasons := array_append(v_reasons, format('Advance %s mahine ki mulazmat ke baad milta hai -- abhi %s din baqi.',
      v_set.advance_min_service_months, ((v_start + make_interval(months => v_set.advance_min_service_months))::date - current_date)));
  end if;
  if v_open > 0 then v_reasons := array_append(v_reasons, 'Pehle wala advance abhi khula hai.'); end if;
  if v_basic is null then v_reasons := array_append(v_reasons, 'Manzoor shuda salary structure nahi.'); end if;
  if v_set.advance_cap_pct is not null and v_basic is not null and v_inst is not null
     and v_inst > round(v_basic * v_set.advance_cap_pct / 100, 0) then
    v_reasons := array_append(v_reasons, format('Qist Rs %s basic ke %s%% (Rs %s) se zyada hai.', v_inst, v_set.advance_cap_pct, round(v_basic * v_set.advance_cap_pct / 100, 0)));
  end if;
  return jsonb_build_object(
    'eligible', cardinality(v_reasons) = 0,
    'service_start', v_start, 'service_start_is_probation', v_hire is null and v_start is not null,
    'service_months', v_months, 'min_months', v_set.advance_min_service_months,
    'open_advances', v_open, 'basic', v_basic, 'installment', v_inst,
    'cap_pct', v_set.advance_cap_pct, 'reasons', to_jsonb(v_reasons));
end $$;
