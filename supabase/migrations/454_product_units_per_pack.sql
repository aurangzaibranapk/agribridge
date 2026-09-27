-- Har product mein kitni bottles ek pack mein hain -- display ke liye
-- Default 1 (matlab pack hi unit hai). 12 set karo pey-drinks ke liye
-- jahan 1 pack = 12 bottles.

alter table public.products
  add column if not exists units_per_pack integer not null default 1;

-- 500ml drink products: 1 pack = 12 bottles
update public.products
  set units_per_pack = 12
  where is_deleted = false
    and (lower(name) like '%500ml%' or lower(name) like '%500 ml%');
