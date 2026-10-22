-- 705: Phone sub-brand. FILE ONLY — Live par mat chalana.
-- Testing project par owner chalaye. Is file ne khud SQL nahi chalayi.
-- AgriBridge umbrella code mein hai. Chhota brand is key mein hai.
-- Nayi brand: array mein ek object aur. current true sirf ek par.
-- logo_url null jab tak https logo na ho. Koi naya function nahi.

insert into public.website_settings (key, value)
values (
  'app_brands',
  '[{"name":"Al Rana Traders","logo_url":null,"current":true}]'::jsonb
)
on conflict (key) do nothing;
