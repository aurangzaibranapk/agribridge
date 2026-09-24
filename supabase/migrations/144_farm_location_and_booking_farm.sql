-- 144: Khet ki jagah ek dafa, phir hamesha
--
-- Ab tak har booking apni jagah khud rakhti thi: location_lat,
-- location_lng, location_address. Yani ek hi khet ki jagah har booking
-- par dobara bhari jati -- aur har dafa thori si mukhtalif. Teen saal
-- baad us kisan ke paas ek khet ke chhe pate hote.
--
-- Khet khud pehle se maujood hai (farms). Jo nahi tha wo ye: booking ka
-- us khet se rishta, aur ye ke jagah kab, kis ne, kitni durusti se li.
--
-- Usool wohi: jagah ka ek hi malik -- khet. Booking us ki taraf ishara
-- karti hai. Booking par jagah ab bhi likhi jati hai (purani bookings
-- ka record mehfooz rahe aur khet ki jagah baad mein badle to purana
-- kaam apni jagah par rahe), magar wo khet se KHUD bharti hai, staff ke
-- haath se nahi.

-- ---------------------------------------------------------------
-- 1. Jagah kis ne, kab, aur kitni durusti se li
--
-- GPS kabhi kuch meter idhar udhar hota hai. "Accuracy" us shak ka adad
-- hai. Us ke baghair 50 meter ki ghalti aur 3 meter ki durusti dono ek
-- jaise nazar aate hain -- aur machine 50 meter door wale khet mein
-- chali jati hai.
-- ---------------------------------------------------------------
alter table public.farms
  add column if not exists location_accuracy_m numeric(10,2),
  add column if not exists location_captured_at timestamptz,
  add column if not exists location_captured_by uuid references auth.users(id),
  add column if not exists location_source text;

alter table public.farms drop constraint if exists chk_farm_location_source;
alter table public.farms add constraint chk_farm_location_source check (
  location_source is null or location_source in ('gps', 'manual_pin')
);

comment on column public.farms.location_accuracy_m is
  'GPS ne khud bataya ke wo kitne meter tak theek hai. Bara adad = kam bharosa.';
comment on column public.farms.location_source is
  'gps = khet par khare ho kar li gayi. manual_pin = naqshe par haath se lagayi (GPS ki ghalti theek karne ke liye).';

-- Haath se lagayi hui pin ki accuracy ka koi matlab nahi -- wo GPS ka
-- adad hai, insaan ke ishare ka nahi.
create or replace function public.fn_guard_farm_location()
returns trigger
language plpgsql
as $$
begin
  if (new.latitude is null) <> (new.longitude is null) then
    raise exception 'Khet ki jagah adhoori hai: latitude aur longitude dono chahiye.';
  end if;

  if new.latitude is not null and new.location_source is null then
    new.location_source := 'manual_pin';
  end if;

  if new.location_source = 'manual_pin' then
    new.location_accuracy_m := null;
  end if;

  if new.latitude is not null and new.location_captured_at is null then
    new.location_captured_at := now();
  end if;

  if new.latitude is null then
    new.location_source := null;
    new.location_accuracy_m := null;
    new.location_captured_at := null;
    new.location_captured_by := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_farm_location on public.farms;
create trigger trg_guard_farm_location
  before insert or update on public.farms
  for each row execute function public.fn_guard_farm_location();

-- ---------------------------------------------------------------
-- 2. Booking kis khet ki hai
-- ---------------------------------------------------------------
alter table public.machinery_bookings
  add column if not exists farm_id uuid references public.farms(id);
alter table public.machinery_requests
  add column if not exists farm_id uuid references public.farms(id);

comment on column public.machinery_bookings.farm_id is
  'Kis khet ka kaam. Jagah yahin se khud bharti hai -- staff ke haath se nahi.';

-- Khet ka rishta ussi kisan se hona chahiye jis ki booking hai. Ye
-- rokna zaroori hai: ek kisan ki booking doosre ke khet par lag jaye to
-- machine ghalat jagah pohanchti hai aur bill ghalat bande ka banta hai.
create or replace function public.fn_booking_farm_location()
returns trigger
language plpgsql
as $$
declare
  f record;
begin
  if new.farm_id is null then
    return new;
  end if;

  select * into f from public.farms where id = new.farm_id;
  if not found then
    raise exception 'Khet nahi mila.';
  end if;
  if f.farmer_id <> new.farmer_id then
    raise exception 'Ye khet is kisan ka nahi hai.';
  end if;

  -- Jagah khet se aati hai. Booking par likhi jati hai taake purana
  -- kaam apna record rakhe, magar bhari khud se jati hai.
  if new.location_lat is null and f.latitude is not null then
    new.location_lat := f.latitude;
    new.location_lng := f.longitude;
  end if;
  if new.location_address is null then
    new.location_address := f.name;
  end if;
  if new.village is null then
    new.village := f.village;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_booking_farm_location on public.machinery_bookings;
create trigger trg_booking_farm_location
  before insert or update on public.machinery_bookings
  for each row execute function public.fn_booking_farm_location();

-- ---------------------------------------------------------------
-- 3. Khaiton ka naqsha
--
-- Kis kisan ki zameen kahan hai, kitne khet, kitne acre, kaun si fasal,
-- kab kattai. Isi fehrist se aage machine ka rasta banaya ja sakta hai:
-- ek hi ilaqe ke paanch khet ek dafa mein.
-- ---------------------------------------------------------------
create or replace view public.v_farm_map as
select
  f.id                as farm_id,
  f.name              as farm_name,
  f.area_acres,
  f.village,
  f.district,
  f.latitude,
  f.longitude,
  f.location_accuracy_m,
  f.location_source,
  f.location_captured_at,
  fr.id               as farmer_id,
  fr.full_name        as farmer_name,
  fr.farmer_code,
  fr.phone_number     as farmer_phone,

  -- Is khet par abhi kaun sa kaam khula hai
  b.booking_number    as open_booking_number,
  b.status            as open_booking_status,
  b.crop_type         as open_booking_crop,
  b.preferred_date    as open_booking_date,
  b.harvest_area      as open_booking_area
from public.farms f
join public.farmers fr on fr.id = f.farmer_id
left join lateral (
  select b2.booking_number, b2.status, b2.crop_type, b2.preferred_date, b2.harvest_area
    from public.machinery_bookings b2
   where b2.farm_id = f.id
     and b2.status not in ('closed', 'cancelled')
   order by b2.booking_date desc
   limit 1
) b on true
where fn_is_any_staff();

revoke all on public.v_farm_map from anon;
grant select on public.v_farm_map to authenticated, service_role;

comment on view public.v_farm_map is
  'Har khet ek qatar: kis kisan ka, kahan, kitne acre, aur us par abhi kaun sa kaam khula hai. Machine ka rasta isi se banta hai.';
