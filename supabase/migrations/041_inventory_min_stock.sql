-- Adds an optional per-product minimum stock threshold so the Inventory
-- Dashboard can show a real Low Stock Alert instead of a guessed number.
-- Null means "no threshold set yet" -- admin sets it per product as needed.
alter table products add column if not exists min_stock numeric(14,2);