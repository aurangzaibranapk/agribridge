-- 578: Admin/Owner -- sab kisan ka dairy hisaab + ek kisan ki tafseel. Read-only.
create or replace function public.fn_dairy_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and coalesce(is_active, true) and role in ('owner','super_admin','admin'));
$$;
revoke all on function public.fn_dairy_is_admin() from public, anon;
grant execute on function public.fn_dairy_is_admin() to authenticated;

create or replace function public.fn_admin_dairy_totals(p_from date, p_to date)
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

create or replace function public.fn_admin_dairy_farmer(p_farmer uuid, p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.fn_dairy_is_admin() then raise exception 'Sirf Admin / Owner'; end if;
  return jsonb_build_object(
    'farmer', (select jsonb_build_object('id', f.id, 'farmer_code', f.farmer_code, 'full_name', f.full_name, 'village', f.village) from farmers f where f.id = p_farmer),
    'pnl', public.fn_dairy_pnl_for(p_farmer, p_from, p_to, 'month'),
    'animals', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'tag_no', a.tag_no, 'name', a.name, 'status', a.status,
        'litres', (select coalesce(sum(y.liters),0) from dairy_milk_yields y where y.animal_id = a.id and y.yield_date between p_from and p_to),
        'expense', (select coalesce(sum(e.amount),0) from dairy_expenses e where e.animal_id = a.id and not e.voided and e.expense_date between p_from and p_to))
        order by a.tag_no) from dairy_animals a where a.farmer_id = p_farmer), '[]'::jsonb),
    'recent', coalesce((select jsonb_agg(r order by r->>'date' desc) from (
        select jsonb_build_object('date', e.expense_date, 'kind', e.category, 'detail', coalesce(e.note, e.paid_to, ''), 'amount', -e.amount, 'source', e.source) r
          from dairy_expenses e where e.farmer_id = p_farmer and not e.voided and e.expense_date between p_from and p_to
        union all
        select jsonb_build_object('date', i.income_date, 'kind', i.kind, 'detail', coalesce(i.note, i.buyer, ''), 'amount', i.amount, 'source', 'manual')
          from dairy_income i where i.farmer_id = p_farmer and not i.voided and i.income_date between p_from and p_to
        order by 1 desc limit 30) z), '[]'::jsonb)
  );
end $$;
revoke all on function public.fn_admin_dairy_farmer(uuid, date, date) from public, anon;
grant execute on function public.fn_admin_dairy_farmer(uuid, date, date) to authenticated;
