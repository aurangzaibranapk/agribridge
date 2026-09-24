-- =====================================================================
-- 195  Mansookh bill HAR JAGAH ginti se bahar
-- =====================================================================
--
-- 192 ne bill mansookh karne ka raasta banaya. Us mein ek buniyadi
-- ghalti thi, aur wo asal paison par nazar aayi:
--
--   Vendor ke safhe par us ka hissa Rs 51,040 likha aaya -- jabke us
--   ka ek hi zinda bill hai, Rs 24,640 ka. Baqi Rs 26,400 us MANSOOKH
--   bill ke the jo ulta ja chuka tha. Yani mansookhi ke baad bhi wo
--   bill kai jagah kamai ban kar khara tha.
--
-- Jarh ye thi: nayi haalat (mansookh) BANA di gayi, magar us ke sare
-- PARHNE WALON ko nahi batayi gayi. Gyarah view machinery_bills parhte
-- hain aur sirf ek -- P&L -- ko mansookhi ka ilm tha, kyunke wo ittefaq
-- se usi waqt dobara likha ja raha tha.
--
-- Yehi is project ka purana sabaq hai, ulti taraf se: jab kisi cheez ka
-- ek malik hota hai to us ke har parhne wale ko us ke har haal ka pata
-- hona chahiye. Ek nayi haalat banate waqt sawal ye nahi ke "yahan
-- theek lag raha hai?" -- sawal ye hai ke "ise parhta kaun kaun hai?"
--
-- TAREEQA. Har jagah haath se shart lagana gyarah mauqe hain ghalti ke,
-- aur agla view phir bhool jayega. Is liye table ki jagah wo sawal
-- rakha ja raha hai jo hamesha sirf ZINDA bill deta hai:
--
--   machinery_bills bl
--     ->  (select * from machinery_bills where cancelled_at is null) bl
--
-- Alias wohi, khane wohi, baqi shartein jyon ki tyon -- sirf andar wala
-- source badla. Is liye har shakl par ek hi tarah lagta hai: LEFT JOIN
-- par bhi, FROM par bhi, aur EXISTS ke andar bhi.
--
-- Matn mein likha hua 'machinery_bills' (jaise journal_entry_sources ka
-- source_table) jaan boojh kar chhoota nahi jata -- us se pehle quote
-- hota hai, aur pattern quote ke baad wale ko nahi pakarta.

do $$
declare
  r record;
  v_def text;
  v_new text;
  v_kitne int := 0;
begin
  for r in
    select c.oid, c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind = 'v'
       and pg_get_viewdef(c.oid, true) ~ '[^'']machinery_bills\s+[a-z]'
     order by c.oid
  loop
    v_def := pg_get_viewdef(r.oid, true);

    v_new := regexp_replace(
      v_def,
      '([^''])machinery_bills(\s+)([a-z][a-z0-9_]*)',
      '\1(SELECT * FROM machinery_bills WHERE cancelled_at IS NULL)\2\3',
      'g'
    );

    if v_new is distinct from v_def then
      execute format('create or replace view public.%I as %s', r.relname, v_new);
      v_kitne := v_kitne + 1;
    end if;
  end loop;

  raise notice '195: % view ab sirf zinda bill parhte hain', v_kitne;
end $$;
