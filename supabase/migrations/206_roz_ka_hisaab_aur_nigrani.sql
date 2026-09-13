-- =====================================================================
-- Migration 206: Roz ka hisaab -- aur us ki nigrani
-- =====================================================================
-- Snapshot ka pehra pehle se maujood hai: (subject, subject_id, date)
-- par ek hi qatar. Is liye kaam chahe das dafa chale, us din ka ek hi
-- asal nateeja rehta hai.
--
-- Magar us se ye pata nahi chalta ke kaam CHALA bhi ya nahi. Chup chaap
-- na chalne wala roz ka kaam sab se khatarnak cheez hai: score purana
-- hota jata hai aur kisi ko khabar nahi hoti, kyunke screen par to kuch
-- na kuch likha hi hota hai -- aur purana adad naye adad jaisa hi
-- dikhta hai. Is liye har chakkar apna nishan chhorta hai: chala,
-- kitne bandon par chala, kitni der lagi, aur ghalti hui to kya.

create table if not exists score_runs (
  id            uuid primary key default uuid_generate_v4(),
  run_date      date not null default current_date,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  status        text not null default 'running' check (status in ('running','ok','failed')),
  subjects      int not null default 0,
  error_text    text,
  triggered_by  text not null default 'cron'
);

create index if not exists idx_score_runs_date on score_runs (run_date desc, started_at desc);

alter table score_runs enable row level security;
drop policy if exists p_score_runs_read on score_runs;
create policy p_score_runs_read on score_runs for select
  using (fn_has_dept(array['owner','super_admin','admin']::public.user_role[]));

create or replace function fn_score_daily_run(p_by text default 'cron')
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare
  v_run uuid;
  v_n   int := 0;
  r     record;
begin
  insert into score_runs (triggered_by) values (p_by) returning id into v_run;

  begin
    -- Sirf un bandon par jin ke naam par koi record hai. Jis ka koi
    -- waqia aur koi zimmedari nahi, us ka snapshot banana khali qatar
    -- banana hai -- aur khali qatar baad mein sifar ki tarah parhi
    -- jati hai.
    for r in
      select distinct subject_type, subject_id from score_events where invalidated_at is null
      union
      select distinct subject_type, subject_id from score_obligations where state <> 'cancelled'
    loop
      perform fn_recalc_score(r.subject_type, r.subject_id);
      v_n := v_n + 1;
    end loop;

    update score_runs set status = 'ok', finished_at = now(), subjects = v_n where id = v_run;
  exception when others then
    -- Ghalti chhupai nahi jati. Adhoora chakkar bhi darj hota hai.
    update score_runs
       set status = 'failed', finished_at = now(), subjects = v_n, error_text = sqlerrm
     where id = v_run;
    raise;
  end;

  return v_run;
end;
$$;
