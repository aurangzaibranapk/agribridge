-- =====================================================================
-- AgriBridge — Migration 124: Ek mobile, ek kisan
-- =====================================================================
-- Kisan SAAT darwazon se ban'ta hai: admin ka safha, website ki
-- registration, Google/Facebook login, WhatsApp ka naya number,
-- marketplace ka cart, chiller par milk walk-in, aur machinery ki
-- booking ka quick register.
--
-- Har darwaze ne apna hi tareeqa rakha hua tha ke "ye number pehle se to
-- nahi?" -- kisi ne poora number milaya, kisi ne aakhri nau hindse, aur
-- do darwazon ne poochha hi nahi. Aur database ka apna pehra sirf itna
-- tha ke phone_number ka HARF-BA-HARF joRa dobara na ho.
--
-- Us pehre ka faida kuch nahi, kyunke ek hi banda teen tarah likha jata
-- hai:
--
--   0300-1234567      -> alag qatar
--   03001234567       -> alag qatar
--   +92 300 1234567   -> alag qatar
--
-- Teenon ek hi aadmi hain. Teen khate ban jayen to us ka udhaar teen
-- jagah bat jata hai, aur kisi ek khata dekh kar ye keh dena mumkin ho
-- jata hai ke "is par to kuch baqi nahi".
--
-- Is liye pehra ab number par nahi, us ki ASAL par hai: aakhri das
-- hindse. Ye hisaab database khud karta hai (phone_key), kisi code ke
-- bharose nahi -- taake aane wala aathwan darwaza bhi khud-ba-khud is
-- qanoon ke neeche aa jaye.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Number ki asal
-- ---------------------------------------------------------------------
-- Das se kam hindse ho to null: aisa number kisi ka pehchan-patra nahi
-- ban sakta, aur us par pehra lagana ghalat joRe banayega.
create or replace function fn_phone_key(p_phone text)
returns text
language sql
immutable
as $$
  select case
    when length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) >= 10
      then right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10)
  end;
$$;

alter table farmers
  add column if not exists phone_key text
    generated always as (fn_phone_key(phone_number)) stored;

-- Pehra lagane se PEHLE dekh lein ke aaj hi koi joRa maujood to nahi.
-- Warna index banane ki koshish ek besmajh se paighaam ke sath rukti hai
-- aur ye pata nahi chalta ke kaun kaun se kisan takra rahe hain.
do $$
declare
  v_dups text;
begin
  select string_agg(g.line, E'\n') into v_dups
  from (
    select phone_key || ' -> ' || string_agg(farmer_code || ' (' || coalesce(full_name, '?') || ')', ', ') as line
    from farmers
    where phone_key is not null and not is_deleted
    group by phone_key
    having count(*) > 1
  ) g;

  if v_dups is not null then
    raise exception E'Ye kisan ek hi mobile par do baar maujood hain. Pehle inhein jorhein, phir ye migration chalayein:\n%', v_dups;
  end if;
end $$;

create unique index if not exists farmers_phone_key_uniq
  on farmers (phone_key)
  where phone_key is not null and is_deleted = false;

-- Purana harf-ba-harf pehra ab rehne do ya na rehne do -- naya pehra us
-- se sakht hai, aur purana sirf ye kehta hai ke "0300-1234567 do baar na
-- ho", jo naye ke andar khud aa gaya.
alter table farmers drop constraint if exists farmers_phone_number_key;

-- Talash bhi usi asal par, taake har darwaza ek hi jawab de.
create index if not exists farmers_phone_key_idx on farmers (phone_key);

-- ---------------------------------------------------------------------
-- 2) Kisan kis darwaze se aaya
-- ---------------------------------------------------------------------
-- Khana pehle se maujood tha magar koi bhi darwaza is mein kuch likhta
-- hi nahi tha -- har kisan par 'admin' likha chala aa raha tha, chahe wo
-- WhatsApp se aaya ho ya khud website par bana ho.
--
-- Ye sirf ginti ke liye nahi: jab kal ko poochha jaye ke "is kisan ka
-- CNIC kis ne liya tha", to jawab yahin se shuru hota hai.
update farmers set registration_source = case
  when registration_source in ('SELF', 'STAFF', 'WHATSAPP') then registration_source
  when registration_source in ('website', 'portal', 'self', 'oauth') then 'SELF'
  when registration_source in ('whatsapp', 'wa') then 'WHATSAPP'
  else 'STAFF'
end;

alter table farmers alter column registration_source set default 'STAFF';
alter table farmers alter column registration_source set not null;
alter table farmers drop constraint if exists farmers_registration_source_check;
alter table farmers add constraint farmers_registration_source_check
  check (registration_source in ('SELF', 'STAFF', 'WHATSAPP'));

