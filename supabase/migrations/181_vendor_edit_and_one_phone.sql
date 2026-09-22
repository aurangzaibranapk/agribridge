-- 181: Vendor badalna, band karna, mitana -- aur ek mobile ek vendor
--
-- Abhi vendor sirf BANAYA ja sakta tha. Naam ghalat likha jaye, phone
-- badal jaye, ya wahi vendor do dafa ban jaye -- kisi ka koi ilaaj
-- nahi tha. Live par abhi hi ek vendor do dafa para hua hai.
--
-- Do alag cheezen chahiyen thin, aur unhein alag rakhna zaroori hai:
--
--   BAND KARNA (is_active = false) -- vendor kaam nahi karta, magar us
--   ka poora record khara rehta hai: purani bookings, bill, adaigiyan,
--   sab. Ye aam soorat hai.
--
--   MITANA -- record ka nishan tak baqi nahi rehta. Ye SIRF us vendor
--   par chalta hai jis ke sath kuch juda hi nahi: na machine, na
--   booking, na login. Jis ke sath kaam ya paisa juda ho us ko mitana
--   us ka itihaas mitana hai, aur wo is poore nizam ka usool torta hai.
--
-- Rok DATABASE par hai, screen par nahi. Screen se button chhupa dena
-- kaafi nahi -- doosra raasta (purani screen, koi script) usay phir
-- bhi mita sakta hai.

-- ---------------------------------------------------------------- 1
-- Ek mobile, ek vendor.
--
-- Yehi usool kisan par pehle se hai (124). Vendor par nahi tha, aur
-- nateeja saamne hai.
--
-- Ye TRIGGER hai, unique index NAHI -- jaan boojh kar. Index purani
-- qatarein bhi parkhta hai aur wo lag hi nahi pata jab tak duplicate
-- maujood hon. Trigger sirf NAYI likhai rokta hai: purana jaisa hai
-- waisa rehta hai, aur staff usay apne waqt par saaf karta hai.

create or replace function public.fn_guard_vendor_phone_unique()
returns trigger language plpgsql as $$
declare
  v_phone text;
  v_dupe  text;
begin
  v_phone := regexp_replace(coalesce(new.phone, ''), '\D', '', 'g');
  if v_phone = '' then
    return new;
  end if;

  -- Band vendor raaste mein nahi aata: wahi number kisi naye vendor ko
  -- dobara diya ja sakta hai jab purana band ho chuka ho.
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
end $$;

comment on function public.fn_guard_vendor_phone_unique() is
  'Ek mobile ek vendor. Trigger hai, index nahi -- purani duplicate qatarein rukti nahi, sirf nayi.';

drop trigger if exists trg_vendor_phone_unique on public.machinery_vendors;
create trigger trg_vendor_phone_unique
  before insert or update of phone, is_active on public.machinery_vendors
  for each row execute function public.fn_guard_vendor_phone_unique();

-- ---------------------------------------------------------------- 2
-- Mitane par rok: jis ke sath kuch juda ho wo mit nahi sakta.

create or replace function public.fn_guard_vendor_delete()
returns trigger language plpgsql as $$
declare
  v_machines int;
  v_bookings int;
begin
  select count(*) into v_machines
    from public.machinery_vendor_machines m where m.vendor_id = old.id;
  select count(*) into v_bookings
    from public.machinery_bookings b where b.vendor_id = old.id;

  if v_bookings > 0 then
    raise exception
      'Is vendor ki % booking maujood hain -- mitaya nahi ja sakta. Kaam aur paisa us se juda hua hai. Us ko BAND kar dein: record khara rahega aur nayi booking us par nahi jayegi.', v_bookings;
  end if;
  if v_machines > 0 then
    raise exception
      'Is vendor ki % machine darj hai -- pehle wo machine kisi aur vendor par le jayein ya band karein, phir ye vendor mitayein.', v_machines;
  end if;
  if old.user_id is not null then
    raise exception
      'Is vendor ka login bana hua hai -- mitane se pehle wo login khatam karna hoga. Filhaal us ko BAND kar dena behtar hai.';
  end if;

  return old;
end $$;

comment on function public.fn_guard_vendor_delete() is
  'Sirf khali vendor mit sakta hai. Jis ke sath kaam ya paisa juda ho, us ka mitna itihaas mitana hai.';

drop trigger if exists trg_vendor_delete_guard on public.machinery_vendors;
create trigger trg_vendor_delete_guard
  before delete on public.machinery_vendors
  for each row execute function public.fn_guard_vendor_delete();
