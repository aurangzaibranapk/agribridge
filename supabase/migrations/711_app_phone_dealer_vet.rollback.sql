-- 711 rollback. Testing par. Live par mat chalana.
-- TEST-711 orders hat te hain. Jo created_at 711 ne sarkai, notes se wapas.
-- Vet next_due jo khali tha, khali. Naye ilaj void.

do $$
declare
  moved text;
  vet_ids text;
begin
  if to_regclass('public.app_phone_notes') is null then
    return;
  end if;

  select detail into moved
  from public.app_phone_notes
  where key = 'home.dealer.moved_at';

  if coalesce(moved, '') <> '' and moved <> '[]' then
    update public.agri_orders o
    set created_at = (item->>'at')::timestamptz
    from jsonb_array_elements(moved::jsonb) item
    where o.id = (item->>'id')::uuid
      and o.is_test;
  end if;

  delete from public.agri_orders
  where order_number like 'TEST-711-%'
    and is_test
    and notes = 'TEST phone 711';

  select detail into vet_ids
  from public.app_phone_notes
  where key = 'home.vet.pending_ids';

  if coalesce(vet_ids, '') <> '' then
    update public.dairy_health_events h
    set next_due = null
    where h.id::text = any (string_to_array(vet_ids, ','))
      and h.notes in ('TEST phone 708', 'TEST phone 709', 'TEST seedfull')
      and not h.voided;
  end if;

  update public.dairy_health_events
  set voided = true, void_reason = 'TEST phone 711 rollback'
  where notes = 'TEST phone 711'
    and not voided;

  delete from public.app_phone_notes
  where key in ('home.dealer.moved_at', 'home.vet.pending_ids');
end $$;
