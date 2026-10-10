-- Farmer-scoped read-only grain procurement and payment summary.
create or replace function public.mobile_my_grain_summary()
returns jsonb
language plpgsql
stable security definer
set search_path = public
as $$
declare
  v_farmer_id uuid;
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Login required'; end if;
  select f.id into v_farmer_id
    from public.farmers f
    join public.profiles p on p.id = f.user_id
      and p.is_active and p.organization_id = f.organization_id
   where f.user_id = auth.uid() and not f.is_deleted
   limit 1;
  if v_farmer_id is null then raise exception 'Farmer profile not found'; end if;

  select jsonb_build_object(
    'total_supplied', coalesce((select total_supplied from public.grain_farmer_balances where farmer_id = v_farmer_id), 0),
    'total_paid', coalesce((select total_paid from public.grain_farmer_balances where farmer_id = v_farmer_id), 0),
    'balance_due', coalesce((select balance_due from public.grain_farmer_balances where farmer_id = v_farmer_id), 0),
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'date', e.entry_date, 'grain_type', e.grain_type,
        'weight_kg', e.weight_kg, 'gross_weight_kg', e.gross_weight_kg,
        'cut_kg', e.cut_kg, 'rate_per_kg', e.rate_per_kg, 'total_amount', e.total_amount
      ) order by e.entry_date desc, e.created_at desc)
      from (select * from public.grain_procurement_entries
            where farmer_id = v_farmer_id
            order by entry_date desc, created_at desc limit 50) e
    ), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'date', p.payment_date, 'amount', p.amount, 'method', p.payment_method
      ) order by p.payment_date desc, p.created_at desc)
      from (select * from public.grain_procurement_payments
            where farmer_id = v_farmer_id
            order by payment_date desc, created_at desc limit 50) p
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function public.mobile_my_grain_summary() from public;
grant execute on function public.mobile_my_grain_summary() to authenticated;
