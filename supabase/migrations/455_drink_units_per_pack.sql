-- Drink products ke liye units_per_pack
-- 350ml = 12 bottles/pack, 1L/1.5L/2L = 6 bottles/pack
-- Names mein "Le" bhi aa sakta hai (e.g. "Sprite 1 Le") aur bare/small "L" bhi

-- 350ml → 12 per pack
update public.products
  set units_per_pack = 12
  where is_deleted = false
    and (lower(name) like '%350ml%' or lower(name) like '%350 ml%');

-- 1L / 1 Le → 6 per pack
update public.products
  set units_per_pack = 6
  where is_deleted = false
    and units_per_pack = 1
    and (
      lower(name) like '% 1 l%'
      or lower(name) like '%1l %' or lower(name) like '%1l)'
      or lower(name) like '%-1l%'
    );

-- 1.5L / 1.5 Le → 6 per pack
update public.products
  set units_per_pack = 6
  where is_deleted = false
    and units_per_pack = 1
    and (
      lower(name) like '%1.5l%'
      or lower(name) like '%1.5 l%'
    );

-- 2L / 2 Le → 6 per pack
update public.products
  set units_per_pack = 6
  where is_deleted = false
    and units_per_pack = 1
    and (
      lower(name) like '% 2l%'
      or lower(name) like '% 2 l%'
    );
