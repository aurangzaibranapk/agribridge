-- =====================================================================
-- AgriBridge — Migration 521: Supplier bill unique wapas
-- =====================================================================
-- Migration 388 ne ux_purchases_supplier_bill_no hata diya tha.
-- Naya Supplier Bill workspace purchases mein seedha likhta hai,
-- is liye wohi supplier + bill number dobara purchase bana sakta tha.
--
-- Rok wapas: ek supplier ka ek bill number (case/space ignore) sirf
-- ek non-cancelled purchase. Agar live par pehle se duplicate hain
-- to index nahi banta — pehle saaf karein, phir apply.
-- =====================================================================

do $$
begin
  if exists (
    select 1
    from (
      select supplier_id, lower(btrim(supplier_bill_no)) as bill
      from public.purchases
      where supplier_bill_no is not null
        and btrim(supplier_bill_no) <> ''
        and status <> 'cancelled'
      group by 1, 2
      having count(*) > 1
    ) d
  ) then
    raise notice 'Duplicate supplier bills exist. Unique index NOT created. Clean them first, then re-run.';
  else
    create unique index if not exists ux_purchases_supplier_bill_no
      on public.purchases (supplier_id, lower(btrim(supplier_bill_no)))
      where supplier_bill_no is not null
        and btrim(supplier_bill_no) <> ''
        and status <> 'cancelled';
  end if;
end $$;
