-- 148: Kisan ka wada -- "fasal bikne par de dunga"
--
-- Bill ban gaya, Rs 29,000 baqi, aur kisan kehta hai: abhi nahi, meri
-- fasal bikne par. Ye maamool hai -- kisan ke paas paisa fasal ke waqt
-- hi aata hai.
--
-- Ab tak yahan sirf do raaste the: payment darj karo, ya kuch na karo.
-- Dono ghalat the. Payment darj karna jhoot hai (paisa aaya hi nahi).
-- Kuch na karna us se bhi bura: baqi raqam padi rehti hai aur kisi ko
-- nazar nahi aata ke wo kyun padi hai, kab tak, aur kis ne kaha tha.
-- Do hafte baad koi phone karta hai to kisan kehta hai "maine to bata
-- diya tha" -- aur us ke paas jawab nahi hota.
--
-- Wada payment NAHI hai. Na ledger mein jata hai, na baqi kam karta
-- hai. Wo sirf ye batata hai ke ye raqam kis tareekh par maangi jani
-- hai aur kyun ruki hui hai.
--
-- Khata us se alag cheez hai: khata par daalna faisla hai ke ye udhaar
-- ab booking se nikal kar kisan ke chalte hue khate mein chala gaya.
-- Wada us se pehle ka qadam hai -- udhaar abhi is booking ka hai.

alter table public.machinery_bookings
  add column if not exists payment_promise_date date,
  add column if not exists payment_promise_note text,
  add column if not exists payment_promise_at timestamptz,
  add column if not exists payment_promise_by uuid references auth.users(id);

comment on column public.machinery_bookings.payment_promise_date is
  'Kisan ne kis tareekh ka wada kiya. Ye payment NAHI hai -- baqi raqam waise hi khari rehti hai.';
comment on column public.machinery_bookings.payment_promise_note is
  'Kisan ne kya kaha (misal: "gandum bikne par"). Yehi wo jumla hai jo do hafte baad phone par kaam aata hai.';

create or replace function public.fn_guard_payment_promise()
returns trigger
language plpgsql
as $$
begin
  if new.payment_promise_date is null then
    return new;
  end if;

  -- Guzri hui tareekh ka wada wada nahi hota.
  if new.payment_promise_date < current_date then
    raise exception 'Wade ki tareekh guzar chuki hai -- aage ki tareekh likhein.';
  end if;

  if coalesce(new.payment_promise_note, '') = '' then
    raise exception 'Kisan ne kya kaha, wo likhein -- sirf tareekh se baad mein kuch yaad nahi rehta.';
  end if;

  if new.payment_promise_at is null then
    new.payment_promise_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_payment_promise on public.machinery_bookings;
create trigger trg_guard_payment_promise
  before insert or update on public.machinery_bookings
  for each row execute function public.fn_guard_payment_promise();

-- Booking band hone par wada khud mit jata hai. Bandh booking par para
-- hua wada agle saal ki fehrist mein aa kar uljhan paida karta hai.
create or replace function public.fn_clear_promise_on_close()
returns trigger
language plpgsql
as $$
begin
  if new.status in ('closed', 'cancelled') and old.status is distinct from new.status then
    new.payment_promise_date := null;
    new.payment_promise_note := null;
    new.payment_promise_at := null;
    new.payment_promise_by := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_clear_promise_on_close on public.machinery_bookings;
create trigger trg_clear_promise_on_close
  before update on public.machinery_bookings
  for each row execute function public.fn_clear_promise_on_close();

-- ---------------------------------------------------------------
-- Qatar mein wada bhi nazar aaye
--
-- "paisa lena" ki qatar ab do hisson mein bat jati hai: jin ka wada
-- aaj ya guzar chuka hai (in par aaj phone karna hai), aur jin ka wada
-- aage ka hai (in par abhi nahi). Ye farq na ho to qatar roz poori ki
-- poori nazar aati hai aur aadmi us par se guzar jata hai.
-- ---------------------------------------------------------------
create or replace view public.v_machinery_queue as
select
  b.id,
  b.booking_number,
  b.status,
  b.booking_date,
  b.preferred_date,
  b.crop_type,
  b.harvest_area,
  b.machine_type_requested,
  b.final_rate,
  b.field_ready,
  b.harvest_ready,
  b.location_address,
  f.full_name    as farmer_name,
  f.farmer_code,
  f.phone_number as farmer_phone,

  case
    when b.status = 'new' and b.rate_confirmation_sent_at is null then 'rate_bhejna'
    when b.status = 'new' and b.farmer_confirmed_at is null       then 'tasdeeq_ka_intezar'
    when b.status = 'ready_for_harvest'                            then 'machine_bhejna'
    when b.status = 'in_progress'                                  then 'kaam_darj_karna'
    when b.status = 'bill_pending'                                 then 'bill_banana'
    when b.status = 'payment_pending'                              then 'paisa_lena'
  end as queue,

  (current_date - b.booking_date) as din_purani,
  (b.preferred_date is not null and b.preferred_date < current_date) as tareekh_guzar_gayi,

  coalesce(w.kaam_ho_chuka, 0) as kaam_ho_chuka,
  greatest(coalesce(b.harvest_area, 0) - coalesce(w.kaam_ho_chuka, 0), 0) as kaam_baqi,
  w.aakhri_din                 as aakhri_kaam_ki_tareekh,
  coalesce(w.mukammal, false)  as kaam_mukammal,

  b.payment_promise_date,
  b.payment_promise_note,
  -- Wada aaj ka ya guzra hua = aaj phone karna hai.
  (b.payment_promise_date is not null and b.payment_promise_date <= current_date) as wada_aa_gaya,
  -- Wada aage ka = abhi intezar, tang mat karo.
  (b.payment_promise_date is not null and b.payment_promise_date > current_date)  as wade_ka_intezar

from machinery_bookings b
left join farmers f on f.id = b.farmer_id
left join lateral (
  select sum(w2.actual_area)  as kaam_ho_chuka,
         max(w2.work_date)    as aakhri_din,
         bool_or(w2.is_final) as mukammal
    from machinery_work_records w2
   where w2.booking_id = b.id
) w on true
where b.status not in ('closed', 'cancelled')
  and fn_is_any_staff();

comment on view v_machinery_queue is
  'Har khuli booking apne agle qadam ki qatar mein: kitna kaam ho chuka, kitna baqi, aur paise ka wada kab ka hai. Fehrist khud banti hai -- kisi ke update karne ka intezar nahi.';

revoke all on v_machinery_queue from anon;
grant select on v_machinery_queue to authenticated, service_role;
