-- 586: Mobile "Mera Khata" khulasa -- main ke ek hi khate (565) par.
-- Port of testing 379 + 20261010050003/4. Testing wale function milk,
-- farmer credit, GL aur dukaan ke baqaye ALAG ALAG jor-te the; main par
-- 20261012135000 + 565 ke baad ye sab ek khata hai (fn_my_khata_summary).
-- Alag jor-ne se raqam do dafa ginti (424 jaisa masla), is liye yahan
-- baqaya SIRF fn_my_khata_summary se aata hai, aur statement app seedha
-- fn_my_khata_statement se parhti hai. Ye function sirf doodh ke haftay ke
-- aadaad aur wallet saath jor-ta hai. Kisan aur customer dono ke liye.
-- Read-only, sirf additive. Live par sirf owner ki manzoori ke baad.

create or replace function public.mobile_my_farmer_summary()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_f uuid; v_c uuid[]; v_khata jsonb;
  v_today date := (now() at time zone 'Asia/Karachi')::date;
begin
  if auth.uid() is null then raise exception 'Login zaroori hai'; end if;
  if not exists (select 1 from profiles p where p.id = auth.uid() and coalesce(p.is_active, true)) then
    raise exception 'Active profile zaroori hai';
  end if;
  select sc.farmer_id, sc.customer_ids into v_f, v_c from fn_my_khata_scope() sc;
  -- Mita hua kisan record app par nahi dikhta
  if v_f is not null and exists (select 1 from farmers f where f.id = v_f and coalesce(f.is_deleted, false)) then
    v_f := null;
  end if;
  v_khata := fn_my_khata_summary(null);

  return jsonb_build_object(
    'farmer_id', v_f,
    'customer_count', coalesce(cardinality(v_c), 0),
    'khata', v_khata,
    'khata_owed', coalesce((v_khata->>'owed')::numeric, 0),
    'wallet_balance', case when v_f is null then null else
        coalesce((select w.balance from wallets w where w.owner_type::text = 'farmer' and w.owner_id = v_f limit 1), 0) end,
    'week_liters', coalesce((select sum(me.quantity_liters) from milk_entries me
        where v_f is not null and me.farmer_id = v_f and me.entry_date >= v_today - 6
          and coalesce(me.status, 'ok') not in ('rejected','void','deleted','cancelled')), 0),
    'week_amount', coalesce((select sum(me.total_amount) from milk_entries me
        where v_f is not null and me.farmer_id = v_f and me.entry_date >= v_today - 6
          and coalesce(me.status, 'ok') not in ('rejected','void','deleted','cancelled')), 0),
    'avg_fat', (select round(avg(me.fat_percentage), 2) from milk_entries me
        where v_f is not null and me.farmer_id = v_f and me.entry_date >= v_today - 6
          and coalesce(me.status, 'ok') not in ('rejected','void','deleted','cancelled')),
    'avg_snf', (select round(avg(me.snf_percentage), 2) from milk_entries me
        where v_f is not null and me.farmer_id = v_f and me.entry_date >= v_today - 6
          and coalesce(me.status, 'ok') not in ('rejected','void','deleted','cancelled'))
  );
end;
$$;
revoke all on function public.mobile_my_farmer_summary() from public, anon;
grant execute on function public.mobile_my_farmer_summary() to authenticated;

comment on function public.mobile_my_farmer_summary() is
  '586: mobile khulasa. Baqaya sirf fn_my_khata_summary (565) se -- alag jor nahi. Read-only.';

notify pgrst, 'reload schema';
