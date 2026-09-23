-- =====================================================================
-- Migration 220: Qatar chalana, roz ka kaam, aur TAAZGI KA PEHRA
-- =====================================================================
-- Sab se ahem hissa teesra hai: purana adad naye adad jaisa hi dikhta
-- hai. Agar sync ruk jaye ya roz ka kaam na chale, to score screen par
-- waise hi khara rehta hai -- aur dekhne wala usay AAJ KA samajhta hai.
-- Is liye har hisaab ke saath ye bhi likha jata hai ke us mein aakhri
-- saboot kab tak ka tha, aur ek jagah se ye sawal ka jawab milta hai ke
-- "jo adad screen par hai, kya us par bharosa kiya ja sakta hai".

alter table score_snapshots
  add column if not exists last_evidence_at timestamptz;

comment on column score_snapshots.last_evidence_at is
  'Is hisaab mein sab se naya saboot kis waqt ka tha. Is se pata chalta hai ke adad kitna taaza hai.';

alter table score_runs
  add column if not exists queue_done   int not null default 0,
  add column if not exists queue_failed int not null default 0;

-- ---------------------------------------------------------------
-- Qatar chalana -- har parchi apni ghalti apne saath likhti hai
-- ---------------------------------------------------------------
create or replace function fn_score_drain_queue(p_limit int default 500)
returns table (done int, failed int)
language plpgsql security definer set search_path to 'public' as $$
declare
  q record; v_done int := 0; v_fail int := 0; v_id uuid; v_id2 uuid;
begin
  for q in
    select * from score_sync_queue where status = 'pending'
     order by enqueued_at limit p_limit
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
      -- Ghalti chhupti nahi. Parchi 'failed' ho kar apni wajah ke sath
      -- baithi rehti hai -- aur ASAL KAROBARI QATAR ko kuch nahi hota,
      -- kyunke wo kab ki mehfooz ho chuki hai.
      update score_sync_queue
         set status = 'failed', processed_at = now(), attempts = attempts + 1,
             last_error = sqlerrm
       where id = q.id;
      v_fail := v_fail + 1;
    end;
  end loop;

  return query select v_done, v_fail;
end;
$$;

-- Nakaam parchi dobara qatar mein -- haath se, ya roz ke kaam se.
create or replace function fn_score_retry_failed(p_max_attempts int default 5)
returns int language plpgsql security definer set search_path to 'public' as $$
declare n int;
begin
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
-- Roz ka kaam -- pehle qatar, phir sab ka hisaab
-- ---------------------------------------------------------------
create or replace function fn_score_daily_run(p_by text default 'cron')
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_run uuid; v_n int := 0; r record; v_q record;
begin
  insert into score_runs (triggered_by) values (p_by) returning id into v_run;

  begin
    perform fn_score_retry_failed();
    select * into v_q from fn_score_drain_queue(5000);

    for r in
      select distinct subject_type, subject_id from score_events where invalidated_at is null
      union
      select distinct subject_type, subject_id from score_obligations where state <> 'cancelled'
    loop
      perform fn_recalc_score(r.subject_type, r.subject_id);
      v_n := v_n + 1;
    end loop;

    update score_runs
       set status = 'ok', finished_at = now(), subjects = v_n,
           queue_done = coalesce(v_q.done, 0), queue_failed = coalesce(v_q.failed, 0)
     where id = v_run;
  exception when others then
    update score_runs
       set status = 'failed', finished_at = now(), subjects = v_n, error_text = sqlerrm
     where id = v_run;
    raise;
  end;

  return v_run;
end;
$$;

-- ---------------------------------------------------------------
-- TAAZGI KA PEHRA -- ek hi jagah se ek hi jawab
-- ---------------------------------------------------------------
-- Safha khud hisaab nahi lagata, warna do jagah do jawab hote.
create or replace function fn_score_health()
returns table (
  last_ok_run timestamptz, hours_since_run numeric,
  queue_pending int, queue_failed int, oldest_pending timestamptz,
  is_stale boolean, reason text)
