-- =====================================================================
-- 655: Mahine ka Wasela bill — SQL mein jama, 1000 ki hadd nahi
-- =====================================================================
-- Kamai = company ne jitne litre mane (milk_dispatches.received_liters)
-- × service rate. Rejected / pending doodh is bill mein nahi.
-- Petrol, generator aur maintenance sirf approved. Branch ka petrol
-- vehicles.branch_id se SQL mein chhanta hai.

alter table public.vehicles add column if not exists branch_id uuid;

create or replace function public.fn_dairy_month_pnl(p_year integer, p_month integer, p_branch uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_start date;
  v_end date;
  v_company text;
  v_service numeric;
  v_rate numeric;
  v_accepted numeric;
  v_petrol numeric;
  v_diesel numeric;
  v_maint numeric;
  v_shortage numeric;
  v_salary numeric := 0;
  v_electric numeric;
  v_chiller numeric;
begin
  if p_month is null or p_month < 1 or p_month > 12 or p_year is null then
    raise exception 'Mahina ya saal sahi nahi.';
  end if;
  v_start := make_date(p_year, p_month, 1);
  v_end := (v_start + interval '1 month' - interval '1 day')::date;

  select s.company_name, s.service_rate_per_liter
    into v_company, v_service
  from public.company_billing_settings s
  limit 1;
  if v_service is null or v_service <= 0 then
    raise exception 'Service rate settings mein nahi. Andaza nahi lagate.';
  end if;

  select s.standard_rate into v_rate from public.milk_rate_settings s limit 1;
  if v_rate is null or v_rate <= 0 then
    raise exception 'Doodh ka rate settings mein nahi. Andaza nahi lagate.';
  end if;

  select coalesce(sum(d.received_liters), 0) into v_accepted
  from public.milk_dispatches d
  where d.dispatch_date between v_start and v_end
    and d.received_liters is not null
    and (p_branch is null or d.branch_id = p_branch);

  select coalesce(sum(f.fuel_cost), 0) into v_petrol
  from public.fuel_logs f
  left join public.vehicles v on v.id = f.vehicle_id
  where f.log_date between v_start and v_end
    and f.approval_status = 'approved'
    and (p_branch is null or v.branch_id = p_branch);

  select coalesce(sum(g.diesel_cost), 0) into v_diesel
  from public.generator_logs g
  where g.log_date between v_start and v_end
    and g.approval_status = 'approved'
    and (p_branch is null or g.branch_id = p_branch);

  select coalesce(sum(m.cost), 0) into v_maint
  from public.maintenance_logs m
  where m.service_date between v_start and v_end
    and m.status = 'approved'
    and (p_branch is null or m.branch_id = p_branch);

  select coalesce(sum(greatest(r.shortage_liters, 0)), 0) into v_shortage
  from public.milk_route_collections r
  where r.collection_date between v_start and v_end
    and (p_branch is null or r.branch_id = p_branch);

  if p_branch is null then
    select coalesce(sum(sp.net_salary), 0) into v_salary
    from public.salary_payments sp
    where sp.pay_month = p_month and sp.pay_year = p_year;
  end if;

  select coalesce(sum(e.amount) filter (where e.category = 'electricity'), 0),
         coalesce(sum(e.amount) filter (where e.category = 'chiller_maintenance'), 0)
    into v_electric, v_chiller
  from public.monthly_expenses e
  where e.expense_month = p_month and e.expense_year = p_year
    and (p_branch is null or e.branch_id = p_branch);

  return jsonb_build_object(
    'company_name', coalesce(v_company, 'Wasela Pakistan'),
    'service_rate', v_service,
    'accepted_liters', v_accepted,
    'gross_income', round(v_accepted * v_service, 2),
    'staff_salaries', v_salary,
    'petrol_cost', v_petrol,
    'diesel_cost', v_diesel,
    'maintenance_cost', v_maint,
    'shortage_liters', v_shortage,
    'standard_rate', v_rate,
    'shortage_loss', round(v_shortage * v_rate, 2),
    'electricity', v_electric,
    'chiller_maintenance', v_chiller
  );
end $$;

revoke all on function public.fn_dairy_month_pnl(integer, integer, uuid) from public, anon, authenticated;
do $g$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.fn_dairy_month_pnl(integer, integer, uuid) to service_role;
  end if;
end
$g$;

comment on function public.fn_dairy_month_pnl(integer, integer, uuid) is
  'Wasela mahina: company ke mane litre, sirf approved kharcha. JS ki 1000 qatar ki hadd nahi (655).';
