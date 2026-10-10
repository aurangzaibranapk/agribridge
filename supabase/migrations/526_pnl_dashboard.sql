-- 526: Profit & Loss dashboard (read-only views + functions). Additive only.
-- Not applied automatically. Run manually after a backup.

create or replace function public.pnl_department(p_module text)
returns text language sql immutable as $$
  select case
    when p_module is null then 'Rent/Other'
    when p_module like 'grain%' then 'Grain'
    when p_module like 'milk%' or p_module like 'dairy%' then 'Milk/Dairy'
    when p_module like 'agri%' or p_module in ('farmer_credit','branch_credit') then 'Agri'
    when p_module like 'pos%' or p_module like 'stock_%' or p_module in ('reconciliation','load_bill','customer_udhaar') then 'Karyana POS'
    else 'Rent/Other' end
$$;

create or replace function public.pnl_expense_group(p_code text)
returns text language sql immutable as $$
  select case
    when p_code in ('6000','6015') then 'Staff'
    when p_code in ('6010','6020','6050') then 'Vehicle & Fuel'
    when p_code in ('6030','6040') then 'Rent & Utilities'
    when p_code between '6100' and '6130' then 'Losses & Differences'
    when p_code between '6200' and '6220' then 'Assets'
    when p_code like '6%' then 'Other'
    else null end
$$;

create or replace view public.v_pnl_lines with (security_invoker = true) as
select jl.id as line_id, je.id as entry_id, je.entry_number, je.entry_date, je.branch_id,
       je.source_module, public.pnl_department(je.source_module) as department,
       jl.account_code, ga.name as account_name,
       case when jl.account_code like '4%' then 'revenue'
            when jl.account_code like '5%' then 'cogs'
            when jl.account_code = '6110' then 'stock_adjustment'
            else 'expense' end as kind,
       public.pnl_expense_group(jl.account_code) as expense_group,
       -- positive = good for revenue, positive = cost for cogs/expenses
       case when jl.account_code like '4%' then coalesce(jl.credit,0) - coalesce(jl.debit,0)
            else coalesce(jl.debit,0) - coalesce(jl.credit,0) end as amount
from public.journal_lines jl
join public.journal_entries je on je.id = jl.entry_id
left join public.gl_accounts ga on ga.code = jl.account_code
where jl.account_code ~ '^[456]';

create or replace function public.fn_pnl_summary(p_from date, p_to date, p_branch uuid default null, p_dept text default null)
returns table(period text, revenue numeric, cogs numeric, gross_profit numeric, operating_expenses numeric,
              stock_adjustments numeric, total_expenses numeric, net_profit numeric)
language sql stable security invoker as $$
  with periods as (
    select 'current'::text as period, p_from as f, p_to as t
    union all
    select 'previous', (p_from - (p_to - p_from + 1))::date, (p_from - 1)::date
  ), agg as (
    select pr.period,
      coalesce(sum(l.amount) filter (where l.kind='revenue'),0) rev,
      coalesce(sum(l.amount) filter (where l.kind='cogs'),0) cg,
      coalesce(sum(l.amount) filter (where l.kind='expense'),0) opx,
      coalesce(sum(l.amount) filter (where l.kind='stock_adjustment'),0) adj
    from periods pr
    left join public.v_pnl_lines l on l.entry_date between pr.f and pr.t
      and (p_branch is null or l.branch_id = p_branch)
      and (p_dept is null or l.department = p_dept)
    group by pr.period
  )
  select period, round(rev,2), round(cg,2), round(rev-cg,2), round(opx,2), round(adj,2),
         round(opx+adj,2), round(rev-cg-opx-adj,2)
  from agg order by period;
$$;

create or replace function public.fn_pnl_trend(p_from date, p_to date, p_grain text default 'day', p_branch uuid default null)
returns table(bucket date, revenue numeric, cogs numeric, expenses numeric, net_profit numeric)
language sql stable security invoker as $$
  select date_trunc(case when p_grain='month' then 'month' else 'day' end, l.entry_date)::date,
    round(coalesce(sum(amount) filter (where kind='revenue'),0),2),
    round(coalesce(sum(amount) filter (where kind='cogs'),0),2),
    round(coalesce(sum(amount) filter (where kind in ('expense','stock_adjustment')),0),2),
    round(coalesce(sum(case when kind='revenue' then amount else -amount end),0),2)
  from public.v_pnl_lines l
  where l.entry_date between p_from and p_to and (p_branch is null or l.branch_id = p_branch)
  group by 1 order by 1;
$$;

