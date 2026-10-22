-- 706: AgriBridge tagline. FILE ONLY — Live par mat chalana.
-- Testing project par owner chalaye. Is file ne khud SQL nahi chalayi.
-- Tagline brand ke sath website_settings mein hai. App mein likhi nahi.
-- Roman, Urdu, English. Khali field app par nahi dikhta.
-- Koi naya function nahi. Purani app_brands key nahi chhedti.

insert into public.website_settings (key, value)
values (
  'app_tagline',
  '{"roman":"Wasela Kisan Ka","urdu":"وسیلہ کسان کا","english":"The farmer''s bridge"}'::jsonb
)
on conflict (key) do nothing;

-- Purani seed 'Kisan ki Seerhi' ho to sirf wahi badlo. Baad ki owner edit nahi chhedte.
update public.website_settings
set value = '{"roman":"Wasela Kisan Ka","urdu":"وسیلہ کسان کا","english":"The farmer''s bridge"}'::jsonb,
    updated_at = now()
where key = 'app_tagline'
  and value->>'roman' = 'Kisan ki Seerhi';