language plpgsql stable security definer set search_path to 'public' as $$
declare
  v_last timestamptz; v_pending int; v_failed int; v_oldest timestamptz;
  v_hours numeric; v_stale boolean := false; v_reason text := 'Sab theek hai';
begin
  select max(finished_at) into v_last from score_runs where status = 'ok';
  select count(*) filter (where status = 'pending'),
         count(*) filter (where status = 'failed'),
         min(enqueued_at) filter (where status = 'pending')
    into v_pending, v_failed, v_oldest from score_sync_queue;

  v_hours := case when v_last is null then null
                  else round(extract(epoch from (now() - v_last)) / 3600, 1) end;

  -- Teen soorton mein adad par bharosa nahi kiya ja sakta.
  if v_last is null then
    v_stale := true; v_reason := 'Roz ka hisaab abhi ek dafa bhi kaamyabi se nahi chala';
  elsif v_hours > 30 then
    v_stale := true; v_reason := format('Roz ka hisaab %s ghante se nahi chala', v_hours);
  elsif v_failed > 0 then
    v_stale := true; v_reason := format('%s parchiyan nakaam pari hain', v_failed);
  elsif v_pending > 0 and v_oldest < now() - interval '2 hours' then
    v_stale := true; v_reason := format('%s parchiyan do ghante se muntazir hain', v_pending);
  end if;

  return query select v_last, v_hours, coalesce(v_pending,0), coalesce(v_failed,0),
                      v_oldest, v_stale, v_reason;
end;
$$;

-- ---------------------------------------------------------------
-- Har hisaab ke saath aakhri saboot ki tareekh
-- ---------------------------------------------------------------
create or replace function fn_recalc_score(p_subject_type text, p_subject_id uuid)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare
  v_version   int := fn_score_engine_version();
  v_since     timestamptz := fn_subject_since(p_subject_type, p_subject_id);
  v_days      int := case when v_since is null then 0
                          else floor(extract(epoch from (now() - v_since)) / 86400)::int end;
  v_verified  int;
  v_lastev    timestamptz;
  w           record;
  v_pos       numeric;
  v_neg       numeric;
  v_s         numeric;
  v_w_all     numeric := 0;
  v_w_app     numeric := 0;
  v_weighted  numeric := 0;
  v_factors   jsonb := '[]'::jsonb;
  v_coverage  numeric;
  v_state     text;
  v_score     int;
  v_credit    text;
  v_flags     text[] := '{}';
  v_reason    text;
  v_id        uuid;
  v_repay_app boolean := false;
  v_obl_any   boolean;
