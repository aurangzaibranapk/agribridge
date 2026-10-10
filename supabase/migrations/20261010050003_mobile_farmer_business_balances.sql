-- Add canonical machinery/GL and linked shop balances to the farmer's own summary.
-- One authenticated, read-only source for the farmer mobile dashboard.
create or replace function public.mobile_my_farmer_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_farmer_id uuid;
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Login required'; end if;
  select f.id into v_farmer_id from farmers f
    join profiles p on p.id = f.user_id and p.is_active and p.organization_id = f.organization_id
    where f.user_id = auth.uid() and f.is_deleted = false
    limit 1;
  if v_farmer_id is null then raise exception 'Farmer profile not found'; end if;

  select jsonb_build_object(
    'farmer_id', v_farmer_id,
    'milk_balance', coalesce((select balance_due from milk_farmer_balances where farmer_id = v_farmer_id), 0),
    'credit_balance', coalesce((select balance_due from farmer_credit_balances where farmer_id = v_farmer_id), 0),
    'machine_gl_balance', coalesce((
      select sum(coalesce(l.debit, 0) - coalesce(l.credit, 0))
      from journal_lines l join journal_entries e on e.id = l.entry_id
      where l.party_type = 'farmer' and l.party_id = v_farmer_id
        and e.source_module <> 'farmer_credit'
    ), 0),
    'shop_balance', coalesce((
      select sum(c.current_balance)
      from customers c join farmers f on f.id = c.farmer_id
      where c.farmer_id = v_farmer_id and c.organization_id = f.organization_id
    ), 0),
    'wallet_balance', coalesce((select balance from wallets where owner_type = 'farmer' and owner_id = v_farmer_id), 0),
    'week_liters', coalesce((select sum(quantity_liters) from milk_entries where farmer_id = v_farmer_id and entry_date >= current_date - 6), 0),
    'week_amount', coalesce((select sum(total_amount) from milk_entries where farmer_id = v_farmer_id and entry_date >= current_date - 6), 0),
    'avg_fat', coalesce((select avg(fat_percentage) from milk_entries where farmer_id = v_farmer_id and entry_date >= current_date - 6), 0),
    'avg_snf', coalesce((select avg(snf_percentage) from milk_entries where farmer_id = v_farmer_id and entry_date >= current_date - 6), 0),
    'transactions', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.happened_at desc)
      from (
        select 'Milk'::text category, 'Milk collection'::text title,
          coalesce(total_amount, 0)::numeric amount, true incoming,
          entry_date::timestamptz happened_at
        from milk_entries where farmer_id = v_farmer_id
        union all
        select 'Milk', 'Milk payment', amount, false, payment_date::timestamptz
        from milk_payments where farmer_id = v_farmer_id
        union all
        select initcap(replace(source_type::text, '_', ' ')), coalesce(notes, 'Farmer credit'),
          amount, ledger_type::text = 'credit', created_at
        from farmer_credit_ledger where farmer_id = v_farmer_id
        order by happened_at desc limit 50
      ) t
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function public.mobile_my_farmer_summary() from public;
grant execute on function public.mobile_my_farmer_summary() to authenticated;
