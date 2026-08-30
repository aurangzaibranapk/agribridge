-- 172: Vendor ka poora settlement -- har raqam apne naam se
--
-- Vendor ko ek "baqi" ka adad dikhana kaafi nahi, aur wohi jhagRe ki
-- jarh hai. Us ke liye ye ek adad nahi, TEEN alag baatein hain:
--
--   1. Jo hamare paas jama hai  -- kisan de chuka, hum ne rakha hua hai
--   2. Jo abhi kisan ke paas hai -- kisan ne abhi diya hi nahi
--   3. Jo mil chuka                -- ja chuka
--
-- In teenon ko jor kar ek adad dikhana vendor ko ye samjhata hai ke
-- hum us ka paisa roke baithe hain, jabke aadha paisa abhi hamare
-- paas aaya hi nahi. Aur us ke baad har baat jhagRa banti hai.
--
-- Taqseem ka usool saada rakha gaya: jitna kisan ne diya, utna vendor
-- ka hamare paas jama hai; us se aage wala abhi kisan ke paas hai. Ye
-- andaza nahi, seedha hisaab hai.
--
-- Sath: vendor ke kaam ka hisaab acre mein, aane wale saat din, aur
-- us ka diesel. Vendor subah safha kholta hai to do sawal le kar aata
-- hai -- "kitna kaam mera hai" aur "aaj kahan jana hai". Dono ke
-- jawab ab qatar mein hain.
--
-- Aur do khabrein jo kahin darj hi nahi hoti thin: "khet pahunch
-- gaya" aur "kaam shuru". Kisan phone karta hai ke machine nahi aayi
-- aur hamare paas jawab nahi hota. Ye PAISE ki baat nahi, is liye
-- tasdeeq bhi nahi -- sirf khabar, aur khabar ka der se aana hi us ka
-- sab se bara masla hai.

create or replace view public.v_machinery_vendor_booking_settlement as
select
  b.id                as booking_id,
  b.booking_number,
  b.booking_date,
  b.status,
  v.id                as vendor_id,
  v.vendor_name,
  v.user_id,
  f.full_name         as farmer_name,
  coalesce(bl.gross_amount, 0)        as gross,
  coalesce(bl.commission_amount, 0)   as art_commission,
  coalesce(bl.diesel_deducted, 0)     as kisan_ka_diesel,
  coalesce(bl.vendor_payable, 0)      as vendor_ka_hissa,
  coalesce(b.amount_paid_to_vendor, 0) as vendor_ko_mila,
  greatest(coalesce(bl.vendor_payable, 0) - coalesce(b.amount_paid_to_vendor, 0), 0) as vendor_ka_baqi,
  coalesce(fp.mila, 0)                as kisan_ne_diya,
  least(
    greatest(coalesce(bl.vendor_payable, 0) - coalesce(b.amount_paid_to_vendor, 0), 0),
    coalesce(fp.mila, 0)
  )                                   as art_ke_paas_jama,
  greatest(
    greatest(coalesce(bl.vendor_payable, 0) - coalesce(b.amount_paid_to_vendor, 0), 0)
      - coalesce(fp.mila, 0), 0
  )                                   as kisan_ke_paas,
  coalesce(art.diesel, 0)             as art_diesel_advance
from public.machinery_bookings b
join public.machinery_vendors v on v.id = b.vendor_id
left join public.farmers f on f.id = b.farmer_id
left join public.machinery_bills bl on bl.booking_id = b.id
left join lateral (
  select sum(p.amount) as mila
    from public.machinery_payments p
   where p.booking_id = b.id
     and p.kind = 'final'
     and p.verification_status = 'verified'
) fp on true
left join lateral (
  select sum(l.amount) as diesel
    from public.machinery_fuel_logs l
   where l.booking_id = b.id
     and l.vendor_recoverable
     and l.verification_status = 'verified'
) art on true
where b.status <> 'cancelled'
  and (fn_is_any_staff() or v.user_id = auth.uid());

revoke all on public.v_machinery_vendor_booking_settlement from anon;
grant select on public.v_machinery_vendor_booking_settlement to authenticated, service_role;

comment on view public.v_machinery_vendor_booking_settlement is
  'Har booking par vendor ka hisaab, har raqam apne naam se. In ko jor kar ek adad dikhana wohi ghalti hai jis se jhagRa shuru hota hai.';

