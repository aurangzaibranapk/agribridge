-- =====================================================================
-- Migration 223: Taala khud khulne wala ho
-- =====================================================================
-- 221 mein taala pg_try_advisory_lock se liya gaya tha -- wo SESSION ka
-- taala hai aur usay haath se kholna parta hai. Us mein ek khamoshi wali
-- kharabi hai: agar function beech mein kisi aisi ghalti se ruk jaye jo
-- andar wale exception block ne na pakri ho, to unlock wali satar tak
-- baat pahunchti hi nahi -- aur taala laga reh jata hai.
--
-- Us ke baad ka manzar sab se bura hai: agla chakkar aata hai, taala
-- band paata hai, 'skipped' likh kar chala jata hai. Phir agla. Qatar
-- chalti rehti hai, nishan bhi bante rehte hain, magar KAAM KOI NAHI
-- HOTA -- aur upar se sab theek nazar aata hai.
--
-- pg_try_advisory_xact_lock is se mehfooz hai: wo transaction khatam
-- hote hi KHUD khul jata hai, chahe kaamyabi se khatam ho ya ghalti se.
-- Yani taale ka kholna kisi satar par nahi, database par hai.

create or replace function fn_score_queue_tick(p_limit int default 200)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_run uuid; v_q record; v_left int;
begin
  insert into score_runs (kind, triggered_by) values ('drain', 'pg_cron') returning id into v_run;

  -- Do chakkar ek sath nahi. Khamoshi se nahi hat-ta -- apna nishan
  -- 'skipped' likh kar hat-ta hai, taake baad mein pata chale ke kaam
  -- lamba ho raha tha.
  if not pg_try_advisory_xact_lock(hashtext('agribridge.score_drain')) then
    update score_runs set status = 'skipped', finished_at = now(),
           error_text = 'pichhla chakkar abhi chal raha tha'
     where id = v_run;
    return v_run;
  end if;

  begin
    perform fn_score_retry_failed();
    select * into v_q from fn_score_drain_queue(p_limit);
    select count(*) into v_left from score_sync_queue where status = 'pending';
    update score_runs
       set status = 'ok', finished_at = now(),
           queue_done = coalesce(v_q.done, 0), queue_failed = coalesce(v_q.failed, 0),
           queue_remaining = v_left
     where id = v_run;
  exception when others then
    update score_runs set status = 'failed', finished_at = now(), error_text = sqlerrm
     where id = v_run;
  end;

  -- Taala yahan nahi khola ja raha -- wo transaction ke sath khud khul
  -- jayega. Yehi is tabdeeli ka poora maqsad hai.
  return v_run;
end;
$$;
