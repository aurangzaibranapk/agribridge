-- 629 rollback. Enum value 'receiving' Postgres se safe nahi hat-ti; wo rehti hai.
-- ux_bill_reads_supplier_bill_no_applied (388) yahan nahi girta.
drop index if exists public.ux_agri_grns_order_id;
drop index if exists public.ux_stock_batches_dedupe_key;
drop index if exists public.ux_stock_movements_dedupe_key;
drop index if exists public.ux_purchases_bill_no_key;
alter table public.stock_batches drop column if exists dedupe_key;
alter table public.stock_movements drop column if exists dedupe_key;
alter table public.purchases drop column if exists bill_no_key;
drop function if exists public.fn_procurement_index_blockers();
