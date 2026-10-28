-- 664: Anaj ki nayi bikri khareed se zyada nahi.
-- Purani zyadati (45,905 vs 40,530) yahan NAHI mit-ti. Diagnostic docs mein hai.

create or replace function public.fn_guard_grain_sale_qty()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_bought numeric;
  v_sold numeric;
begin
  -- Ek grain ki do bikriyan ek sath sum ko na parh sakein.
  perform pg_advisory_xact_lock(hashtext('grain-sale:' || coalesce(new.grain_type, '')));

  select coalesce(sum(coalesce(stock_weight_kg, weight_kg)), 0)
    into v_bought
    from public.grain_procurement_entries
   where grain_type = new.grain_type
     and reclassified_as_sale_id is null;

  select coalesce(sum(quantity_kg), 0)
    into v_sold
    from public.grain_sales
   where grain_type = new.grain_type
     and id is distinct from new.id;

  if coalesce(v_sold, 0) + coalesce(new.quantity_kg, 0) > coalesce(v_bought, 0) + 0.001 then
    raise exception 'Anaj ki bikri khareed se aage nahi ja sakti (khareed % kg, bikri % kg, nayi % kg).',
      round(coalesce(v_bought, 0), 3), round(coalesce(v_sold, 0), 3), round(coalesce(new.quantity_kg, 0), 3);
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_grain_sale_qty on public.grain_sales;
create trigger trg_guard_grain_sale_qty
  before insert or update of quantity_kg, grain_type on public.grain_sales
  for each row execute function public.fn_guard_grain_sale_qty();
