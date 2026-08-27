-- =====================================================================
-- AgriBridge — Migration 002d: additional order statuses
-- Run this file ALONE, before 002e_delivery_address.sql, for the same
-- reason as 002a — Postgres won't let a new enum value be used in the
-- same transaction it was added in.
-- =====================================================================

alter type bridge_order_status add value if not exists 'delivery_failed';
alter type bridge_order_status add value if not exists 'returned';
alter type bridge_order_status add value if not exists 'refunded';
