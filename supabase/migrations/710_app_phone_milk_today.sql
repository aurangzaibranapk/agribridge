-- 710: TEST doodh ki tareekh phone ke aaj par. Testing par. Live par mat chalana.
-- is_test milk_entries purani entry_date par atki thin, is liye Kisan, MCA, MCO
-- aur Admin ki aaj ki cards 0 L dikhati hain. Litre, rate, fat, status nahi badalte.
-- Phone ka "aaj" Asia/Karachi hai. Session CURRENT_DATE UTC ho sakta hai, is liye
-- yahan (timezone('Asia/Karachi', now()))::date — hardcoded din nahi, kuch din
-- baad dobara chalane par sirf naya farq aage badhta hai.
-- Subah aur shaam alag: jis shift ki aakhri tareekh peeche ho, wohi shift aaj par aati hai.
-- Test kisan (TEST-FARMER) ki apni aakhri subah/shaam bhi aaj par aati hai.
-- milk_route_collections ki collection_date usi hisaab se, taake Admin ka fallback bhi aaj par ho.
-- dairy_milk_yields ki tareekh guard badalne nahi deta. Phone home us table se nahi parhta.
-- Shift din app_phone_notes mein jama hota hai, rollback utne din wapas kheenchta hai.

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
    raise exception '710: app_phone_notes nahi. Pehle 707.';
  end if;
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'milk_entries'
      and column_name = 'is_test'
  ) then
    raise exception '710: milk_entries.is_test nahi. Pehle 699.';
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

  select today - max(m.entry_date) into morning_gap
  from public.milk_entries m
  where m.is_test
    and m.shift = 'morning'
    and m.entry_date <= today;

  if coalesce(morning_gap, 0) > 0 then
    update public.milk_entries
    set
      entry_date = entry_date + morning_gap,
      collected_at = collected_at + make_interval(days => morning_gap),
      fat_at = fat_at + make_interval(days => morning_gap),
      verified_at = verified_at + make_interval(days => morning_gap),
      created_at = created_at + make_interval(days => morning_gap)
    where is_test
      and shift = 'morning'
      and entry_date <= today;

    insert into public.app_phone_notes (key, value, label, detail)
    values ('home.milk.morning_shift_days', morning_gap, 'Subah din', today::text)
    on conflict (key) do update
    set
      value = coalesce(app_phone_notes.value, 0) + excluded.value,
      detail = excluded.detail,
      updated_at = now();
  end if;

  select today - max(m.entry_date) into evening_gap
  from public.milk_entries m
  where m.is_test
    and m.shift = 'evening'
    and m.entry_date <= today;

  if coalesce(evening_gap, 0) > 0 then
    update public.milk_entries
    set
      entry_date = entry_date + evening_gap,
      collected_at = collected_at + make_interval(days => evening_gap),
      fat_at = fat_at + make_interval(days => evening_gap),
      verified_at = verified_at + make_interval(days => evening_gap),
      created_at = created_at + make_interval(days => evening_gap)
    where is_test
      and shift = 'evening'
      and entry_date <= today;

    insert into public.app_phone_notes (key, value, label, detail)
    values ('home.milk.evening_shift_days', evening_gap, 'Shaam din', today::text)
    on conflict (key) do update
    set
      value = coalesce(app_phone_notes.value, 0) + excluded.value,
      detail = excluded.detail,
      updated_at = now();
  end if;

  select today - max(m.entry_date) into farmer_morning_gap
  from public.milk_entries m
  where m.is_test
    and m.farmer_id = farmer
    and m.shift = 'morning'
    and m.entry_date <= today;

  if coalesce(farmer_morning_gap, 0) > 0 then
    update public.milk_entries
    set
      entry_date = entry_date + farmer_morning_gap,
      collected_at = collected_at + make_interval(days => farmer_morning_gap),
      fat_at = fat_at + make_interval(days => farmer_morning_gap),
      verified_at = verified_at + make_interval(days => farmer_morning_gap),
      created_at = created_at + make_interval(days => farmer_morning_gap)
    where is_test
      and farmer_id = farmer
      and shift = 'morning'
      and entry_date <= today;

    insert into public.app_phone_notes (key, value, label, detail)
    values ('home.milk.farmer_morning_days', farmer_morning_gap, 'Kisan subah', today::text)
    on conflict (key) do update
    set
      value = coalesce(app_phone_notes.value, 0) + excluded.value,
      detail = excluded.detail,
      updated_at = now();
  end if;

  select today - max(m.entry_date) into farmer_evening_gap
  from public.milk_entries m
  where m.is_test
    and m.farmer_id = farmer
    and m.shift = 'evening'
    and m.entry_date <= today;

  if coalesce(farmer_evening_gap, 0) > 0 then
    update public.milk_entries
    set
      entry_date = entry_date + farmer_evening_gap,
      collected_at = collected_at + make_interval(days => farmer_evening_gap),
      fat_at = fat_at + make_interval(days => farmer_evening_gap),
      verified_at = verified_at + make_interval(days => farmer_evening_gap),
      created_at = created_at + make_interval(days => farmer_evening_gap)
    where is_test
      and farmer_id = farmer
      and shift = 'evening'
      and entry_date <= today;

    insert into public.app_phone_notes (key, value, label, detail)
    values ('home.milk.farmer_evening_days', farmer_evening_gap, 'Kisan shaam', today::text)
    on conflict (key) do update
    set
      value = coalesce(app_phone_notes.value, 0) + excluded.value,
      detail = excluded.detail,
      updated_at = now();
  end if;

  select today - max(r.collection_date) into route_gap
  from public.milk_route_collections r
  where r.is_test
    and r.collection_date <= today;

  if coalesce(route_gap, 0) > 0 then
    update public.milk_route_collections
    set collection_date = collection_date + route_gap
    where is_test
      and collection_date <= today;

    insert into public.app_phone_notes (key, value, label, detail)
    values ('home.milk.route_shift_days', route_gap, 'Route din', today::text)
    on conflict (key) do update
    set
      value = coalesce(app_phone_notes.value, 0) + excluded.value,
      detail = excluded.detail,
      updated_at = now();
  end if;

  if exists (select 1 from public.milk_entries where is_test and shift = 'morning')
     and not exists (
       select 1 from public.milk_entries
       where is_test and shift = 'morning' and entry_date = today and quantity_liters > 0
     ) then
    raise exception '710: aaj subah ka test doodh nahi.';
  end if;

  if exists (select 1 from public.milk_entries where is_test and shift = 'evening')
     and not exists (
       select 1 from public.milk_entries
       where is_test and shift = 'evening' and entry_date = today and quantity_liters > 0
     ) then
    raise exception '710: aaj shaam ka test doodh nahi.';
  end if;

  if exists (select 1 from public.milk_entries where is_test and farmer_id = farmer)
     and not exists (
       select 1 from public.milk_entries
       where is_test and farmer_id = farmer and entry_date = today and quantity_liters > 0
     ) then
    raise exception '710: test kisan ka aaj ka doodh nahi.';
  end if;
end $$;
