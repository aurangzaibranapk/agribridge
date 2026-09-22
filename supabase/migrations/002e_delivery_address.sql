-- =====================================================================
-- AgriBridge — Migration 002e: delivery address (fixes a real gap)
-- Run after 002d_new_order_statuses.sql.
-- =====================================================================
-- The original bridge_orders design stored only district/tehsil for
-- routing, on the theory that masking the farmer's identity meant
-- masking their address too. That was wrong: a dealer physically cannot
-- deliver an order without knowing where to take it. The masking
-- principle is about IDENTITY (name, phone, CNIC) — never exposed to a
-- dealer, no matter what — not about location, which any courier needs.
alter table bridge_orders add column if not exists delivery_address text;

comment on column bridge_orders.delivery_address is
  'Full delivery address, visible to the assigned dealer for fulfilment. '
  'The farmer''s name, phone, and CNIC remain masked via the RLS policies '
  'on the farmers table — this column intentionally does not close that gap, '
  'it fixes a different one (the dealer needing somewhere to deliver to).';