create or replace view public.v_machinery_vendor_settlement as
select
  s.vendor_id,
  s.vendor_name,
  s.user_id,
  count(*)                              as kitni_bookings,
  sum(s.gross)                          as kul_gross,
  sum(s.art_commission)                 as kul_commission,
  sum(s.kisan_ka_diesel)                as kul_kisan_diesel,
  sum(s.vendor_ka_hissa)                as kul_hissa,
  sum(s.vendor_ko_mila)                 as kul_mila,
  sum(s.vendor_ka_baqi)                 as kul_baqi,
  sum(s.art_ke_paas_jama)               as art_ke_paas_jama,
  sum(s.kisan_ke_paas)                  as kisan_ke_paas,
  sum(s.art_diesel_advance)             as art_diesel_advance,
  greatest(sum(s.art_ke_paas_jama) - sum(s.art_diesel_advance), 0) as net_abhi_dena
from public.v_machinery_vendor_booking_settlement s
group by s.vendor_id, s.vendor_name, s.user_id;

revoke all on public.v_machinery_vendor_settlement from anon;
grant select on public.v_machinery_vendor_settlement to authenticated, service_role;

comment on view public.v_machinery_vendor_settlement is
  'Har vendor ka poora khata. "Net abhi dena" wo raqam hai jo waqai abhi di ja sakti hai: jo hamare paas jama hai, us mein se ART ka diesel kaat kar. Kisan ke paas wali raqam is mein NAHI -- wo hamare paas aayi hi nahi.';

create or replace view public.v_machinery_vendor_work as
select
  v.id                as vendor_id,
  v.user_id,
  count(*) filter (where b.status <> 'cancelled')                       as kitni_bookings,
  coalesce(sum(b.harvest_area) filter (where b.status <> 'cancelled'), 0) as book_hue_acre,
  coalesce(sum(w.kiya) filter (where b.status <> 'cancelled'), 0)         as mukammal_acre,
  coalesce(sum(
    case when b.status <> 'cancelled' and not coalesce(w.poora, false)
         then coalesce(w.kiya, 0) end
  ), 0)                                                                  as chal_rahe_acre,
  coalesce(sum(
    case when b.status <> 'cancelled' and not coalesce(w.poora, false)
         then greatest(coalesce(b.harvest_area, 0) - coalesce(w.kiya, 0), 0) end
  ), 0)                                                                  as baqi_acre,
  coalesce(sum(
    case when b.status <> 'cancelled'
          and not coalesce(w.poora, false)
          and b.preferred_date between current_date and current_date + 7
         then coalesce(b.harvest_area, 0) end
  ), 0)                                                                  as agle_7_din_acre
from public.machinery_vendors v
left join public.machinery_bookings b on b.vendor_id = v.id
left join lateral (
  select sum(w2.actual_area) as kiya, bool_or(w2.is_final) as poora
    from public.machinery_work_records w2
   where w2.booking_id = b.id and w2.verification_status = 'verified'
) w on true
where fn_is_any_staff() or v.user_id = auth.uid()
group by v.id, v.user_id;

revoke all on public.v_machinery_vendor_work from anon;
grant select on public.v_machinery_vendor_work to authenticated, service_role;

comment on view public.v_machinery_vendor_work is
  'Vendor ke kaam ka hisaab acre mein. Sirf TASDEEQ SHUDA kaam gina jata hai.';

create or replace view public.v_machinery_vendor_week as
select
  v.id                as vendor_id,
  v.user_id,
  b.id                as booking_id,
  b.booking_number,
  b.preferred_date,
  b.preferred_time,
  f.full_name         as farmer_name,
  f.phone_number      as farmer_phone,
  b.harvest_area,
  b.crop_type,
  coalesce(b.village, f.village) as village,
  b.location_address,
  b.location_lat,
  b.location_lng,
  m.machine_type,
  m.model             as machine_model,
  m.driver_name,
  m.driver_phone,
  coalesce(w.kiya, 0) as ho_chuka
from public.machinery_bookings b
join public.machinery_vendors v on v.id = b.vendor_id
left join public.farmers f on f.id = b.farmer_id
left join public.machinery_vendor_machines m on m.id = b.machine_id
left join lateral (
  select sum(w2.actual_area) as kiya, bool_or(w2.is_final) as poora
    from public.machinery_work_records w2
   where w2.booking_id = b.id and w2.verification_status = 'verified'
) w on true
where b.status <> 'cancelled'
  and not coalesce(w.poora, false)
  and b.preferred_date between current_date and current_date + 7
  and (fn_is_any_staff() or v.user_id = auth.uid());

revoke all on public.v_machinery_vendor_week from anon;
grant select on public.v_machinery_vendor_week to authenticated, service_role;

comment on view public.v_machinery_vendor_week is
  'Vendor ka aane wala hafta: kis din, kis kisan ke paas, kitne acre, kahan, kaun si machine.';

