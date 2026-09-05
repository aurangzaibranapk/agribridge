-- =====================================================================
-- Migration 221: Runner ko mazboot karna -- cron lagane se pehle
-- =====================================================================
-- Cron ka matlab hai: koi insaan nahi dekh raha. Is liye chaar cheezein
-- pehle bandhni thin, warna cron un ki ghalti har paanch minute dohrata
-- rehta:
--
--   1. Do chakkar ek sath na chalen  -- warna ek hi parchi do dafa
--   2. Ek hi parchi do haathon mein na aaye
--   3. Jo parchi kabhi theek nahi hogi wo hamesha na ghoomti rahe
--   4. Har chakkar apna nishan chhore -- chala, kitni ki, kitni bachi
--
-- Teesri baat ke liye 'dead' ka darja banaya gaya. Wo 'failed' se alag
-- hai kyunke dono ka ilaj alag hai: failed dobara chal sakti hai, dead
-- ko INSAAN ke dekhne ki zaroorat hai. Dono ek rakhte to ya wo hamesha
-- ghoomti rehti, ya chup chaap gum ho jati.

alter table score_runs add column if not exists kind text not null default 'daily';
alter table score_runs add column if not exists queue_remaining int;

alter table score_runs drop constraint if exists score_runs_status_check;
alter table score_runs add constraint score_runs_status_check
  check (status in ('running', 'ok', 'failed', 'skipped'));

alter table score_runs drop constraint if exists chk_score_run_kind;
alter table score_runs add constraint chk_score_run_kind
  check (kind in ('daily', 'drain'));

alter table score_sync_queue drop constraint if exists score_sync_queue_status_check;
alter table score_sync_queue add constraint score_sync_queue_status_check
  check (status in ('pending', 'done', 'failed', 'dead'));

-- Purane roop ka return type alag tha, is liye pehle girana zaroori hai.
drop function if exists fn_score_drain_queue(int);

create or replace function fn_score_drain_queue(p_limit int default 200, p_max_attempts int default 5)
returns table (done int, failed int)
language plpgsql security definer set search_path to 'public' as $$
declare
  q record; v_done int := 0; v_fail int := 0; v_id uuid; v_id2 uuid;
begin
  for q in
    select * from score_sync_queue
     where status = 'pending'
     order by enqueued_at
     limit p_limit
     -- SKIP LOCKED: agar koi doosra chakkar isi parchi par kaam kar raha
     -- hai to us ka intezar nahi kiya jata, usay chhoR kar aage barha
     -- jata hai. Ek parchi do haathon mein kabhi nahi aati.
     for update skip locked
  loop
    begin
      if q.source_table = 'machinery_bookings' then
        perform fn_sync_machinery_booking(q.source_id);
      elsif q.source_table = 'machinery_bills' then
        perform fn_sync_machinery_bill(q.source_id);
      elsif q.source_table = 'machinery_payments' then
        select booking_id into v_id from machinery_payments where id = q.source_id;
        if v_id is not null then
          select id into v_id2 from machinery_bills where booking_id = v_id and cancelled_at is null;
          if v_id2 is not null then perform fn_sync_machinery_bill(v_id2); end if;
        end if;
        perform fn_sync_vendor_settlement(q.source_id);
      elsif q.source_table = 'farmer_credit_ledger' then
        select farmer_id into v_id from farmer_credit_ledger where id = q.source_id;
        if v_id is not null then perform fn_sync_farmer_credit(v_id); end if;
      elsif q.source_table = 'loan_installments' then
        perform fn_sync_loan_installment(q.source_id);
      elsif q.source_table = 'milk_entries' then
        select farmer_id, verified_by_profile_id into v_id, v_id2
          from milk_entries where id = q.source_id;
        if v_id is not null  then perform fn_sync_milk_farmer(v_id); end if;
        if v_id2 is not null then perform fn_sync_milk_staff(v_id2); end if;
      elsif q.source_table = 'grain_procurement_entries' then
        select farmer_id into v_id from grain_procurement_entries where id = q.source_id;
        if v_id is not null then perform fn_sync_grain_farmer(v_id); end if;
      elsif q.source_table = 'grain_procurement_payments' then
        perform fn_sync_grain_payment_edit(q.source_id);
      elsif q.source_table = 'agri_orders' then
        perform fn_sync_agri_order(q.source_id);
        select sales_verified_by, approved_by into v_id, v_id2
          from agri_orders where id = q.source_id;
        if v_id is not null  then perform fn_sync_order_staff(v_id); end if;
        if v_id2 is not null and v_id2 <> coalesce(v_id, v_id2) then
          perform fn_sync_order_staff(v_id2);
        end if;
      elsif q.source_table = 'agri_order_payments' then
        select order_id into v_id from agri_order_payments where id = q.source_id;
        if v_id is not null then perform fn_sync_agri_order(v_id); end if;
      elsif q.source_table = 'agri_complaints' then
        select assigned_to into v_id from agri_complaints where id = q.source_id;
        if v_id is not null then perform fn_sync_order_staff(v_id); end if;
      elsif q.source_table = 'staff_credit_ledger' then
        select profile_id into v_id from staff_credit_ledger where id = q.source_id;
        if v_id is not null then perform fn_sync_staff_custody(v_id); end if;
      end if;

      update score_sync_queue
         set status = 'done', processed_at = now(), attempts = attempts + 1, last_error = null
       where id = q.id;
      v_done := v_done + 1;

    exception when others then
      -- Ek parchi ki ghalti sirf us parchi ki hai. Baqi qatar chalti
      -- rehti hai, aur asal karobari qatar ko to kuch hota hi nahi.
      update score_sync_queue
         set status = case when attempts + 1 >= p_max_attempts then 'dead' else 'failed' end,
             processed_at = now(), attempts = attempts + 1, last_error = sqlerrm
       where id = q.id;
      v_fail := v_fail + 1;
    end;
  end loop;

  return query select v_done, v_fail;
