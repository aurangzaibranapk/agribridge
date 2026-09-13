-- =====================================================================
-- Migration 224: Cron ka kaam sab se aakhir mein -- aur us par pehra
-- =====================================================================
-- Live par chalate waqt ek tarteeb ki kharabi saamne aayi:
--
--   222 ne wo cron job banaya jo public.fn_score_queue_tick(200) ko
--       bulata hai
--   223 ne wo function banaya
--
-- Yani job us function ka naam le kar khara ho gaya jo us waqt tha hi
-- nahi. pg_cron command ka sirf MATN mehfooz karta hai -- wo ye nahi
-- dekhta ke function maujood bhi hai ya nahi. Is liye 222 kaamyab ho
-- gayi aur koi ghalti zahir nahi hui.
--
-- Nuqsan chhota tha: agar theek un do migration ke darmiyan (chand
-- second) cron chal jata to ek tick nakaam hota aur bas. Data par koi
-- asar nahi. Magar KHAMOSHI ahem hai -- kharabi chhup gayi thi, aur
-- yehi is nizam mein sab se khatarnak kism ki kharabi hai.
--
-- YAHAN 222 KO NAHI BADLA JA RAHA. Wo dono database par chal chuki hai;
-- chali hui migration ka matn badalna file ko jhoota bana dena hai --
-- kaghaz kuch aur kehta, asal mein kuch aur chala tha.
--
-- Is ke bajaye scheduling yahan dobara ki ja rahi hai -- yani SAB
-- FUNCTION BAN JANE KE BAAD. Jo database pehle se chal raha hai us par
-- ye kuch nahi badalta (wohi naam, wohi waqt, wohi command). Aur jo
-- database naye sire se banega, us mein aakhri baat yehi hogi.
--
-- Sath hi pehra bhi lagaya ja raha hai: agar function maujood na ho to
-- migration RUKEGI, chup chaap aage nahi barhegi. Aaj ye pehra kuch
-- nahi rokta -- wo kal ke liye hai, jab koi tarteeb dobara badle.
-- ---------------------------------------------------------------

-- ---------------------------------------------------------------
-- 1) Pehra -- pehle ye sabit karo ke jise bulana hai wo maujood hai
-- ---------------------------------------------------------------
do $$
declare missing text[] := '{}';
begin
  if to_regprocedure('public.fn_score_queue_tick(int)') is null then
    missing := array_append(missing, 'fn_score_queue_tick(int)');
  end if;
  if to_regprocedure('public.fn_score_daily_run(text)') is null then
    missing := array_append(missing, 'fn_score_daily_run(text)');
  end if;

  if array_length(missing, 1) > 0 then
    raise exception
      'Cron ka kaam nahi lagaya ja sakta -- ye function maujood hi nahi: %. Pehle 220-223 chalayein.',
      array_to_string(missing, ', ');
  end if;
end $$;

-- ---------------------------------------------------------------
-- 2) Dono kaam dobara -- ab function pakka maujood hai
-- ---------------------------------------------------------------
-- Purana hata kar naya lagaya ja raha hai. Naam wohi hai, is liye
-- pehle se chalte hue database par nateeja bilkul wohi rehta hai --
-- do job nahi bantin.
do $$
begin
  perform cron.unschedule('agribridge_score_queue');
exception when others then null;
end $$;

do $$
begin
  perform cron.unschedule('agribridge_score_daily');
exception when others then null;
end $$;

-- Qatar ka chakkar -- har paanch minute, ek waqt mein do sau parchiyan.
select cron.schedule(
  'agribridge_score_queue',
  '*/5 * * * *',
  $job$ select public.fn_score_queue_tick(200); $job$
);

-- Roz ka hisaab -- raat teen baje UTC (Pakistan mein subah aath baje).
select cron.schedule(
  'agribridge_score_daily',
  '0 3 * * *',
  $job$ select public.fn_score_daily_run('pg_cron'); $job$
);

-- ---------------------------------------------------------------
-- 3) Aakhir mein ginti -- dono kaam lage bhi ya nahi
-- ---------------------------------------------------------------
-- Migration ka "kaamyab" ho jana kaafi nahi. Upar ka select chal gaya
-- iska matlab ye nahi ke job waqai qatar mein hai. Yahan wo khud dekha
-- ja raha hai.
do $$
declare n int;
begin
  select count(*) into n from cron.job
   where jobname in ('agribridge_score_queue', 'agribridge_score_daily')
     and active;

  if n <> 2 then
    raise exception 'Cron ke dono kaam chalu hone chahiye the, magar % mile', n;
  end if;
end $$;