create or replace view public.v_machinery_vendor_diesel as
select
  v.id                as vendor_id,
  v.user_id,
  coalesce(sum(l.litres), 0)                                          as kul_litre,
  coalesce(sum(l.amount), 0)                                          as kul_raqam,
  coalesce(sum(l.amount) filter (where l.paid_by = 'vendor'), 0)       as vendor_ne_diya,
  coalesce(sum(l.amount) filter (where l.paid_by = 'farmer'), 0)       as kisan_ne_diya,
  coalesce(sum(l.amount) filter (where l.paid_by = 'company'), 0)      as art_ne_diya
from public.machinery_vendors v
join public.machinery_bookings b on b.vendor_id = v.id
join public.machinery_fuel_logs l on l.booking_id = b.id
where l.verification_status = 'verified'
  and (fn_is_any_staff() or v.user_id = auth.uid())
group by v.id, v.user_id;

revoke all on public.v_machinery_vendor_diesel from anon;
grant select on public.v_machinery_vendor_diesel to authenticated, service_role;

comment on view public.v_machinery_vendor_diesel is
  'Vendor ki machines par kitna diesel laga aur kis ne diya. Sirf tasdeeq shuda.';

-- ---------------------------------------------------------------
-- "Khet pahunch gaya" aur "kaam shuru"
-- ---------------------------------------------------------------
alter table public.machinery_bookings
  add column if not exists reached_farm_at timestamptz,
  add column if not exists work_started_at timestamptz;

comment on column public.machinery_bookings.reached_farm_at is
  'Vendor ne kaha ke machine khet pahunch gayi. Paise se koi taalluq nahi -- sirf khabar, taake kisan ke phone ka jawab ho.';
comment on column public.machinery_bookings.work_started_at is
  'Vendor ne kaha ke kaam shuru ho gaya. Ye asal kaam ka indraj NAHI -- wo alag hai aur us ki tasdeeq hoti hai.';

drop policy if exists machinery_bookings_vendor_progress on public.machinery_bookings;
create policy machinery_bookings_vendor_progress on public.machinery_bookings
  for update
  using (
    vendor_id in (select v.id from public.machinery_vendors v where v.user_id = auth.uid())
  )
  with check (
    vendor_id in (select v.id from public.machinery_vendors v where v.user_id = auth.uid())
  );

-- Aur ye guard us update ko sirf in do khanon tak mehdood rakhta hai.
-- Shart likhne WALE par nahi, badli jane wali CHEEZ par hai.
create or replace function public.fn_guard_vendor_booking_update()
returns trigger language plpgsql as $$
declare
  v_is_vendor boolean;
begin
  select exists (
    select 1 from public.machinery_vendors v
     where v.user_id = auth.uid() and v.id = old.vendor_id
  ) into v_is_vendor;

  if not v_is_vendor or fn_is_any_staff() then
    return new;
  end if;

  if (new.final_rate, new.rate_status, new.status, new.harvest_area_acres, new.harvest_area_kanal,
      new.vendor_id, new.machine_id, new.amount_paid_to_vendor, new.commission_percentage,
      new.commission_amount, new.vendor_payable, new.total_amount, new.farmer_id)
     is distinct from
     (old.final_rate, old.rate_status, old.status, old.harvest_area_acres, old.harvest_area_kanal,
      old.vendor_id, old.machine_id, old.amount_paid_to_vendor, old.commission_percentage,
      old.commission_amount, old.vendor_payable, old.total_amount, old.farmer_id) then
    raise exception 'Vendor sirf ye bata sakta hai ke machine pahunch gayi ya kaam shuru hua -- rate, raqba, halat aur hisaab us ke haath mein nahi.';
  end if;

  return new;
end $$;

drop trigger if exists trg_guard_vendor_booking_update on public.machinery_bookings;
create trigger trg_guard_vendor_booking_update
  before update on public.machinery_bookings
  for each row execute function public.fn_guard_vendor_booking_update();

insert into features (key, label, route, icon, label_en, label_ur) values
  ('machinery-rental.vendor-settlement', 'Vendor Settlement', '/admin/machinery-rental/vendor-settlement', 'Scale',
   'Vendor Settlement', 'وینڈر سیٹلمنٹ')
on conflict (key) do update set label = excluded.label, route = excluded.route,
  icon = excluded.icon, label_en = excluded.label_en, label_ur = excluded.label_ur;

insert into dashboard_features (dashboard_key, feature_key, sort_order) values
  ('machinery', 'machinery-rental.vendor-settlement', 29),
  ('finance',   'machinery-rental.vendor-settlement', 63)
on conflict do nothing;
