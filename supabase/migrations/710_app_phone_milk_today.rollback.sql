-- 710 rollback. Testing par. Live par mat chalana.
-- app_phone_notes mein jama shift din wapas kaat te hain. Litre nahi badalte.
-- Notes na hon to kuch nahi hota, dobara chalane se doosri dafa nahi kat-ta.

do $$
declare
  today date := (timezone('Asia/Karachi', now()))::date;
  farmer uuid;
  morning_gap integer;
  evening_gap integer;
  farmer_morning_gap integer;
  farmer_evening_gap integer;
  route_gap integer;
begin
  if to_regclass('public.app_phone_notes') is null then
    return;
  end if;

  select f.id into farmer
  from public.farmers f
  where f.is_test
    and f.farmer_code = 'TEST-FARMER'
  order by (f.id = 'fa2a6782-2725-49e7-a98c-6b9d2413f281'::uuid) desc
  limit 1;
  if farmer is null then
    farmer := 'fa2a6782-2725-49e7-a98c-6b9d2413f281';
  end if;

  select value::integer into farmer_morning_gap
  from public.app_phone_notes
  where key = 'home.milk.farmer_morning_days';
  if coalesce(farmer_morning_gap, 0) > 0 then
    update public.milk_entries
    set
      entry_date = entry_date - farmer_morning_gap,
      collected_at = collected_at - make_interval(days => farmer_morning_gap),
      fat_at = fat_at - make_interval(days => farmer_morning_gap),
      verified_at = verified_at - make_interval(days => farmer_morning_gap),
      created_at = created_at - make_interval(days => farmer_morning_gap)
    where is_test
      and farmer_id = farmer
      and shift = 'morning'
      and entry_date <= today;
  end if;

  select value::integer into farmer_evening_gap
  from public.app_phone_notes
  where key = 'home.milk.farmer_evening_days';
  if coalesce(farmer_evening_gap, 0) > 0 then
    update public.milk_entries
    set
      entry_date = entry_date - farmer_evening_gap,
      collected_at = collected_at - make_interval(days => farmer_evening_gap),
      fat_at = fat_at - make_interval(days => farmer_evening_gap),
      verified_at = verified_at - make_interval(days => farmer_evening_gap),
      created_at = created_at - make_interval(days => farmer_evening_gap)
    where is_test
      and farmer_id = farmer
      and shift = 'evening'
      and entry_date <= today;
  end if;

  select value::integer into morning_gap
  from public.app_phone_notes
  where key = 'home.milk.morning_shift_days';
  if coalesce(morning_gap, 0) > 0 then
    update public.milk_entries
    set
      entry_date = entry_date - morning_gap,
      collected_at = collected_at - make_interval(days => morning_gap),
      fat_at = fat_at - make_interval(days => morning_gap),
      verified_at = verified_at - make_interval(days => morning_gap),
      created_at = created_at - make_interval(days => morning_gap)
    where is_test
      and shift = 'morning'
      and entry_date <= today;
  end if;

  select value::integer into evening_gap
  from public.app_phone_notes
  where key = 'home.milk.evening_shift_days';
  if coalesce(evening_gap, 0) > 0 then
    update public.milk_entries
    set
      entry_date = entry_date - evening_gap,
      collected_at = collected_at - make_interval(days => evening_gap),
      fat_at = fat_at - make_interval(days => evening_gap),
      verified_at = verified_at - make_interval(days => evening_gap),
      created_at = created_at - make_interval(days => evening_gap)
    where is_test
      and shift = 'evening'
      and entry_date <= today;
  end if;

  select value::integer into route_gap
  from public.app_phone_notes
  where key = 'home.milk.route_shift_days';
  if coalesce(route_gap, 0) > 0 then
    update public.milk_route_collections
    set collection_date = collection_date - route_gap
    where is_test
      and collection_date <= today;
  end if;

  delete from public.app_phone_notes
  where key in (
    'home.milk.morning_shift_days',
    'home.milk.evening_shift_days',
    'home.milk.farmer_morning_days',
    'home.milk.farmer_evening_days',
    'home.milk.route_shift_days'
  );
end $$;