-- ---------------------------------------------------------------------
-- 3) Profile ka darja
-- ---------------------------------------------------------------------
-- Char darje hain, aur teenon darwazon ke liye ek hi hain:
--
--   basic_registered  naam + mobile + zila -- itna hi. Booking ho sakti
--                     hai, isi liye registration itni chhoti rakhi hai.
--   profile_incomplete kisi ne 360 profile chherhi magar mukammal nahi ki
--   profile_complete   kisan ne khud "Confirm Profile" dabaya
--   verified           daftar ne kaghaz dekh kar tasdeeq ki
--
-- Zila yahan ginti mein nahi aata: wo registration ka hissa hai, 360
-- profile ka nahi. Agar use bhi gina jaye to har naya kisan usi lamhe
-- "profile_incomplete" ho jaye jis lamhe bana -- aur ye darja apna matlab
-- kho de.
create or replace function fn_farmer_profile_status(
  p_verified boolean,
  p_confirmed timestamptz,
  p_cnic text,
  p_village text,
  p_address text,
  p_land numeric,
  p_crops text[]
) returns text
language sql
immutable
as $$
  select case
    when coalesce(p_verified, false) then 'verified'
    when p_confirmed is not null then 'profile_complete'
    when coalesce(btrim(p_cnic), '') <> ''
      or coalesce(btrim(p_village), '') <> ''
      or coalesce(btrim(p_address), '') <> ''
      or p_land is not null
      or coalesce(array_length(p_crops, 1), 0) > 0 then 'profile_incomplete'
    else 'basic_registered'
  end;
$$;

alter table farmers
  add column if not exists profile_confirmed_at timestamptz;

alter table farmers
  add column if not exists profile_status text
    generated always as (fn_farmer_profile_status(
      is_verified, profile_confirmed_at, cnic, village, address, land_size_acres, crop_types
    )) stored;

-- is_profile_complete pehle se maujood tha magar koi bhi jagah us mein
-- kuch likhti nahi thi -- har kisan par hamesha false. Us ka nateeja
-- WhatsApp par nazar aata tha: jis kisan ne poori profile bhar rakhi ho,
-- usay bhi har baar "pehle apni profile mukammal karein" suna diya jata.
--
-- Ab wo khud nahi likha jata; upar wale hisaab se bharta hai. Do jagah
-- ek hi sach rakhne se bachne ke liye khana generated NAHI banaya jaa
-- sakta (do purane view us par khare hain), is liye trigger.
create or replace function fn_farmer_profile_flag()
returns trigger
language plpgsql
as $$
begin
  new.is_profile_complete := fn_farmer_profile_status(
    new.is_verified, new.profile_confirmed_at, new.cnic, new.village,
    new.address, new.land_size_acres, new.crop_types
  ) in ('profile_complete', 'verified');
  return new;
end;
$$;

drop trigger if exists trg_farmer_profile_flag on farmers;
create trigger trg_farmer_profile_flag
  before insert or update on farmers
  for each row execute function fn_farmer_profile_flag();

-- Purane kisanon par bhi wohi hisaab laga dein (trigger insert/update
-- dono par chalta hai, is liye khali update kaafi hai).
update farmers set is_profile_complete = is_profile_complete;

-- ---------------------------------------------------------------------
-- 4) Ek hi jawab, har darwaze par
-- ---------------------------------------------------------------------
-- Har darwaza apni marzi ka sawal poochta tha, is liye jawab bhi alag
-- alag tha. Ab sawal ek hai. Security definer is liye ke booking counter
-- par khara staff bhi wohi jawab dekh sake jo daftar dekhta hai -- warna
-- usay "ye number khali hai" nazar aata aur wo doosra khata bana deta.
create or replace function fn_find_farmer_by_phone(p_phone text)
returns table (id uuid, farmer_code text, full_name text, phone_number text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select f.id, f.farmer_code, f.full_name, f.phone_number
  from farmers f
  where f.phone_key is not null
    and f.phone_key = fn_phone_key(p_phone)
    and not f.is_deleted
  limit 1;
$$;

grant execute on function fn_phone_key(text) to anon, authenticated, service_role;
grant execute on function fn_find_farmer_by_phone(text) to anon, authenticated, service_role;
grant execute on function fn_farmer_profile_status(boolean, timestamptz, text, text, text, numeric, text[]) to anon, authenticated, service_role;

comment on column farmers.phone_key is
  'Mobile ki asal: aakhri das hindse. Pehra isi par hai -- 0300-1234567 aur +923001234567 ek hi kisan hain.';
comment on column farmers.profile_status is
  'basic_registered -> profile_incomplete -> profile_complete -> verified. Khud hisaab hota hai, koi likhta nahi.';
comment on column farmers.registration_source is
  'SELF (website/app), STAFF (daftar ya counter), WHATSAPP.';
