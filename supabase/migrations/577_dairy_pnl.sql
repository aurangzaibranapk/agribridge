-- 577: Dairy munafa/nuqsan (P&L) -- read-only, sirf apna.
-- Har period: aamdani (centre ERP + ghar ka doodh + janwar bikri + deegar), kharcha category war,
-- munafa, litre (ghar ka record), lagat/litre, khurak/janwar.
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

create or replace function public.fn_my_dairy_pnl(p_from date, p_to date, p_group text default 'month')
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me uuid := public.fn_dairy_my_farmer_id();
begin
  if me is null then raise exception 'Sirf kisan'; end if;
  return public.fn_dairy_pnl_for(me, p_from, p_to, p_group);
end $$;
revoke all on function public.fn_my_dairy_pnl(date, date, text) from public, anon;
grant execute on function public.fn_my_dairy_pnl(date, date, text) to authenticated;
