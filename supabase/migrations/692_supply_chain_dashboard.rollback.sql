-- Rollback 692 (sirf zaroorat par). purchase_costs ka data khatam ho jayega -- pehle backup lein.
begin;
delete from public.dashboard_features where dashboard_key = 'reports' and feature_key = 'reports.supply-chain';
delete from public.features where key = 'reports.supply-chain';
drop function if exists public.fn_supply_chain_monthly(date, date, uuid, uuid, uuid);
drop function if exists public.fn_supply_chain_kpis(date, date, uuid, uuid, uuid);
drop view if exists public.v_sc_po_delivery;
drop table if exists public.purchase_costs;
drop index if exists public.idx_purchases_expected_date;
alter table public.suppliers drop constraint if exists chk_suppliers_default_lead_days;
alter table public.suppliers drop column if exists default_lead_days;
alter table public.purchases drop column if exists expected_date;
commit;
