-- 173: Machine ka apna record, ART ki apni machine, aur machinery ka P&L
--
-- 1) MACHINE KA APNA RECORD
--
-- Machine abhi tak vendor ke neeche ek qatar thi: qism, model, rate.
-- Us se ye sawal kabhi nahi milte the, aur ye wohi sawal hain jin par
-- machine rakhne ka faisla hota hai:
--
--   is machine ne is season kitne acre kiye?
--   kitna diesel piya, per acre kitna?
--   kitni aamdani di, aur per acre kitni?
--   abhi kahan hai?
--
-- 2) ART KI APNI MACHINE
--
-- vendor_id lazmi tha, yani har machine kisi vendor ki hoti thi. ART
-- apni machine kharide to us ke liye ek jhoota vendor banana parta --
-- aur phir us jhoote vendor ko commission bhi jata.
--
-- Ab owner ka khana hai. ART ki apni machine par vendor hota hi nahi
-- (shart DB par lagi hai), aur us par commission nahi banta: poori
-- aamdani hamari hai.
--
-- 3) MACHINERY KA APNA P&L
--
-- Poore karobar ka P&L pehle se hai, magar us se ye sawal nahi milta:
-- "machinery se hum ne waqai kitna kamaya?"
--
-- Aur us sawal ka ek jaal hai jo aksar ghalat jawab deta hai: ART ka
-- diya hua diesel jo VENDOR se wapas aata hai, wo kharcha NAHI hai.
-- Usay kharche mein ginna machinery ka munafa jhooti tarah kam kar ke
-- dikhata hai -- aur usi adad par machine rakhne ya na rakhne ka
-- faisla hota hai.

alter table public.machinery_vendor_machines
  alter column vendor_id drop not null;

alter table public.machinery_vendor_machines
  add column if not exists machine_code text,
  add column if not exists owner text not null default 'vendor'
    check (owner in ('vendor', 'art')),
  add column if not exists registration_number text,
  add column if not exists status text not null default 'available'
    check (status in ('available', 'working', 'maintenance', 'inactive')),
  add column if not exists purchased_on date,
  add column if not exists last_location_lat numeric(10,7),
  add column if not exists last_location_lng numeric(10,7),
  add column if not exists last_location_at timestamptz;

comment on column public.machinery_vendor_machines.machine_code is
  'Machine ka apna number (MC-NNN). Phone par "kabota wali" kehna kaam nahi karta jab teen kabota hon.';
comment on column public.machinery_vendor_machines.owner is
  'Machine kis ki hai: vendor ki, ya ART ki apni. ART ki apni ho to us par commission nahi banta -- poori aamdani hamari hai.';
comment on column public.machinery_vendor_machines.status is
  'available = khali, working = kaam par, maintenance = marammat mein, inactive = ab nahi chalti.';
comment on column public.machinery_vendor_machines.registration_number is
  'Number plate ya chassis number. Ye wo cheez hai jo jhagRe aur chori ke waqt kaam aati hai.';

alter table public.machinery_vendor_machines drop constraint if exists chk_machine_owner;
alter table public.machinery_vendor_machines add constraint chk_machine_owner
  check (
    (owner = 'vendor' and vendor_id is not null)
    or (owner = 'art' and vendor_id is null)
  );

create unique index if not exists uq_machine_code
  on public.machinery_vendor_machines (machine_code) where machine_code is not null;

create table if not exists public.machinery_machine_counters (
  year int primary key,
  last_number int not null default 0
);
alter table public.machinery_machine_counters enable row level security;
revoke all on public.machinery_machine_counters from anon, authenticated;
grant all on public.machinery_machine_counters to service_role;

create or replace view public.v_machinery_machines as
select
  m.id                as machine_id,
  m.machine_code, m.machine_type, m.model, m.owner, m.registration_number,
  m.status, m.is_available, m.rate_type, m.rate_amount,
  m.driver_name, m.driver_phone, m.purchased_on,
  m.last_location_lat, m.last_location_lng, m.last_location_at,
  v.id                as vendor_id,
  v.vendor_name,
  coalesce(s.bookings, 0)      as kitni_bookings,
  coalesce(s.acre, 0)          as season_ke_acre,
  coalesce(s.aamdani, 0)       as kul_billing,
  coalesce(s.commission, 0)    as hamara_commission,
  coalesce(d.litre, 0)         as diesel_litre,
  coalesce(d.raqam, 0)         as diesel_raqam,
  case when coalesce(s.acre, 0) > 0
       then round(coalesce(d.litre, 0) / s.acre, 2) end   as litre_per_acre,
  case when coalesce(s.acre, 0) > 0
       then round(coalesce(d.raqam, 0) / s.acre, 2) end   as diesel_per_acre,
  case when coalesce(s.acre, 0) > 0
       then round(coalesce(s.aamdani, 0) / s.acre, 2) end as billing_per_acre,
  live.booking_number as chal_rahi_booking,
  live.farmer_name    as chal_raha_kisan
