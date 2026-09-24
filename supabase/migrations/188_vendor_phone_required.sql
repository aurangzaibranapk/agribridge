-- 188: Vendor ka mobile number lazmi -- duplicate ka aakhri sooraakh.
--
-- 181 mein rok lagi thi: ek number ek hi vendor ka. Us mein ek khaali
-- jagah reh gayi thi -- phone khali ho to guard shuru mein hi wapas
-- chala jata tha. Yani do bina-number ke "Farman Ali" ab bhi ban sakte
-- the, aur safhe par bilkul ek jaise nazar aate.
--
-- Ab number lazmi hai. Ye sirf duplicate rokne ke liye nahi: jis vendor
-- ko phone hi nahi kar sakte, us par machine bhejne ka koi matlab nahi.
-- Number us ki asal pehchan hai, naam nahi -- gaon mein naam mushtarak
-- hote hain, number nahi.
--
-- Band vendor ke number par naya vendor ban sakta hai (jaan boojh kar).
-- Magar purane ko DOBARA KHOLNE par rok lag jati hai -- warna duplicate
-- usi raaste se wapas aa jata.

create or replace function public.fn_guard_vendor_phone_unique()
returns trigger
language plpgsql
as $function$
declare
  v_phone text;
  v_dupe  text;
begin
  v_phone := regexp_replace(coalesce(new.phone, ''), '\D', '', 'g');

  if v_phone = '' then
    raise exception
      'Vendor ka mobile number likhna zaroori hai. Number us ki pehchan hai -- naam mushtarak ho sakta hai, number nahi. Aur jis vendor ko phone na kar sakein, us par machine bhejne ka koi matlab nahi.';
  end if;

  select v.vendor_name into v_dupe
    from public.machinery_vendors v
   where v.id <> new.id
     and v.is_active
     and regexp_replace(coalesce(v.phone, ''), '\D', '', 'g') = v_phone
   limit 1;

  if v_dupe is not null then
    raise exception
      'Ye mobile number pehle se "%" ke naam par darj hai. Ek number ek hi vendor ka hota hai -- purana vendor kholein, ya us ko band kar ke naya banayein.', v_dupe;
  end if;

  return new;
end $function$;
