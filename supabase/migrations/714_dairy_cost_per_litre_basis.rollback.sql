-- 714 rollback. fn_dairy_pnl_for aur fn_admin_dairy_totals wapas 577/578 par.
-- Lagat/L phir sirf ghar ke yield (dairy_milk_yields) se. Centre ignore.

create or replace function public.fn_dairy_pnl_for(p_farmer uuid, p_from date, p_to date, p_group text default 'month')
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare g text := case when p_group in ('week','month','day') then p_group else 'month' end;
  res jsonb := '[]'::jsonb; ps date; pe date; c record; e jsonb; inc jsonb; exp_t numeric; inc_t numeric; lit numeric; feed numeric; animals int;
begin
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 800 then raise exception 'Ghalat muddat'; end if;
  select count(*) into animals from dairy_animals where farmer_id = p_farmer and status not in ('sold','dead');
  ps := date_trunc(g, p_from)::date;
  while ps <= p_to loop
    pe := (date_trunc(g, ps) + ('1 ' || g)::interval - interval '1 day')::date;
    select * into c from fn_dairy_centre_for(p_farmer, greatest(ps, p_from), least(pe, p_to));
    select coalesce(jsonb_object_agg(category, amt), '{}'::jsonb), coalesce(sum(amt), 0),
           coalesce(sum(amt) filter (where category in ('chara','wanda','khal','tori','minerals')), 0)
      into e, exp_t, feed
      from (select category, sum(amount) amt from dairy_expenses where farmer_id = p_farmer and not voided
             and expense_date between greatest(ps, p_from) and least(pe, p_to) group by category) x;
    select jsonb_build_object('centre_milk', round(c.value, 2), 'centre_paid', round(c.paid, 2), 'centre_litres', c.litres)
           || coalesce((select jsonb_object_agg(kind, amt) from (select kind, sum(amount) amt from dairy_income where farmer_id = p_farmer and not voided
                and income_date between greatest(ps, p_from) and least(pe, p_to) group by kind) y), '{}'::jsonb)
      into inc;
    inc_t := round(c.value, 2) + coalesce((select sum(amount) from dairy_income where farmer_id = p_farmer and not voided
                and income_date between greatest(ps, p_from) and least(pe, p_to)), 0);
    select coalesce(sum(liters), 0) into lit from dairy_milk_yields where farmer_id = p_farmer and yield_date between greatest(ps, p_from) and least(pe, p_to);
    res := res || jsonb_build_object('period', ps, 'period_end', least(pe, p_to), 'income', inc, 'income_total', inc_t,
      'expense', e, 'expense_total', exp_t, 'profit', inc_t - exp_t, 'litres', lit,
      'cost_per_litre', case when lit > 0 then round(exp_t / lit, 2) end,
      'feed_per_animal', case when animals > 0 then round(feed / animals, 2) end, 'animals', animals);
    ps := (date_trunc(g, ps) + ('1 ' || g)::interval)::date;
  end loop;
  return res;
end $$;
revoke all on function public.fn_dairy_pnl_for(uuid, date, date, text) from public, anon, authenticated;

drop function if exists public.fn_admin_dairy_totals(date, date);
create function public.fn_admin_dairy_totals(p_from date, p_to date)
returns table (farmer_id uuid, farmer_code text, full_name text, village text, customer_name text, animals int, milking int,
               litres numeric, centre_litres numeric, expense numeric, income numeric, profit numeric, cost_per_litre numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.fn_dairy_is_admin() then raise exception 'Sirf Admin / Owner'; end if;
  if p_from is null or p_to is null or p_to < p_from then raise exception 'Ghalat muddat'; end if;
  return query
  with f as (
    select distinct x.fid from (
      select a.farmer_id fid from dairy_animals a
      union select e.farmer_id from dairy_expenses e where e.expense_date between p_from and p_to
      union select i.farmer_id from dairy_income i where i.income_date between p_from and p_to
    ) x
  ), t as (
    select f.fid,
      (select count(*)::int from dairy_animals a where a.farmer_id = f.fid and a.status not in ('sold','dead')) an,
      (select count(*)::int from dairy_animals a where a.farmer_id = f.fid and a.status in ('milking','pregnant')) mk,
      (select coalesce(sum(y.liters),0) from dairy_milk_yields y where y.farmer_id = f.fid and y.yield_date between p_from and p_to) lit,
      c.litres cl, c.value cv,
      (select coalesce(sum(e.amount),0) from dairy_expenses e where e.farmer_id = f.fid and not e.voided and e.expense_date between p_from and p_to) ex,
      (select coalesce(sum(i.amount),0) from dairy_income i where i.farmer_id = f.fid and not i.voided and i.income_date between p_from and p_to) oi
    from f cross join lateral public.fn_dairy_centre_for(f.fid, p_from, p_to) c
  )
  select t.fid, fr.farmer_code, fr.full_name, fr.village,
         (select cu.name from customers cu where cu.farmer_id = t.fid order by cu.name limit 1),
         t.an, t.mk, t.lit, t.cl, t.ex, round(t.cv + t.oi, 2), round(t.cv + t.oi - t.ex, 2),
         case when t.lit > 0 then round(t.ex / t.lit, 2) end
    from t join farmers fr on fr.id = t.fid
   order by fr.farmer_code;
end $$;
revoke all on function public.fn_admin_dairy_totals(date, date) from public, anon;
grant execute on function public.fn_admin_dairy_totals(date, date) to authenticated;
