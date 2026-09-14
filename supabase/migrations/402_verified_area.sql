-- Hissa A.1 (14 September) -- "kitni kattai howi" ka sahi jawab.
--
-- `harvest_area`/`harvest_area_acres` booking banate waqt ka ANDAZA
-- hai -- aur wo hamesha andaza hi rehna chahiye (jaisa `estimated_rate`
-- kabhi khud nahi badalta). Baad mein jab `sabit_area`/`kutra_area`
-- theek kiye jate hain (sendRateConfirmation, ya asal verified kaam se),
-- ye purana andaza kabhi update nahi hota -- is se ek asal ghalti bani:
-- "13 acre" bataya gaya jab asal 15.375 acre tha.
--
-- Dashboard ke maujooda KPI (Booked Acres = andaza, Completed Acres =
-- `machinery_work_records` se `kaam_hua`) dono theek hain -- unhein
-- chherne ki zaroorat nahi. Ye column sirf AAINDA kisi bhi report/AI
-- sawal ke liye hai jahan "kitna asal/tasdeeq shuda raqba hai" poocha
-- jaye -- taake har dafa `sabit_area + kutra_area` yaad rakh kar likhna
-- na paRe.

alter table public.machinery_bookings
  add column if not exists verified_area numeric(12, 4)
  generated always as (
    case
      when harvest_type is not null then coalesce(sabit_area, 0) + coalesce(kutra_area, 0)
      else coalesce(harvest_area_acres, 0) + coalesce(harvest_area_kanal, 0) / 8
    end
  ) stored;

comment on column public.machinery_bookings.verified_area is
  'Tasdeeq shuda/asal raqba -- reports aur AI isay jama karein, harvest_area_acres ko nahi (wo sirf andaza hai).';
