-- =====================================================================
-- 656: Rate anon se chhupao, meter ki photo private
-- =====================================================================
-- fuel_rate_settings par public SELECT (using true) tha, is liye bina
-- login rate parh sakte the. Website is table ko nahi padhti. Staff
-- (login) ab bhi parh sakte hain. milk_rate_settings par agar live par
-- waisa hi khula policy ho to woh bhi hat jata hai.
--
-- meter-readings bucket public tha. Ab private. Purane public URL se
-- path nikal kar signed URL app banati hai — qatarein update nahi hotin.
-- Neeche proposed SQL sirf tab chalegi jab Owner kahe (is file mein
-- EXECUTE nahi, sirf comment).

alter table public.fuel_rate_settings enable row level security;
alter table public.milk_rate_settings enable row level security;

drop policy if exists public_read_fuel_rate_settings on public.fuel_rate_settings;
drop policy if exists public_read_milk_rate_settings on public.milk_rate_settings;
-- Live par policy ka naam public_read_milk_rates hai. Dono naam hatao.
drop policy if exists public_read_milk_rates on public.milk_rate_settings;

revoke select on public.fuel_rate_settings from anon;
revoke select on public.milk_rate_settings from anon;

drop policy if exists staff_read_fuel_rate_settings on public.fuel_rate_settings;
create policy staff_read_fuel_rate_settings on public.fuel_rate_settings
  for select to authenticated
  using (public.fn_is_any_staff());

drop policy if exists staff_read_milk_rate_settings on public.milk_rate_settings;
create policy staff_read_milk_rate_settings on public.milk_rate_settings
  for select to authenticated
  using (public.fn_is_any_staff());

do $b$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'storage' and table_name = 'buckets'
  ) then
    update storage.buckets set public = false where id = 'meter-readings';
  end if;
end
$b$;

-- needs owner approval — ye data cleanup NAHI chali. Sirf us waqt jab
-- Owner likh kar kahe ke purane public URL path mein badalne hain.
-- App purane URL se path khud nikal leti hai, is liye ye zaroori nahi.
-- update public.fuel_logs
--   set meter_photo_url = regexp_replace(meter_photo_url, '^.*meter-readings/', '')
--   where meter_photo_url like '%/meter-readings/%';
