-- Agri orders mein mazboot destination warehouse -- Main Branch ke 5 godamon
-- mein se sahi godam ka taayun karne ke liye. Pehle sirf branch_id tha aur
-- GRN code: MAIN warehouse dhundta tha; ab khana maujood hai aur GRN us se
-- seedha maal dalta hai.
alter table agri_orders add column if not exists order_to_warehouse_id uuid null
  references warehouses(id);
