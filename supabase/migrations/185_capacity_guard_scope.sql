-- 185: Do kharabiyan jo vendor ke "Bhejein" par saamne aayin.
--
-- Vendor ne kaam ke baad ke do sawal bhare aur "Bhejein" dabaya. Jawab
-- mila:
--
--   "Ye machine us din kaam ke qabil nahi (workshop/band)."
--
-- Machine bilkul theek thi -- available, capacity 15 acre. Do alag
-- ghaltiyan mil kar ye jhoot bol rahi thin.
--
-- PEHLI: RLS ke peeche chhupa hua sifar.
--
--   fn_machine_daily_capacity() machine ki qatar parhta hai. Wo SECURITY
--   DEFINER nahi tha, is liye jo bhi usay bulaye us ki apni ijazat par
--   chalta tha. machinery_vendor_machines par parhne ki ijazat sirf
--   staff ko hai -- vendor ko nahi. Vendor ke haath mein wo query SIFAR
--   qatarein laati thi, aur function "machine mili hi nahi" ko "capacity
--   sifar" samajh kar 0 laut deta tha.
--
--   Ye wohi purani shakal hai jo pehle bhi do dafa pakRi ja chuki hai:
--   ek ijazat wali rok ke peeche khali jawab, aur us khali jawab ko
--   asal adad samajh lena. Function ka sawal ijazat ka hai hi nahi --
--   wo poochta hai "is machine ki ek din ki hadd kya hai", aur us ka
--   jawab har us bande ke liye ek jaisa hai jo booking likh sakta hai.
--
--   Ab wo SECURITY DEFINER hai, aur "machine mili nahi" ke liye NULL
--   laut-ta hai -- sifar nahi. Sifar ka matlab "band machine" hai; us
--   ko "pata nahi chala" ke liye istemal karna hi asal ghalti thi.
--
-- DOOSRI: guard har update par chal raha tha.
--
--   Capacity ka guard BEFORE INSERT OR UPDATE par laga hai, is liye wo
--   booking ki HAR tabdeeli par dobara chalta tha -- chahe machine,
--   tareekh aur raqba bilkul na badle hon. "Khet pahunch gaya", "kaam
--   shuru", aur naya vendor_closing_at -- teenon us hadd se guzarte the
--   jis ka un se koi taalluq nahi.
--
--   Guard ka kaam ye dekhna hai ke KYA likha ja raha hai. Machine,
--   tareekh, raqba ya halat na badle to capacity ka sawal uthta hi
--   nahi.

-- ---- 1. Capacity ka jawab har us bande ke liye ek jaisa ----

create or replace function public.fn_machine_daily_capacity(p_machine_id uuid)
returns numeric
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare v_status text; v_own numeric; v_default numeric;
begin
  select m.status, m.daily_capacity_acres into v_status, v_own
    from public.machinery_vendor_machines m where m.id = p_machine_id;

  -- Machine hi na mile to hum kuch NAHI jaante. Pehle yahan 0 laut-ta
  -- tha, aur bulane wala usay "band machine" samajh leta tha.
  if not found then return null; end if;

  if v_status in ('maintenance','inactive') then return 0; end if;
  if v_own is not null then return v_own; end if;

  select coalesce((value #>> '{}')::numeric, 15) into v_default
    from public.platform_settings where key = 'machinery_daily_acres_per_machine';
  return coalesce(v_default, 15);
end $function$;

comment on function public.fn_machine_daily_capacity(uuid) is
  'Machine ki ek din ki hadd (acre). 0 = band ya workshop mein. NULL = machine hi nahi mili. SECURITY DEFINER: ye sawal ijazat ka nahi, haqeeqat ka hai -- vendor ke haath mein bhi wohi jawab aana chahiye jo staff ke haath mein.';

-- ---- 2. Guard sirf tab jab capacity wali cheez badle ----

create or replace function public.fn_guard_machine_day_capacity()
returns trigger
language plpgsql
as $function$
declare
  v_cap  numeric;
  v_used numeric;
  v_new  numeric;
begin
  -- Booking ki koi aur cheez badli hai (khet pahunchna, kaam shuru
  -- hona, vendor ke aakhri jawab, notes) to capacity ka sawal uthta hi
  -- nahi. Guard ye dekhta hai ke KYA likha ja raha hai.
  if tg_op = 'UPDATE'
     and new.machine_id           is not distinct from old.machine_id
     and new.preferred_date       is not distinct from old.preferred_date
     and new.harvest_area_acres   is not distinct from old.harvest_area_acres
     and new.harvest_area_kanal   is not distinct from old.harvest_area_kanal
     and new.status               is not distinct from old.status then
    return new;
  end if;

  if new.machine_id is null or new.preferred_date is null then
    return new;
  end if;
  if new.status in ('closed', 'cancelled') then
    return new;
  end if;

  v_new := coalesce(new.harvest_area_acres, 0) + coalesce(new.harvest_area_kanal, 0) / 8;
  if v_new <= 0 then
    return new;
  end if;

  v_cap := public.fn_machine_daily_capacity(new.machine_id);

  -- Machine ka pata hi na chale to rok lagana jhoot hoga. Ye ho nahi
  -- sakta (machine_id par foreign key hai), magar agar kabhi ho to
  -- khamoshi se guzar jayen -- ek jhoota "workshop" wala paigham
  -- dene se behtar hai.
  if v_cap is null then
    return new;
  end if;

  select coalesce(sum(b.harvest_area), 0) into v_used
    from public.machinery_bookings b
   where b.machine_id = new.machine_id
     and b.preferred_date = new.preferred_date
     and b.status not in ('closed', 'cancelled')
     and b.id <> new.id;

  if v_used + v_new > v_cap + 0.001 then
    if new.capacity_override_by is not null then
      return new;
    end if;
    if v_cap = 0 then
      raise exception
        'Ye machine us din kaam ke qabil nahi (workshop/band). Doosri machine chunein, ya manager ki ijazat aur wajah ke sath aage barhein.';
    end if;
    raise exception
      'Is machine par % ko pehle se % acre bandhe hue hain. Ek din ki hadd % acre hai, is liye % acre aur nahi aa sakte. Doosri tareekh chunein, doosri machine chunein, ya manager ki ijazat aur wajah ke sath aage barhein.',
      new.preferred_date, round(v_used, 2), v_cap, round(v_new, 2);
  end if;

  return new;
end $function$;
