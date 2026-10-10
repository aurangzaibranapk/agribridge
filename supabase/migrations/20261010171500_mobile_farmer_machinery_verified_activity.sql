-- Farmer-facing read of canonical machinery booking and verified activity.
-- Internal vendor settlement, finance account IDs, and unverified claims stay private.
create or replace function public.mobile_my_machinery_bookings()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_farmer_id uuid;
  v_result jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Login required';
  end if;

  select f.id into v_farmer_id
    from public.farmers f
    join public.profiles p on p.id = f.user_id
      and p.is_active and p.organization_id = f.organization_id
   where f.user_id = (select auth.uid()) and not f.is_deleted
   limit 1;
  if v_farmer_id is null then
    raise exception 'Farmer profile not found';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', b.id,
    'booking_number', b.booking_number,
    'booking_date', b.booking_date,
    'work_date', coalesce(b.preferred_date, b.expected_harvest_date),
    'status', b.status,
    'machine_type', b.machine_type_requested,
    'acres', coalesce(b.verified_area, b.harvest_area_acres, b.acres),
    'total_amount', b.total_amount,
    'amount_received', b.amount_received_from_farmer,
    'location', b.village,
    'payments', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', pay.id, 'date', pay.payment_date, 'kind', pay.kind,
        'amount', pay.amount, 'method', pay.method
      ) order by pay.payment_date desc, pay.created_at desc), '[]'::jsonb)
      from public.machinery_payments pay
      where pay.booking_id = b.id and pay.verification_status = 'verified'
    ),
    'diesel', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', fuel.id, 'date', fuel.log_date, 'paid_by', fuel.paid_by,
        'litres', fuel.litres, 'amount', fuel.amount
      ) order by fuel.log_date desc, fuel.created_at desc), '[]'::jsonb)
      from public.machinery_fuel_logs fuel
      where fuel.booking_id = b.id and fuel.verification_status = 'verified'
        and fuel.cancelled_at is null
    )
  ) order by b.booking_date desc, b.created_at desc), '[]'::jsonb)
  into v_result
  from public.machinery_bookings b
  where b.farmer_id = v_farmer_id;
  return v_result;
end;
$$;

revoke all on function public.mobile_my_machinery_bookings() from public, anon;
grant execute on function public.mobile_my_machinery_bookings() to authenticated;