create or replace function public.fn_pnl_expense_breakdown(p_from date, p_to date, p_branch uuid default null)
returns table(expense_group text, amount numeric)
language sql stable security invoker as $$
  select case when kind='stock_adjustment' then 'Stock Count Adjustments' else expense_group end,
         round(sum(amount),2)
  from public.v_pnl_lines
  where kind in ('expense','stock_adjustment') and entry_date between p_from and p_to
    and (p_branch is null or branch_id = p_branch)
  group by 1 having round(sum(amount),2) <> 0 order by 2 desc;
$$;

create or replace function public.fn_pnl_top_products(p_from date, p_to date, p_branch uuid default null, p_limit int default 20)
returns table(product_id uuid, product_name text, qty numeric, revenue numeric, cogs numeric, profit numeric,
              margin_pct numeric, cost_above_price_lines int)
language sql stable security invoker as $$
  select i.product_id, max(p.name), sum(i.quantity), round(sum(i.subtotal),2), round(sum(coalesce(i.line_cogs,0)),2),
         round(sum(i.subtotal - coalesce(i.line_cogs,0)),2),
         case when sum(i.subtotal) = 0 then null
              else round(100 * sum(i.subtotal - coalesce(i.line_cogs,0)) / sum(i.subtotal), 1) end,
         count(*) filter (where coalesce(i.line_cogs,0) > i.subtotal)::int
  from public.pos_sale_items i
  join public.pos_sales s on s.id = i.sale_id
  left join public.products p on p.id = i.product_id
  where (s.created_at at time zone 'Asia/Karachi')::date between p_from and p_to
    and coalesce(s.status,'completed') not in ('voided','cancelled','void')
    and (p_branch is null or s.branch_id = p_branch)
  group by i.product_id order by 6 desc limit p_limit;
$$;

create or replace function public.fn_pnl_by_department(p_from date, p_to date, p_branch uuid default null)
returns table(department text, revenue numeric, cogs numeric, gross_profit numeric, expenses numeric, net_profit numeric, margin_pct numeric)
language sql stable security invoker as $$
  select department,
    round(coalesce(sum(amount) filter (where kind='revenue'),0),2) r,
    round(coalesce(sum(amount) filter (where kind='cogs'),0),2) c,
    round(coalesce(sum(amount) filter (where kind='revenue'),0) - coalesce(sum(amount) filter (where kind='cogs'),0),2),
    round(coalesce(sum(amount) filter (where kind in ('expense','stock_adjustment')),0),2),
    round(sum(case when kind='revenue' then amount else -amount end),2),
    case when coalesce(sum(amount) filter (where kind='revenue'),0) = 0 then null
      else round(100*sum(case when kind='revenue' then amount else -amount end)/sum(amount) filter (where kind='revenue'),1) end
  from public.v_pnl_lines
  where entry_date between p_from and p_to and (p_branch is null or branch_id = p_branch)
  group by department order by 6 desc;
$$;

create or replace view public.v_pnl_data_health with (security_invoker = true) as
select 'cost_above_price'::text as issue, count(*)::numeric as count,
       coalesce(sum(coalesce(i.line_cogs,0) - i.subtotal),0) as amount, '/admin/reports/sales'::text as link
from public.pos_sale_items i where coalesce(i.line_cogs,0) > i.subtotal and i.subtotal > 0
union all
select 'grain_procurement_no_journal', count(*), coalesce(sum(e.total_amount),0), '/admin/grain'
from public.grain_procurement_entries e
where not exists (select 1 from public.journal_entries j where j.source_module like 'grain%' and j.source_id = e.id)
union all
select 'grain_payment_no_journal', count(*), coalesce(sum(amount),0), '/admin/grain'
from public.grain_procurement_payments where journal_entry_id is null
union all
select 'stock_adjustment_share_pct',
       count(*) filter (where kind='stock_adjustment'),
       case when coalesce(sum(amount) filter (where kind in ('expense','stock_adjustment')),0) = 0 then 0
            else round(100*coalesce(sum(amount) filter (where kind='stock_adjustment'),0)
                 / sum(amount) filter (where kind in ('expense','stock_adjustment')),1) end,
       '/admin/reports/stock-reconcile'
from public.v_pnl_lines where entry_date >= date_trunc('month', current_date)::date;

grant execute on function public.fn_pnl_summary(date,date,uuid,text), public.fn_pnl_trend(date,date,text,uuid),
  public.fn_pnl_expense_breakdown(date,date,uuid), public.fn_pnl_top_products(date,date,uuid,int),
  public.fn_pnl_by_department(date,date,uuid) to authenticated;
grant select on public.v_pnl_lines, public.v_pnl_data_health to authenticated;