end;
$$;

create or replace function fn_score_retry_failed(p_max_attempts int default 5)
returns int language plpgsql security definer set search_path to 'public' as $$
declare n int;
begin
  -- 'dead' ko haath nahi lagaya jata. Wo insaan ke dekhne ke liye pari
  -- hai; usay khud dobara qatar mein daalna wohi chakkar shuru karna
  -- hoga jis se bachne ke liye us par 'dead' likha gaya tha.
  update score_sync_queue set status = 'pending', last_error = null
   where status = 'failed' and attempts < p_max_attempts
     and not exists (
       select 1 from score_sync_queue p
        where p.source_table = score_sync_queue.source_table
          and p.source_id = score_sync_queue.source_id
          and p.status = 'pending');
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ---------------------------------------------------------------
-- Taazgi -- ab 'dead' aur qatar ka aakhri chakkar bhi dekhti hai
-- ---------------------------------------------------------------
drop function if exists fn_score_health();

create or replace function fn_score_health()
returns table (
  last_ok_run timestamptz, hours_since_run numeric,
  queue_pending int, queue_failed int, queue_dead int,
  oldest_pending timestamptz, last_drain timestamptz,
  is_stale boolean, reason text)
language plpgsql stable security definer set search_path to 'public' as $$
declare
  v_last timestamptz; v_drain timestamptz;
  v_pending int; v_failed int; v_dead int; v_oldest timestamptz;
  v_hours numeric; v_stale boolean := false; v_reason text := 'Sab theek hai';
begin
  select max(finished_at) into v_last  from score_runs where status = 'ok' and kind = 'daily';
  select max(finished_at) into v_drain from score_runs where status = 'ok' and kind = 'drain';
  select count(*) filter (where status = 'pending'),
         count(*) filter (where status = 'failed'),
         count(*) filter (where status = 'dead'),
         min(enqueued_at) filter (where status = 'pending')
    into v_pending, v_failed, v_dead, v_oldest from score_sync_queue;

  v_hours := case when v_last is null then null
                  else round(extract(epoch from (now() - v_last)) / 3600, 1) end;

  -- Tarteeb ahem hai: sab se sanjeeda baat pehle.
  if v_dead > 0 then
    v_stale := true;
    v_reason := format('%s parchiyan baar baar nakaam hui -- inhen dekhna zaroori hai', v_dead);
  elsif v_last is null then
    v_stale := true; v_reason := 'Roz ka hisaab abhi ek dafa bhi kaamyabi se nahi chala';
  elsif v_hours > 30 then
    v_stale := true; v_reason := format('Roz ka hisaab %s ghante se nahi chala', v_hours);
  elsif v_drain is null or v_drain < now() - interval '30 minutes' then
    v_stale := true; v_reason := 'Qatar ka chakkar aadhe ghante se nahi chala';
  elsif v_failed > 0 then
    v_stale := true; v_reason := format('%s parchiyan nakaam pari hain', v_failed);
  elsif v_pending > 0 and v_oldest < now() - interval '1 hour' then
    v_stale := true; v_reason := format('%s parchiyan ek ghante se muntazir hain', v_pending);
  end if;

  return query select v_last, v_hours, coalesce(v_pending,0), coalesce(v_failed,0),
                      coalesce(v_dead,0), v_oldest, v_drain, v_stale, v_reason;
end;
$$;
