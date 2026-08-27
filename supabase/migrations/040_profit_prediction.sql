-- =====================================================================
-- AgriBridge — Migration 040: Profit Prediction (Platform-Wide Benchmarks)
-- =====================================================================
-- Before sowing, a farmer should see an estimated cost/yield/profit
-- for a crop, based on everyone's historical data (not just their own
-- - a new farmer needs this too). SECURITY DEFINER bypasses per-farmer
-- RLS since it only ever returns aggregate numbers, never row-level
-- data tied to a specific farmer.

create or replace function fn_crop_profit_benchmarks()
returns table(
  crop_name text,
  avg_cost_per_acre numeric,
  avg_yield_per_acre numeric,
  avg_sale_rate numeric,
  sample_count bigint
)
language sql
security definer
set search_path = public
as $$
  select
    ch.crop_name,
    avg(coalesce(ce_total.total_expense, 0) / ch.area_sown_acres) as avg_cost_per_acre,
    avg(hr.quantity_harvested / ch.area_sown_acres) as avg_yield_per_acre,
    avg(hr.sale_rate) filter (where hr.sale_rate is not null) as avg_sale_rate,
    count(*) as sample_count
  from crop_history ch
  join harvest_records hr on hr.crop_history_id = ch.id
  left join (
    select crop_history_id, sum(amount) as total_expense
    from crop_expenses
    group by crop_history_id
  ) ce_total on ce_total.crop_history_id = ch.id
  where ch.area_sown_acres > 0 and hr.quantity_harvested > 0
  group by ch.crop_name;
$$;

grant execute on function fn_crop_profit_benchmarks() to authenticated;