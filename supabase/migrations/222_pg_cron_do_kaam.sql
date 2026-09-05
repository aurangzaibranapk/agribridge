-- =====================================================================
-- Migration 222: pg_cron -- do alag kaam, alag raftaar
-- =====================================================================
-- Malik ka faisla: score ka nizam cPanel/Passenger ke chalte rehne par
-- munhasir na ho. Website band ho jaye ya server dobara chale, hisaab
-- phir bhi chalta rahe. Is liye kaam database ke andar se chalta hai.
--
-- DO ALAG KAAM, JAAN BOOJH KAR:
--
--   Qatar ka chakkar -- har paanch minute, chhota aur bandha hua
--   Roz ka hisaab    -- din mein ek dafa, poora
--
-- Ek hi kaam mein dono rakhte to ya qatar der se chalti (roz ka hisaab
-- bhaari hai), ya roz ka hisaab har paanch minute chal kar server par
-- bojh daalta. Alag rakhne se dono apni raftaar par chalte hain.
--
-- Score maali lein-dein nahi hai. Paanch minute ki der se kisi ka paisa
-- nahi rukta -- is liye cron ko is se tez rakhne ki koi wajah nahi.

create extension if not exists pg_cron;

-- Purane naam ke kaam pehle hata do, warna dobara chalane par do ban
-- jayenge aur dono ek sath chalenge.
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

-- Har paanch minute -- ek waqt mein sirf do sau parchiyan. Bandha hua
-- kaam is liye ke ek chakkar kabhi itna lamba na ho jaye ke agla us ke
-- upar aa jaye. Aur agar phir bhi aa jaye to advisory lock usay rok
-- deta hai (221, 223).
select cron.schedule(
  'agribridge_score_queue',
  '*/5 * * * *',
  $job$ select public.fn_score_queue_tick(200); $job$
);

-- Roz ek dafa, raat teen baje UTC -- Pakistan mein subah aath baje.
select cron.schedule(
  'agribridge_score_daily',
  '0 3 * * *',
  $job$ select public.fn_score_daily_run('pg_cron'); $job$
);
