-- 706: AgriBridge tagline. Testing par. Live par mat chalana.
-- App mein default pehle se hai. Ye key baad mein roman/urdu badal sakti hai.
-- English gloss nahi. Koi naya function nahi. app_brands nahi chhedti.

insert into public.website_settings (key, value)
values (
  'app_tagline',
  '{"roman":"Kisan ka Wasela","urdu":"کسان کا وسیلہ"}'::jsonb
)
on conflict (key) do nothing;

-- Purani seed ya English gloss ho to sirf wahi badlo.
update public.website_settings
set value = '{"roman":"Kisan ka Wasela","urdu":"کسان کا وسیلہ"}'::jsonb,
    updated_at = now()
where key = 'app_tagline'
  and (
    coalesce(value->>'roman', '') in ('Kisan ki Seerhi', 'Wasela Kisan Ka')
    or coalesce(value->>'english', '') ~* 'farmer''s bridge'
  );
