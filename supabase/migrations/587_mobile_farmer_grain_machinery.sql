-- 587: Kisan ka apna gandum aur machinery record (read-only).
-- Port of testing 20261010050005/6 + 20261010171500 (verified activity).
-- Vendor ka hisaab, finance account, aur bina tasdeeq ke claims kisan ko
-- nahi dikhte. Sirf additive. Live par sirf owner ki manzoori ke baad.

create or replace function public.fn_mobile_my_farmer_id()
returns uuid language sql stable security definer set search_path = public as $$
  select f.id from farmers f
    join profiles p on p.id = f.user_id and coalesce(p.is_active, true)
                   and p.organization_id is not distinct from f.organization_id
   where f.user_id = auth.uid() and not coalesce(f.is_deleted, false)
   order by f.created_at nulls last limit 1
$$;
revoke all on function public.fn_mobile_my_farmer_id() from public, anon;
grant execute on function public.fn_mobile_my_farmer_id() to authenticated;

create or replace function public.mobile_my_grain_summary()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare v_f uuid;
begin
  if auth.uid() is null then raise exception 'Login zaroori hai'; end if;
  v_f := fn_mobile_my_farmer_id();
  if v_f is null then raise exception 'Kisan profile nahi mila'; end if;

  return jsonb_build_object(
    'total_supplied', coalesce((select g.total_supplied from grain_farmer_balances g where g.farmer_id = v_f), 0),
    'total_paid', coalesce((select g.total_paid from grain_farmer_balances g where g.farmer_id = v_f), 0),
    'balance_due', coalesce((select g.balance_due from grain_farmer_balances g where g.farmer_id = v_f), 0),
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'date', e.entry_date, 'grain_type', e.grain_type,
        'weight_kg', e.weight_kg, 'gross_weight_kg', e.gross_weight_kg, 'cut_kg', e.cut_kg,
        'bag_count', e.bag_count, 'rate_per_kg', e.rate_per_kg, 'total_amount', e.total_amount,
        'reclassified', e.reclassified_as_sale_id is not null
      ) order by e.entry_date desc, e.created_at desc)
      from (select * from grain_procurement_entries where farmer_id = v_f
             order by entry_date desc, created_at desc limit 50) e), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'date', p.payment_date, 'amount', p.amount, 'method', p.payment_method)
             order by p.payment_date desc, p.created_at desc)
      from (select * from grain_procurement_payments where farmer_id = v_f
             order by payment_date desc, created_at desc limit 50) p), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.mobile_my_grain_summary() from public, anon;
grant execute on function public.mobile_my_grain_summary() to authenticated;

create or replace function public.mobile_my_machinery_bookings()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare v_f uuid;
begin
  if auth.uid() is null then raise exception 'Login zaroori hai'; end if;
  v_f := fn_mobile_my_farmer_id();
  if v_f is null then raise exception 'Kisan profile nahi mila'; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', b.id, 'booking_number', b.booking_number, 'booking_date', b.booking_date,
      'work_date', coalesce(b.preferred_date, b.expected_harvest_date),
      'status', b.status, 'machine_type', b.machine_type_requested,
      'acres', coalesce(b.verified_area, b.harvest_area_acres, b.acres),
      'total_amount', b.total_amount, 'amount_received', b.amount_received_from_farmer,
      'location', b.village, 'cancelled', b.cancelled_at is not null,
      'payments', (select coalesce(jsonb_agg(jsonb_build_object(
          'id', pay.id, 'date', pay.payment_date, 'kind', pay.kind, 'amount', pay.amount, 'method', pay.method)
          order by pay.payment_date desc, pay.created_at desc), '[]'::jsonb)
        from machinery_payments pay where pay.booking_id = b.id and pay.verification_status = 'verified'),
      'diesel', (select coalesce(jsonb_agg(jsonb_build_object(
          'id', fuel.id, 'date', fuel.log_date, 'paid_by', fuel.paid_by, 'litres', fuel.litres, 'amount', fuel.amount)
          order by fuel.log_date desc, fuel.created_at desc), '[]'::jsonb)
        from machinery_fuel_logs fuel where fuel.booking_id = b.id and fuel.verification_status = 'verified'
          and fuel.cancelled_at is null)
    ) order by b.booking_date desc, b.created_at desc)
    from (select * from machinery_bookings where farmer_id = v_f
           order by booking_date desc, created_at desc limit 50) b), '[]'::jsonb);
end;
$$;
revoke all on function public.mobile_my_machinery_bookings() from public, anon;
grant execute on function public.mobile_my_machinery_bookings() to authenticated;

notify pgrst, 'reload schema';
