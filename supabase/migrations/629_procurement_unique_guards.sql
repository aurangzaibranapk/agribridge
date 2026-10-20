-- =====================================================================
-- AgriBridge — Migration 629: procurement unique guards
-- =====================================================================
-- LIKHA HAI, APPLY NAHI KIYA. Pehle Testing, phir Live — aur Live se
-- pehle backup. 630 isi ke COMMIT ke baad chale (enum value usi
-- transaction mein use nahi ho sakti).
--
-- Owner/Admin self-approve (13 Oct 2026) is migration mein NAHI badla.
--
-- PEHLE YE READ-ONLY QUERY CHALAYEIN (koi likhai nahi). Jo `block:`
-- qatarein aayein wo unique index rokengi. `info:` sirf nazar ke liye
-- hai: 388 ki do purchases ek bill par, aur purani double stock.
-- In par naya index nahi atkta (bill_no_key sirf sab se purani purchase
-- par, dedupe_key purani qataron par null rehta hai).
--
--   select * from public.fn_procurement_index_blockers();
--
-- Function banne se pehle yahi SQL seedha:
--
--   select 'block:agri_grn_order' as kind, order_id::text as key, count(*)::bigint as n
--   from public.agri_grns group by order_id having count(*) > 1
--   union all
--   select 'block:bill_read', supplier_id::text || '|' || lower(btrim(bill_number)), count(*)::bigint
--   from public.supplier_bill_reads
--   where supplier_id is not null and bill_number is not null
--     and btrim(bill_number) <> '' and purchase_id is not null
--   group by supplier_id, lower(btrim(bill_number)) having count(*) > 1
--   union all
--   select 'info:purchase_bill_shared', supplier_id::text || '|' || lower(btrim(supplier_bill_no)), count(*)::bigint
--   from public.purchases
--   where supplier_bill_no is not null and btrim(supplier_bill_no) <> '' and status <> 'cancelled'
--   group by supplier_id, lower(btrim(supplier_bill_no)) having count(*) > 1
--   union all
--   select 'info:historical_stock_double', reference_type || '|' || reference_id::text || '|' || inventory_id::text, count(*)::bigint
--   from public.stock_movements
--   where reference_type in ('purchase','agri_grn') and movement_type = 'purchase_in' and reference_id is not null
--   group by reference_type, reference_id, inventory_id having count(*) > 1;
-- =====================================================================

create or replace function public.fn_procurement_index_blockers()
returns table(kind text, key text, n bigint)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select 'block:agri_grn_order', g.order_id::text, count(*)::bigint
  from public.agri_grns g
  group by g.order_id
  having count(*) > 1
  union all
  select 'block:bill_read', s.supplier_id::text || '|' || lower(btrim(s.bill_number)), count(*)::bigint
  from public.supplier_bill_reads s
  where s.supplier_id is not null
    and s.bill_number is not null
    and btrim(s.bill_number) <> ''
    and s.purchase_id is not null
  group by s.supplier_id, lower(btrim(s.bill_number))
  having count(*) > 1
  union all
  select 'info:purchase_bill_shared', p.supplier_id::text || '|' || lower(btrim(p.supplier_bill_no)), count(*)::bigint
  from public.purchases p
  where p.supplier_bill_no is not null
    and btrim(p.supplier_bill_no) <> ''
    and p.status <> 'cancelled'
  group by p.supplier_id, lower(btrim(p.supplier_bill_no))
  having count(*) > 1
  union all
  select 'info:historical_stock_double', m.reference_type || '|' || m.reference_id::text || '|' || m.inventory_id::text, count(*)::bigint
  from public.stock_movements m
  where m.reference_type in ('purchase', 'agri_grn')
    and m.movement_type = 'purchase_in'
    and m.reference_id is not null
  group by m.reference_type, m.reference_id, m.inventory_id
  having count(*) > 1
$$;

revoke all on function public.fn_procurement_index_blockers() from public, anon;
grant execute on function public.fn_procurement_index_blockers() to authenticated, service_role;

do $$
declare n bigint;
begin
  select count(*) into n from public.fn_procurement_index_blockers() where kind like 'block:%';
  if n > 0 then
    raise exception '629: % duplicate group(s) block a unique index. Read-only: select * from public.fn_procurement_index_blockers();', n;
  end if;
end $$;

-- 'receiving' = receive ka taala. Doosri call pending na dekhe.
alter type public.purchase_status add value if not exists 'receiving';

alter table public.purchases add column if not exists bill_no_key text;
comment on column public.purchases.bill_no_key is
  'Ek supplier + ek bill number ka unique slot (629). 388 ki agli purchase isi bill se isay null chhodti hai.';

alter table public.stock_movements add column if not exists dedupe_key text;
comment on column public.stock_movements.dedupe_key is
  'Receive/GRN ki ek line ek hi movement (629). Purani qatarein null rehti hain.';

alter table public.stock_batches add column if not exists dedupe_key text;
comment on column public.stock_batches.dedupe_key is
  'GRN/receive ka batch dobara na bane (629).';

-- Sab se purani non-cancelled purchase slot leti hai. Baqi (388 batches
-- ya purane dohre) null rehti hain, is liye index un par nahi atkta.
update public.purchases p
set bill_no_key = lower(btrim(p.supplier_bill_no))
where p.supplier_bill_no is not null
  and btrim(p.supplier_bill_no) <> ''
  and p.status <> 'cancelled'
  and p.bill_no_key is null
  and p.id = (
    select p2.id
    from public.purchases p2
    where p2.supplier_id = p.supplier_id
      and p2.supplier_bill_no is not null
      and btrim(p2.supplier_bill_no) <> ''
      and p2.status <> 'cancelled'
      and lower(btrim(p2.supplier_bill_no)) = lower(btrim(p.supplier_bill_no))
    order by p2.created_at, p2.id
    limit 1
  );

create unique index if not exists ux_purchases_bill_no_key
  on public.purchases (supplier_id, bill_no_key)
  where bill_no_key is not null
    and status <> 'cancelled';

create unique index if not exists ux_stock_movements_dedupe_key
  on public.stock_movements (dedupe_key)
  where dedupe_key is not null;

create unique index if not exists ux_stock_batches_dedupe_key
  on public.stock_batches (dedupe_key)
  where dedupe_key is not null;

create unique index if not exists ux_agri_grns_order_id
  on public.agri_grns (order_id);

create unique index if not exists ux_bill_reads_supplier_bill_no_applied
  on public.supplier_bill_reads (supplier_id, lower(btrim(bill_number)))
  where supplier_id is not null
    and bill_number is not null
    and btrim(bill_number) <> ''
    and purchase_id is not null;
