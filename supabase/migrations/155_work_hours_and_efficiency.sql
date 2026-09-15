-- 155: Ghante khud niklein, aur diesel ka average
--
-- Form par "Meter / ghante" ek hi khana tha aur wo haath se bhara jata
-- tha -- jabke us ke theek upar shuru aur khatam ka waqt likha ja
-- chuka hota hai. Do waqt maujood hon aur phir bhi ghante poochhe
-- jayein, to do cheezein hoti hain: aadmi andaza likh deta hai, aur
-- kisi din wo andaza waqt se alag ho jata hai. Us ke baad koi nahi
-- bata sakta ke sach kaun sa hai.
--
-- Aur ye do alag cheezein bhi ek khane mein mila di gayi thin:
--   meter_reading -- machine ka apna meter (kitne ghante chal chuki hai)
--   ghante        -- IS kaam mein kitni chali
-- Pehla machine ki umar hai, doosra is booking ka hisaab. Ab ghante
-- waqt se khud nikalte hain aur meter apni jagah rehta hai.
--
-- Isi se wo adad banta hai jo maidan mein sab se zyada poochha jata
-- hai: "itne ghante mein itna diesel -- ye machine kitna khaati hai?"

alter table public.machinery_work_records
  add column if not exists work_hours numeric(10,2)
    generated always as (
      case
        when started_at is not null and finished_at is not null
          then round(extract(epoch from (finished_at - started_at))::numeric / 3600, 2)
        else null
      end
    ) stored;

comment on column public.machinery_work_records.work_hours is
  'Is kaam mein machine kitni chali -- shuru aur khatam ke waqt se KHUD nikalta hai, haath se nahi bhara jata.';
comment on column public.machinery_work_records.meter_reading is
  'Machine ka apna meter us waqt. Ye machine ki umar hai, is kaam ke ghante nahi -- wo work_hours mein hain.';

-- ---------------------------------------------------------------
-- Har booking ka hisaab: kitna kaam, kitne ghante, kitna diesel
--
-- Sirf TASDEEQ SHUDA qatarein ginti hain -- dawa abhi hisaab nahi
-- banta (150, 152).
--
-- Diesel do adad mein rakha gaya hai. "Kul diesel" wo hai jo machine ne
-- waqai piya -- chahe kisi ne bhi dala ho, aur average isi se nikalta
-- hai (machine ko farq nahi parta ke paisa kis ne diya). "Hamara
-- diesel" wo hai jo hamare khate se gaya -- ye munafe ka sawal hai.
-- Dono ko ek adad bana dena dono jawab kharab kar deta.
-- ---------------------------------------------------------------
create or replace view public.v_machinery_work_efficiency as
select
  b.id                as booking_id,
  b.booking_number,
  b.status,
  f.full_name         as farmer_name,
  v.vendor_name,

  w.kul_acre,
  w.kul_ghante,
  fl.kul_litre,
  fl.kul_diesel_raqam,
  fl.hamara_diesel,

  -- Average tabhi jab dono adad maujood hon. Sifar se taqseem par
  -- null -- "0 litre per hour" jhoot hota, "abhi pata nahi" sach hai.
  case when coalesce(w.kul_ghante, 0) > 0 and fl.kul_litre is not null
       then round(fl.kul_litre / w.kul_ghante, 2) end                  as litre_per_ghanta,
  case when coalesce(w.kul_ghante, 0) > 0 and w.kul_acre is not null
       then round(w.kul_acre / w.kul_ghante, 2) end                    as acre_per_ghanta,
  case when coalesce(w.kul_acre, 0) > 0 and fl.kul_litre is not null
       then round(fl.kul_litre / w.kul_acre, 2) end                    as litre_per_acre,
  case when coalesce(w.kul_acre, 0) > 0 and fl.kul_diesel_raqam is not null
       then round(fl.kul_diesel_raqam / w.kul_acre, 2) end             as diesel_kharcha_per_acre

from public.machinery_bookings b
left join public.farmers f on f.id = b.farmer_id
left join public.machinery_vendors v on v.id = b.vendor_id
left join lateral (
  select sum(w2.actual_area) as kul_acre,
         sum(w2.work_hours)  as kul_ghante
    from public.machinery_work_records w2
   where w2.booking_id = b.id
     and w2.verification_status = 'verified'
) w on true
left join lateral (
  select sum(l.litres) as kul_litre,
         sum(l.amount) as kul_diesel_raqam,
         sum(l.amount) filter (where l.paid_by = 'company') as hamara_diesel
    from public.machinery_fuel_logs l
   where l.booking_id = b.id
     and l.verification_status = 'verified'
) fl on true
where fn_is_any_staff();

revoke all on public.v_machinery_work_efficiency from anon;
grant select on public.v_machinery_work_efficiency to authenticated, service_role;

comment on view public.v_machinery_work_efficiency is
  'Har booking: kitna raqba, kitne ghante, kitna diesel -- aur un se nikalne wale average (litre per ghanta, acre per ghanta, litre per acre). Sirf tasdeeq shuda indraj ginte hain.';
