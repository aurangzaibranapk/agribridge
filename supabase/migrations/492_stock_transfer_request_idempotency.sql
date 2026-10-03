-- Multi-product transfer requests are also replayed after offline capture.
-- The key is optional so all existing transfers remain unchanged.
alter table stock_transfers add column if not exists offline_item_key text;
create unique index if not exists stock_transfers_offline_item_key_uidx
  on stock_transfers (offline_item_key) where offline_item_key is not null;
