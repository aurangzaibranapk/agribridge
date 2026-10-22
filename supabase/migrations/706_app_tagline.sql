-- 706: AgriBridge tagline. FILE ONLY — Live par mat chalana.
-- Testing project par owner chalaye. Is file ne khud SQL nahi chalayi.
-- Tagline brand ke sath website_settings mein hai. App mein likhi nahi.
-- Roman, Urdu, English. Khali field app par nahi dikhta.
-- Koi naya function nahi. Purani app_brands key nahi chhedti.

insert into public.website_settings (key, value)
values (
  'app_tagline',
  '{"roman":"Kisan ki Seerhi","urdu":"کسان کی سیڑھی","english":"The farmer''s ladder"}'::jsonb
)
on conflict (key) do nothing;
