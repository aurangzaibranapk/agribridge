-- Products mein carton/PET size ka khana -- karyana ordering mein PET+piece sync ke liye.
alter table products add column if not exists units_per_carton int null;

-- Beverages ki seed: standard pack sizes se carton size tay karta hai.
-- Sirf "Beverages & Cold Drinks" category par lagu -- baki categories ke liye
-- pehle Boss se poochha jayega.
update products p
  set units_per_carton = case
    when lower(p.pack_size) like '%250ml%' or lower(p.pack_size) like '%250 ml%' then 24
    when lower(p.pack_size) like '%350ml%' or lower(p.pack_size) like '%350 ml%' then 12
    when lower(p.pack_size) like '%500ml%' or lower(p.pack_size) like '%500 ml%' then 12
    when lower(p.pack_size) like '%1.5l%'  or lower(p.pack_size) like '%1.5 l%'  then 6
    when lower(p.pack_size) like '%2l%'    or lower(p.pack_size) like '%2 l%'    then 6
    when lower(p.pack_size) like '%1l%'    or lower(p.pack_size) like '%1 l%'    then 6
    else null
  end
where p.category_id in (
  select id from categories where name = 'Beverages & Cold Drinks'
)
  and p.pack_size is not null
  and p.units_per_carton is null;