from public.machinery_vendor_machines m
left join public.machinery_vendors v on v.id = m.vendor_id
left join lateral (
  select count(*) as bookings, sum(w.kiya) as acre,
         sum(bl.gross_amount) as aamdani, sum(bl.commission_amount) as commission
    from public.machinery_bookings b
    left join public.machinery_bills bl on bl.booking_id = b.id
    left join lateral (
      select sum(w2.actual_area) as kiya
        from public.machinery_work_records w2
       where w2.booking_id = b.id and w2.verification_status = 'verified'
    ) w on true
   where b.machine_id = m.id and b.status <> 'cancelled'
) s on true
left join lateral (
  select sum(l.litres) as litre, sum(l.amount) as raqam
    from public.machinery_fuel_logs l
    join public.machinery_bookings b2 on b2.id = l.booking_id
   where b2.machine_id = m.id and l.verification_status = 'verified'
) d on true
left join lateral (
  select b3.booking_number, f3.full_name as farmer_name
    from public.machinery_bookings b3
    left join public.farmers f3 on f3.id = b3.farmer_id
    left join lateral (
      select bool_or(w3.is_final) as poora
        from public.machinery_work_records w3
       where w3.booking_id = b3.id and w3.verification_status = 'verified'
    ) wf on true
   where b3.machine_id = m.id
     and b3.status not in ('cancelled', 'closed')
     and not coalesce(wf.poora, false)
   order by b3.preferred_date nulls last
   limit 1
) live on true
where fn_is_any_staff();

revoke all on public.v_machinery_machines from anon;
grant select on public.v_machinery_machines to authenticated, service_role;

comment on view public.v_machinery_machines is
  'Har machine ka poora haal: kis ki hai, kahan hai, season mein kitne acre kiye, kitna diesel piya, kitni aamdani di, aur per acre kitna. Har adad kaam se nikalta hai -- kahin rakha nahi jata.';

-- ---------------------------------------------------------------
-- Machinery ka P&L
-- ---------------------------------------------------------------
create or replace view public.v_machinery_pnl_booking as
select
  b.id as booking_id, b.booking_number, b.booking_date,
  date_trunc('month', b.booking_date)::date as maheena,
  b.crop_type,
  v.id as vendor_id, v.vendor_name,
  m.id as machine_id, m.machine_code, m.machine_type,
  coalesce(m.owner, 'vendor') as machine_owner,
  coalesce(w.kiya, 0)                  as acre,
  coalesce(bl.gross_amount, 0)         as gross_billing,
  coalesce(bl.commission_amount, 0)    as commission,
  coalesce(bl.vendor_payable, 0)       as vendor_ka_hissa,
  coalesce(bl.diesel_deducted, 0)      as kisan_ka_diesel,
  coalesce(d.wapas, 0)                 as diesel_wapas_aane_wala,
  coalesce(d.hamara, 0)                as diesel_hamara_kharcha,
  -- ART ki apni machine par commission nahi banta: poora gross hamara.
  case when coalesce(m.owner, 'vendor') = 'art'
       then coalesce(bl.gross_amount, 0)
       else coalesce(bl.commission_amount, 0)
  end                                  as hamari_aamdani,
  case when coalesce(m.owner, 'vendor') = 'art'
       then coalesce(bl.gross_amount, 0) - coalesce(d.hamara, 0)
       else coalesce(bl.commission_amount, 0) - coalesce(d.hamara, 0)
  end                                  as munafa
from public.machinery_bookings b
left join public.machinery_vendors v on v.id = b.vendor_id
left join public.machinery_vendor_machines m on m.id = b.machine_id
join public.machinery_bills bl on bl.booking_id = b.id
left join lateral (
  select sum(w2.actual_area) as kiya
    from public.machinery_work_records w2
   where w2.booking_id = b.id and w2.verification_status = 'verified'
) w on true
left join lateral (
  select
    sum(l.amount) filter (where l.vendor_recoverable)                               as wapas,
    sum(l.amount) filter (where l.paid_by = 'company' and not l.vendor_recoverable)  as hamara
    from public.machinery_fuel_logs l
   where l.booking_id = b.id and l.verification_status = 'verified'
) d on true
where b.status <> 'cancelled' and fn_is_any_staff();

revoke all on public.v_machinery_pnl_booking from anon;
grant select on public.v_machinery_pnl_booking to authenticated, service_role;

