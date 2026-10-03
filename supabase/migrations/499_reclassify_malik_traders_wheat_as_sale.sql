-- Preserve the original grain entry while moving this legacy sale into the
-- grain-sales/receivable flow. No source row is deleted.

alter table public.grain_procurement_entries
  add column if not exists reclassified_as_sale_id uuid references public.grain_sales(id);

create index if not exists idx_grain_procurement_reclassified_sale
  on public.grain_procurement_entries(reclassified_as_sale_id);

do $$
declare
  v_entry public.grain_procurement_entries%rowtype;
  v_buyer_id uuid;
  v_sale_id uuid;
  v_sale_number text := 'GRN-SALE-26-00001';
begin
  select * into v_entry
  from public.grain_procurement_entries
  where id = '0c6f549a-0e91-464c-894a-d94680ce48aa'::uuid;

  if not found then
    raise exception 'Source grain entry not found';
  end if;

  select id into v_buyer_id
  from public.buyers
  where business_name = 'Malik Traders'
    and organization_id = public.fn_default_organization_id()
  order by created_at
  limit 1;

  if v_buyer_id is null then
    raise exception 'Malik Traders buyer not found';
  end if;

  select reclassified_as_sale_id into v_sale_id
  from public.grain_procurement_entries
  where id = v_entry.id;

  if v_sale_id is null then
    insert into public.grain_sales (
      sale_number, buyer_id, grain_type, warehouse_id, quantity_kg,
      rate_per_kg, total_amount, total_cogs, profit, sale_date,
      amount_received, notes, created_by
    )
    values (
      v_sale_number, v_buyer_id, v_entry.grain_type::text, v_entry.warehouse_id,
      v_entry.weight_kg, v_entry.rate_per_kg, v_entry.total_amount,
      v_entry.total_amount, 0, v_entry.entry_date, 0,
      concat(
        'Reclassified from grain procurement entry ', v_entry.id,
        '. Original note: ', coalesce(v_entry.notes, '')
      ),
      v_entry.created_by
    )
    returning id into v_sale_id;

    update public.grain_procurement_entries
    set reclassified_as_sale_id = v_sale_id
    where id = v_entry.id;
  end if;

  insert into public.grain_sale_counters(year, last_number)
  values (26, 1)
  on conflict (year) do update
    set last_number = greatest(public.grain_sale_counters.last_number, excluded.last_number);
end $$;