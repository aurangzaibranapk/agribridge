-- 180: 30 din ka capacity planner
--
-- Capacity ka tasawwur pehle se maujood tha (guard aur "agli khali
-- tareekh"), magar teen kamiyan thin:
--
--   1. Hadd EK thi -- poore nizam ke liye 15 acre. Kubota 15 kare,
--      koi doosri machine 10 ya 20 -- ye farq likhne ki jagah hi nahi
--      thi.
--   2. Jo machine workshop mein khari hai wo bhi utni hi "jagah" rakhti
--      thi jitni chalti hui machine. Yani planner jhooti gunjaish
--      dikhata.
--   3. Guard booking ko ROK deta tha. Malik ka faisla ye hai ke rok na
--      ho -- manager kabhi doosri machine ka bandobast kar leta hai --
--      magar guzarne ke liye us ka naam aur wajah likhi jaye.
--
-- EK MALIK: ab capacity ka adad sirf ek jagah se aata hai --
-- fn_machine_daily_capacity(). Guard, agli khali tareekh, aur planner
-- ke teenon view wohi ek function bulate hain. Pehle ye hisaab do
-- jagah likha tha (guard mein aur next_free_date mein), aur dono ko
-- alag alag badalna bhoolna aasan tha.

-- ---------------------------------------------------------------- 1
-- Har machine ki apni hadd.

alter table public.machinery_vendor_machines
  add column if not exists daily_capacity_acres numeric(8,2);

comment on column public.machinery_vendor_machines.daily_capacity_acres is
  'Is machine ki ek din ki hadd. Khali = poore nizam wali hadd (platform_settings.machinery_daily_acres_per_machine).';

alter table public.machinery_vendor_machines drop constraint if exists chk_machine_capacity;
alter table public.machinery_vendor_machines add constraint chk_machine_capacity
  check (daily_capacity_acres is null or daily_capacity_acres > 0);

-- Us machine ki us din ki hadd -- ek hi malik.
--
-- Machine ki apni hadd likhi ho to wohi; warna poore nizam wali. Aur
-- jo machine workshop mein ya band pari hai us ki hadd SIFAR hai: wo
-- us din kaam nahi kar sakti, is liye us ki gunjaish ginna jhoot hai.
create or replace function public.fn_machine_daily_capacity(p_machine_id uuid)
returns numeric language plpgsql stable as $$
declare
  v_status text;
  v_own    numeric;
  v_default numeric;
begin
  select m.status, m.daily_capacity_acres into v_status, v_own
    from public.machinery_vendor_machines m where m.id = p_machine_id;

  if v_status is null then
    return 0;
  end if;
  if v_status in ('maintenance', 'inactive') then
    return 0;
  end if;
  if v_own is not null then
    return v_own;
  end if;

  select coalesce((value #>> '{}')::numeric, 15) into v_default
    from public.platform_settings where key = 'machinery_daily_acres_per_machine';
  return coalesce(v_default, 15);
end $$;

comment on function public.fn_machine_daily_capacity(uuid) is
  'Ek din ki hadd -- capacity ka wahid malik. Guard, agli khali tareekh aur planner teenon yahin se lete hain.';

-- ---------------------------------------------------------------- 2
-- Hadd se zyada booking: rok nahi, magar naam aur wajah ke sath.

alter table public.machinery_bookings
  add column if not exists capacity_override_by uuid references public.profiles(id),
  add column if not exists capacity_override_reason text;

comment on column public.machinery_bookings.capacity_override_reason is
  'Hadd se zyada booking ki wajah. Bina wajah ke guzarne ka koi raasta nahi.';

alter table public.machinery_bookings drop constraint if exists chk_machinery_capacity_override;
alter table public.machinery_bookings add constraint chk_machinery_capacity_override check (
  (capacity_override_by is null and capacity_override_reason is null)
  or (capacity_override_by is not null and length(btrim(coalesce(capacity_override_reason, ''))) >= 10)
);

create or replace function public.fn_guard_machine_day_capacity()
returns trigger language plpgsql as $$
declare
  v_cap  numeric;
  v_used numeric;
  v_new  numeric;
begin
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

  select coalesce(sum(b.harvest_area), 0) into v_used
    from public.machinery_bookings b
   where b.machine_id = new.machine_id
     and b.preferred_date = new.preferred_date
     and b.status not in ('closed', 'cancelled')
     and b.id <> new.id;

  if v_used + v_new > v_cap + 0.001 then
    -- Manager ne apne naam aur wajah ke sath guzarne ka faisla kar liya
    -- ho to yahan rok nahi. Wajah booking par likhi rehti hai -- baad
    -- mein koi poochhe to jawab maujood hai.
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
end $$;

create or replace function public.fn_next_free_date(p_machine_id uuid, p_acres numeric, p_from date default current_date)
returns date language plpgsql stable as $$
declare
  v_cap  numeric;
  v_day  date;
  v_used numeric;
begin
  v_cap := public.fn_machine_daily_capacity(p_machine_id);
  if v_cap <= 0 then
    return null;
  end if;
  if coalesce(p_acres, 0) > v_cap then
    return null;
  end if;

  for i in 0..48 loop
    v_day := p_from + i;
    select coalesce(sum(b.harvest_area), 0) into v_used
      from public.machinery_bookings b
     where b.machine_id = p_machine_id
       and b.preferred_date = v_day
       and b.status not in ('closed', 'cancelled');
    if v_used + coalesce(p_acres, 0) <= v_cap + 0.001 then
      return v_day;
    end if;
  end loop;

  return null;
end $$;

-- ---------------------------------------------------------------- 3
-- Planner ke nazariye. Yahan koi naya HISAAB nahi -- wohi bookings,
-- wohi hadd, sirf din ke hisaab se jori hui.

create or replace view public.v_machinery_capacity_day as
select
  m.id                                   as machine_id,
  m.machine_code,
  m.machine_type,
  m.model,
  m.status                               as machine_status,
  m.vendor_id,
  v.vendor_name,
  d.din                                  as tareekh,
  public.fn_machine_daily_capacity(m.id) as hadd,
  coalesce(b.acre, 0)                    as bandha_hua,
  greatest(public.fn_machine_daily_capacity(m.id) - coalesce(b.acre, 0), 0) as bacha_hua,
  coalesce(b.kitni, 0)                   as kitni_bookings,
  coalesce(b.kitne_kisan, 0)             as kitne_kisan,
  case
    when public.fn_machine_daily_capacity(m.id) = 0 then 100
    else round(coalesce(b.acre, 0) * 100 / public.fn_machine_daily_capacity(m.id))
  end                                    as fisad,
  case
    when public.fn_machine_daily_capacity(m.id) = 0                                   then 'band'
    when coalesce(b.acre, 0) > public.fn_machine_daily_capacity(m.id) + 0.001          then 'hadd_se_zyada'
    when coalesce(b.acre, 0) >= public.fn_machine_daily_capacity(m.id) - 0.001         then 'bhara'
    when coalesce(b.acre, 0) * 100 / public.fn_machine_daily_capacity(m.id) > 60       then 'thori_jagah'
    else 'khali'
  end                                    as halat
from public.machinery_vendor_machines m
left join public.machinery_vendors v on v.id = m.vendor_id
cross join lateral (
  select generate_series(current_date, current_date + 29, interval '1 day')::date as din
) d
left join lateral (
  select
    sum(bk.harvest_area)              as acre,
    count(*)                          as kitni,
    count(distinct bk.farmer_id)      as kitne_kisan
  from public.machinery_bookings bk
  where bk.machine_id = m.id
    and bk.preferred_date = d.din
    and bk.status not in ('closed', 'cancelled')
) b on true
where fn_is_any_staff();

comment on view public.v_machinery_capacity_day is
  '30 din ka planner: har machine, har din -- hadd, bandha hua, bacha hua, aur halat.';

grant select on public.v_machinery_capacity_day to authenticated;

-- Kisi ek din par ungli rakhne par jo qatarein khulti hain.
create or replace view public.v_machinery_day_bookings as
select
  b.id                     as booking_id,
  b.booking_number,
  b.preferred_date         as tareekh,
  b.preferred_time,
  b.status,
  b.machine_id,
  m.machine_code,
  m.machine_type,
  m.model,
  b.vendor_id,
  v.vendor_name,
  b.farmer_id,
  f.full_name              as farmer_name,
  f.farmer_code,
  f.phone_number           as farmer_phone,
  b.crop_type,
  b.harvest_area           as acre,
  b.harvest_type,
  b.sabit_area,
  b.kutra_area,
  coalesce(nullif(btrim(b.village), ''), nullif(btrim(b.location_address), ''), 'Jagah darj nahi') as jagah,
  b.location_lat,
  b.location_lng,
  b.capacity_override_by,
  b.capacity_override_reason
from public.machinery_bookings b
left join public.machinery_vendor_machines m on m.id = b.machine_id
left join public.machinery_vendors v on v.id = b.vendor_id
left join public.farmers f on f.id = b.farmer_id
where b.status not in ('closed', 'cancelled')
  and (fn_is_any_staff() or v.user_id = auth.uid());

comment on view public.v_machinery_day_bookings is
  'Kisi din ki asal bookings -- planner ke har adad ke peeche yehi qatarein hain.';

grant select on public.v_machinery_day_bookings to authenticated;

-- Jagah ke hisaab se aane wala bojh (agle 30 din).
create or replace view public.v_machinery_location_workload as
select
  coalesce(nullif(btrim(b.village), ''), nullif(btrim(b.location_address), ''), 'Jagah darj nahi') as jagah,
  count(*)                          as kitni_bookings,
  count(distinct b.farmer_id)       as kitne_kisan,
  sum(coalesce(b.harvest_area, 0))  as kul_acre,
  min(b.preferred_date)             as pehli_tareekh,
  max(b.location_lat)               as lat,
  max(b.location_lng)               as lng
from public.machinery_bookings b
where b.status not in ('closed', 'cancelled')
  and b.preferred_date between current_date and current_date + 29
  and fn_is_any_staff()
group by coalesce(nullif(btrim(b.village), ''), nullif(btrim(b.location_address), ''), 'Jagah darj nahi');

comment on view public.v_machinery_location_workload is
  'Agle 30 din ka bojh, jagah ke hisaab se.';

grant select on public.v_machinery_location_workload to authenticated;

-- ---------------------------------------------------------------- 4
-- Safha aur menu.

insert into public.features (key, label, label_en, label_ur, route, icon, is_sensitive, is_active) values
  ('machinery-rental.calendar', 'Capacity Calendar', 'Capacity Calendar', 'کیپیسٹی کیلنڈر',
   '/admin/machinery-rental/calendar', 'CalendarRange', false, true)
on conflict (key) do update set route = excluded.route, icon = excluded.icon, is_active = true;

insert into public.dashboard_features (dashboard_key, feature_key, sort_order, section, section_order) values
  ('machinery', 'machinery-rental.calendar', 20, 'Operations', 3)
on conflict (dashboard_key, feature_key) do update
  set section = excluded.section, section_order = excluded.section_order, sort_order = excluded.sort_order;