begin
  select count(*), max(occurred_at) into v_verified, v_lastev
    from score_events
   where subject_type = p_subject_type and subject_id = p_subject_id
     and evidence_state = 'verified' and invalidated_at is null;

  for w in
    select * from score_factor_weights
     where subject_type = p_subject_type
       and engine_version = v_version
       and is_enabled
     order by weight desc, factor_key
  loop
    -- decays = false wale factor par waqt ka asar nahi. Wo haalat batate
    -- hain, waqia nahi -- CNIC bees mahine baad khud ghair-tasdeeq shuda
    -- nahi ho jata.
    select
      coalesce(sum(case when direction = 1
        then magnitude * (case when w.decays
             then fn_score_decay(coalesce(decay_from, occurred_at), never_decays) else 1.0 end) end), 0),
      coalesce(sum(case when direction = -1 and w.is_punitive
        then magnitude * (case when w.decays
             then fn_score_decay(coalesce(decay_from, occurred_at), never_decays) else 1.0 end) end), 0)
      into v_pos, v_neg
      from score_events e
     where e.subject_type = p_subject_type
       and e.subject_id = p_subject_id
       and e.factor_key = w.factor_key
       and e.evidence_state = 'verified'
       and e.invalidated_at is null;

    v_w_all := v_w_all + w.weight;

    if (v_pos + v_neg) > 0 then
      v_s := v_pos / (v_pos + v_neg);
      v_w_app := v_w_app + w.weight;
      v_weighted := v_weighted + (w.weight * v_s);
      if w.factor_key = 'credit_repayment' then v_repay_app := true; end if;
      v_factors := v_factors || jsonb_build_object(
        'factor', w.factor_key, 'label', w.label, 'weight', w.weight,
        'applicable', true, 'sub_score', round(v_s, 3),
        'points', round(w.weight * v_s, 2), 'punitive', w.is_punitive);
    else
      v_factors := v_factors || jsonb_build_object(
        'factor', w.factor_key, 'label', w.label, 'weight', w.weight,
        'applicable', false, 'sub_score', null, 'points', null,
        'punitive', w.is_punitive,
        'reason', case
          when w.factor_key = 'credit_repayment'    then 'Udhaar kabhi diya hi nahi gaya'
          when w.factor_key = 'payment_punctuality' then 'Koi tay shuda tareekh maujood nahi'
          else 'Is ka koi tasdeeq shuda record nahi' end);
    end if;
  end loop;

  v_coverage := case when v_w_all > 0 then v_w_app / v_w_all else 0 end;

  select exists (select 1 from score_obligations
                  where subject_type = p_subject_type and subject_id = p_subject_id
                    and kind in ('credit','installment','bill')
                    and state <> 'cancelled')
    into v_obl_any;
  v_credit := case when v_repay_app then 'established'
                   when v_obl_any   then 'insufficient'
                   else 'none' end;

  if exists (select 1 from score_obligations
              where subject_type = p_subject_type and subject_id = p_subject_id
                and state = 'written_off') then
    v_flags := array_append(v_flags, 'unresolved_write_off');
  end if;
  if exists (select 1 from score_obligations
              where subject_type = p_subject_type and subject_id = p_subject_id
                and state = 'open' and due_date is not null and due_date < current_date) then
    v_flags := array_append(v_flags, 'overdue');
  end if;

  if v_days < 30 or v_verified < 3 then
    v_state := 'score_building';
    v_score := null;
    v_reason := format('%s din, %s tasdeeq shuda waqiat -- abhi hisaab shuru hua hai', v_days, v_verified);
  elsif v_coverage < 0.50 then
    v_state := 'insufficient_data';
    v_score := null;
    v_reason := format('Tasweer adhoori -- %s%% saboot', round(v_coverage * 100));
  else
    v_state := 'active';
    v_score := round(100 * v_weighted / v_w_app)::int;
    v_reason := format('%s%% saboot par bana', round(v_coverage * 100));
  end if;

  insert into score_snapshots (
    subject_type, subject_id, snapshot_date, score, band, state,
    evidence_coverage, credit_history_state, relationship_days,
    verified_event_count, last_evidence_at, factors, risk_flags, engine_version, reason_summary)
  values (
    p_subject_type, p_subject_id, current_date, v_score, fn_score_band(v_score), v_state,
    round(v_coverage, 3), v_credit, v_days, v_verified, v_lastev, v_factors, v_flags, v_version, v_reason)
  on conflict (subject_type, subject_id, snapshot_date) do update set
    score = excluded.score, band = excluded.band, state = excluded.state,
    evidence_coverage = excluded.evidence_coverage,
    credit_history_state = excluded.credit_history_state,
    relationship_days = excluded.relationship_days,
    verified_event_count = excluded.verified_event_count,
    last_evidence_at = excluded.last_evidence_at,
    factors = excluded.factors, risk_flags = excluded.risk_flags,
    engine_version = excluded.engine_version, reason_summary = excluded.reason_summary,
    computed_at = now()
  returning id into v_id;

  return v_id;
end;
$$;
