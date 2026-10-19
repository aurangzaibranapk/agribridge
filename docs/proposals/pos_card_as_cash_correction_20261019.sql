-- =====================================================================
-- PROPOSAL ONLY -- NOT RUN.  Historical "card saved as cash" correction
-- Branch: fix/pos-card-cash-dupes   Prepared: 2026-10-19 (Asia/Karachi)
--
-- What is wrong: until this fix, posCheckout wrote ALL non-khata money
-- (cash + Waseela Card + bank + Easypaisa/JazzCash/QR) into
-- pos_sales.cash_paid. The per-method rows in pos_sale_payment_details,
-- the cash book (finance_transactions), the ledger (post_pos_source) and
-- shift Expected Cash (shift-cash.ts) were already correct -- they read the
-- payment-detail rows. Only screens that sum pos_sales.cash_paid were
-- inflated: Sales Report "Naqad aaya", Meri Dukan, per-shop "naqad" column,
-- get_daily_sales_summary.cash_total and the receipt "Cash Paid" line.
--
-- Read-only check on live, 19 Oct 2026:
--   Kisaan Karyana Mahabali : 29 bills, cash_paid overstated by Rs 11,815
--                              (18 Sep - 18 Oct 2026), e.g. 3C711691
--                              (Rs 230 Waseela Card), 761F19F1 (Rs 30)
--   (no shop)               : 2 bills, Rs 30 (4-5 Sep 2026)
--
-- The app fix (this PR) stops new rows and makes the two sales reports
-- read cash from payment-detail rows, so those reports are right even
-- without this correction. This file only realigns the stored column.
-- No money, stock, khata or ledger row changes.
-- =====================================================================

-- PART A -- REPORT (read-only, safe to run any time)
with d as (
  select sale_id,
         coalesce(sum(amount) filter (where payment_method = 'cash'), 0) as cash_lines,
         coalesce(sum(amount) filter (where payment_method not in ('cash','khata')), 0) as non_cash_lines,
         string_agg(distinct payment_method, ', ') as methods
    from public.pos_sale_payment_details
   group by sale_id
)
select upper(left(p.id::text, 8))                     as bill,
       p.created_at at time zone 'Asia/Karachi'       as created_pkt,
       sh.name                                        as shop,
       p.payment_mode, d.methods,
       p.total_amount, p.khata_amount,
       p.cash_paid                                    as stored_cash_paid,
       d.cash_lines                                   as real_cash,
       p.cash_paid - d.cash_lines                     as overstated_by
  from public.pos_sales p
  join d on d.sale_id = p.id
  left join public.shops sh on sh.id = p.shop_id
 where abs(p.cash_paid - d.cash_lines) > 0.009
 order by p.created_at;

-- Totals per shop
with d as (
  select sale_id, coalesce(sum(amount) filter (where payment_method = 'cash'), 0) as cash_lines
    from public.pos_sale_payment_details group by sale_id
)
select coalesce(sh.name, '(no shop)') as shop, count(*) as bills,
       sum(p.cash_paid - d.cash_lines) as overstated_total
  from public.pos_sales p join d on d.sale_id = p.id
  left join public.shops sh on sh.id = p.shop_id
 where abs(p.cash_paid - d.cash_lines) > 0.009
 group by 1 order by 2 desc;

-- PART B -- CORRECTION (DO NOT RUN without owner approval + backup)
-- Kept commented on purpose.
--
-- begin;
-- create table if not exists public.backup_pos_sales_cash_paid_20261019 as
--   select p.id, p.cash_paid, now() as backed_up_at
--     from public.pos_sales p
--     join (select sale_id, coalesce(sum(amount) filter (where payment_method='cash'),0) cash_lines
--             from public.pos_sale_payment_details group by sale_id) d on d.sale_id = p.id
--    where abs(p.cash_paid - d.cash_lines) > 0.009;
--
-- update public.pos_sales p
--    set cash_paid = d.cash_lines
--   from (select sale_id, coalesce(sum(amount) filter (where payment_method='cash'),0) cash_lines
--           from public.pos_sale_payment_details group by sale_id) d
--  where d.sale_id = p.id
--    and abs(p.cash_paid - d.cash_lines) > 0.009
--    and p.id in (select id from public.backup_pos_sales_cash_paid_20261019);
-- -- expect 31 rows (29 Mahabali + 2 no-shop) as of 19 Oct 2026
-- rollback;  -- change to COMMIT only after the count matches
--
-- Note: pos_sales has update triggers on khata_amount / customer / status
-- only (enforce_pos_recovery_credit, staff reward); cash_paid is not
-- watched, and the ledger trigger is AFTER INSERT only, so this update does
-- not re-post anything.
