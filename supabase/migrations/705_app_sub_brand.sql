-- 705: Phone sub-brand slot. FILE ONLY — Live par mat chalana.
-- Testing project par owner chalaye. Is file ne khud SQL nahi chalayi.
-- AgriBridge umbrella code mein hai. Phone par website ka naam nahi.
-- Khali array. Nayi brand baad mein object se. current true sirf ek par.
-- logo_url tab jab https ho. Koi naya function nahi.

insert into public.website_settings (key, value)
values ('app_brands', '[]'::jsonb)
on conflict (key) do nothing;

-- Purani seed mein website ka naam ho to phone wali key se hatao.
update public.website_settings
set value = (
  select coalesce(
    jsonb_agg(elem) filter (
      where coalesce(elem->>'name', '') !~* 'al[[:space:]]*rana'
    ),
    '[]'::jsonb
  )
  from jsonb_array_elements(
    case when jsonb_typeof(value) = 'array' then value else '[]'::jsonb end
  ) elem
),
updated_at = now()
where key = 'app_brands'
  and value::text ~* 'al[[:space:]]*rana';
