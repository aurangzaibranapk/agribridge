-- =====================================================================
-- 720: ID card — application se phone, CNIC, blood, emergency, photo
-- =====================================================================
-- Joining form par blood group aur emergency pehle the hi nahi.
-- Official login sirf designation / tankhwah likhta tha, is liye
-- staff_details.phone aur cnic khali reh gaye jabke job_applications
-- par wo darj the. ID card staff_details parhta hai, is liye dash.
--
-- Ye file:
--   1. job_applications par blood, emergency, photo ke khane
--   2. pehle se joined staff par khali khane application se bharna
--      (jo bhara hai usay nahi chherta)
-- Live par mat chalao jab tak backup verify na ho.
-- Pehle Testing (hwaiuwxqldxsoukkfefn), phir Live (ktskwawkslaznkjjacni).

alter table public.job_applications
  add column if not exists blood_group text,
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text,
  add column if not exists photo_url text;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'chk_job_application_blood_group'
  ) then
    alter table public.job_applications
      add constraint chk_job_application_blood_group
      check (
        blood_group is null
        or blood_group in ('A+','A-','B+','B-','AB+','AB-','O+','O-')
      );
  end if;
end $$;

comment on column public.job_applications.blood_group is
  'Staff ID card. Null = abhi maloom nahi. Sirf A+ A- B+ B- AB+ AB- O+ O-.';
comment on column public.job_applications.emergency_contact_name is
  'ID card ke emergency raabte ka naam. Optional.';
comment on column public.job_applications.emergency_contact_phone is
  'ID card ke emergency raabte ka number. Optional.';
comment on column public.job_applications.photo_url is
  'ID card ki tasveer. CNIC ki scan nahi — alag photo.';

-- Joined staff: khali khane application se. Bhara hua HR record rehta hai.
with chosen as (
  select distinct on (ja.created_profile_id)
    ja.created_profile_id as profile_id,
    ja.id as application_id,
    nullif(btrim(ja.phone), '') as phone,
    nullif(btrim(ja.cnic), '') as cnic,
    nullif(btrim(ja.address), '') as address,
    nullif(btrim(ja.gender), '') as gender,
    nullif(btrim(ja.blood_group), '') as blood_group,
    nullif(btrim(ja.emergency_contact_name), '') as emergency_contact_name,
    nullif(btrim(ja.emergency_contact_phone), '') as emergency_contact_phone,
    nullif(btrim(ja.photo_url), '') as photo_url,
    (
      select o.id
      from public.job_offers o
      where o.application_id = ja.id
        and o.status = 'accepted'
      order by o.accepted_at desc nulls last, o.created_at desc
      limit 1
    ) as offer_id
  from public.job_applications ja
  where ja.created_profile_id is not null
  order by ja.created_profile_id,
           (ja.status = 'joined') desc,
           ja.hired_at desc nulls last,
           ja.created_at desc
)
update public.staff_details sd
set
  phone = coalesce(nullif(btrim(sd.phone), ''), c.phone),
  cnic = coalesce(nullif(btrim(sd.cnic), ''), c.cnic),
  address = coalesce(nullif(btrim(sd.address), ''), c.address),
  gender = coalesce(nullif(btrim(sd.gender), ''), c.gender),
  blood_group = coalesce(nullif(btrim(sd.blood_group), ''), c.blood_group),
  emergency_contact_name = coalesce(nullif(btrim(sd.emergency_contact_name), ''), c.emergency_contact_name),
  emergency_contact_phone = coalesce(nullif(btrim(sd.emergency_contact_phone), ''), c.emergency_contact_phone),
  photo_url = coalesce(nullif(btrim(sd.photo_url), ''), c.photo_url),
  application_id = coalesce(sd.application_id, c.application_id),
  offer_id = coalesce(sd.offer_id, c.offer_id)
from chosen c
where sd.profile_id = c.profile_id
  and (
    (nullif(btrim(sd.phone), '') is null and c.phone is not null)
    or (nullif(btrim(sd.cnic), '') is null and c.cnic is not null)
    or (nullif(btrim(sd.address), '') is null and c.address is not null)
    or (nullif(btrim(sd.gender), '') is null and c.gender is not null)
    or (nullif(btrim(sd.blood_group), '') is null and c.blood_group is not null)
    or (nullif(btrim(sd.emergency_contact_name), '') is null and c.emergency_contact_name is not null)
    or (nullif(btrim(sd.emergency_contact_phone), '') is null and c.emergency_contact_phone is not null)
    or (nullif(btrim(sd.photo_url), '') is null and c.photo_url is not null)
    or sd.application_id is null
    or (sd.offer_id is null and c.offer_id is not null)
  );
