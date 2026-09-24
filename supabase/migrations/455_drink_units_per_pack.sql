-- Drink products ke liye units_per_pack
-- 350ml = 12 bottles/pack, 1L/1.5L/2L = 6 bottles/pack
-- NULL check zaruri hai — column allow karta hai NULL (existing rows)

update public.products
  set units_per_pack = 12
  where is_deleted = false
    and (lower(name) like '%350ml%' or lower(name) like '%350 ml%');

update public.products
  set units_per_pack = 6
  where is_deleted = false
    and (units_per_pack is null or units_per_pack = 1)
    and (
      lower(name) like '% 1l'
      or lower(name) like '% 1l %'
      or lower(name) like '% 1 l%'
      or lower(name) like '% 1 le%'
    );

update public.products
  set units_per_pack = 6
  where is_deleted = false
    and (units_per_pack is null or units_per_pack = 1)
    and (
      lower(name) like '%1.5l%'
      or lower(name) like '%1.5 l%'
      or lower(name) like '%1.5 le%'
    );

update public.products
  set units_per_pack = 6
  where is_deleted = false
    and (units_per_pack is null or units_per_pack = 1)
    and (
      lower(name) like '% 2l'
      or lower(name) like '% 2l %'
      or lower(name) like '% 2 l%'
      or lower(name) like '% 2 le%'
      or lower(name) like '%2le%'
    );