comment on view public.v_machinery_pnl_booking is
  'Har booking ka machinery munafa. Sab se ahem baat: ART ka wo diesel jo VENDOR se wapas aata hai, kharche mein NAHI gina jata -- wo kharcha hai hi nahi, aur usay ginna machinery ka munafa jhooti tarah kam kar ke dikhata hai.';

create or replace view public.v_machinery_pnl_machine as
select p.machine_id, p.machine_code, p.machine_type, p.machine_owner, p.vendor_name,
  count(*) as bookings, sum(p.acre) as acre, sum(p.gross_billing) as gross_billing,
  sum(p.vendor_ka_hissa) as vendor_ka_hissa, sum(p.hamari_aamdani) as hamari_aamdani,
  sum(p.diesel_hamara_kharcha) as hamara_diesel,
  sum(p.diesel_wapas_aane_wala) as diesel_wapas_aane_wala, sum(p.munafa) as munafa,
  case when sum(p.acre) > 0 then round(sum(p.munafa) / sum(p.acre), 2) end as munafa_per_acre
from public.v_machinery_pnl_booking p
where p.machine_id is not null
group by p.machine_id, p.machine_code, p.machine_type, p.machine_owner, p.vendor_name;

revoke all on public.v_machinery_pnl_machine from anon;
grant select on public.v_machinery_pnl_machine to authenticated, service_role;

create or replace view public.v_machinery_pnl_vendor as
select p.vendor_id, p.vendor_name,
  count(*) as bookings, sum(p.acre) as acre, sum(p.gross_billing) as gross_billing,
  sum(p.vendor_ka_hissa) as vendor_ka_hissa, sum(p.hamari_aamdani) as hamari_aamdani,
  sum(p.diesel_hamara_kharcha) as hamara_diesel,
  sum(p.diesel_wapas_aane_wala) as diesel_wapas_aane_wala, sum(p.munafa) as munafa
from public.v_machinery_pnl_booking p
where p.vendor_id is not null
group by p.vendor_id, p.vendor_name;

revoke all on public.v_machinery_pnl_vendor from anon;
grant select on public.v_machinery_pnl_vendor to authenticated, service_role;

create or replace view public.v_machinery_pnl_crop as
select coalesce(p.crop_type, 'darj nahi') as crop_type,
  count(*) as bookings, sum(p.acre) as acre, sum(p.gross_billing) as gross_billing,
  sum(p.hamari_aamdani) as hamari_aamdani, sum(p.munafa) as munafa
from public.v_machinery_pnl_booking p
group by coalesce(p.crop_type, 'darj nahi');

revoke all on public.v_machinery_pnl_crop from anon;
grant select on public.v_machinery_pnl_crop to authenticated, service_role;

create or replace view public.v_machinery_pnl_month as
select p.maheena,
  count(*) as bookings, sum(p.acre) as acre, sum(p.gross_billing) as gross_billing,
  sum(p.vendor_ka_hissa) as vendor_ka_hissa, sum(p.hamari_aamdani) as hamari_aamdani,
  sum(p.diesel_hamara_kharcha) as hamara_diesel, sum(p.munafa) as munafa
from public.v_machinery_pnl_booking p
group by p.maheena;

revoke all on public.v_machinery_pnl_month from anon;
grant select on public.v_machinery_pnl_month to authenticated, service_role;

insert into features (key, label, route, icon, label_en, label_ur) values
  ('machinery-rental.machines',  'Machines',            '/admin/machinery-rental/machines', 'Cog',        'Machines',           'مشینیں'),
  ('machinery-rental.diesel',    'Diesel ka Hisaab',    '/admin/machinery-rental/diesel',   'Fuel',       'Diesel',             'ڈیزل کا حساب'),
  ('machinery-rental.pnl',       'Machinery ka Munafa', '/admin/machinery-rental/pnl',      'TrendingUp', 'Machinery P&L',      'مشینری کا منافع'),
  ('machinery-rental.reports',   'Machinery Reports',   '/admin/machinery-rental/reports',  'FileText',   'Machinery Reports',  'مشینری رپورٹس')
on conflict (key) do update set label = excluded.label, route = excluded.route,
  icon = excluded.icon, label_en = excluded.label_en, label_ur = excluded.label_ur;

insert into dashboard_features (dashboard_key, feature_key, sort_order) values
  ('machinery', 'machinery-rental.machines', 30),
  ('machinery', 'machinery-rental.diesel',   31),
  ('machinery', 'machinery-rental.pnl',      32),
  ('machinery', 'machinery-rental.reports',  33),
  ('finance',   'machinery-rental.pnl',      64)
on conflict do nothing;
