-- =====================================================================
-- Migration 205: Machinery ke asal record se score ke waqiat
-- =====================================================================
-- YE TRIGGER SE NAHI BANTE.
--
-- Sirf INSERT par waqia banane wala tareeqa saada lagta hai aur ghalat
-- hai: wo pehle lamhe ki tasweer par ruk jata hai. Booking baad mein
-- mansookh ho, rate dobara khule, bill mansookh ho, adaigi radd ho --
-- in mein se koi baat us tasweer tak nahi pahunchti.
--
-- Yahan ka tareeqa ulta hai: har dafa booking (ya bill) ki MAUJOODA
-- haalat parh kar poori tasweer dobara banti hai, aur jo waqia ab sach
-- nahi raha wo batil kar diya jata hai. Is ka faida ye hai ke ye kaam
-- dobara chalane se kharab nahi hota -- chahe das dafa chale, nateeja
-- wohi rehta hai.

create or replace function fn_score_put_event(
  p_subject_type text, p_subject_id uuid, p_factor text, p_event_type text,
  p_dir int, p_mag numeric, p_occurred timestamptz,
  p_source_table text, p_source_id uuid, p_evidence text default 'verified',
  p_never boolean default false, p_decay_from timestamptz default null,
  p_note text default null)
returns void language plpgsql security definer set search_path to 'public' as $$
declare e record;
begin
  select * into e from score_events
   where source_table = p_source_table and source_id = p_source_id
     and factor_key = p_factor and event_type = p_event_type
     and invalidated_at is null;

  if found then
    -- Wohi baat pehle se likhi hai to dobara nahi likhi jati.
    if e.direction = p_dir and e.magnitude = p_mag and e.occurred_at = p_occurred
       and e.evidence_state = p_evidence and e.never_decays = p_never
       and e.subject_id = p_subject_id then
      return;
    end if;
    -- Asal record badal gaya. Purani qatar mitai nahi jati -- batil hoti hai.
    update score_events
       set invalidated_at = now(), invalidated_reason = 'asal record badla -- durusti'
     where id = e.id;
  end if;

  insert into score_events (subject_type, subject_id, factor_key, event_type,
    direction, magnitude, occurred_at, decay_from, never_decays,
    source_table, source_id, evidence_state, verified_at, note)
  values (p_subject_type, p_subject_id, p_factor, p_event_type,
    p_dir, p_mag, p_occurred, coalesce(p_decay_from, p_occurred), p_never,
    p_source_table, p_source_id, p_evidence,
    case when p_evidence = 'verified' then now() end, p_note);
end;
$$;

create or replace function fn_score_drop_events(
  p_source_table text, p_source_id uuid, p_keep text[], p_reason text)
returns int language plpgsql security definer set search_path to 'public' as $$
declare n int;
begin
  update score_events
     set invalidated_at = now(), invalidated_reason = p_reason
   where source_table = p_source_table and source_id = p_source_id
     and invalidated_at is null
     and not (event_type = any (p_keep));
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ---------------------------------------------------------------
-- Booking -- waade ka chaal chalan
-- ---------------------------------------------------------------
create or replace function fn_sync_machinery_booking(p_booking_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  b     record;
  keep  text[] := '{}';
  vkeep text[] := '{}';
begin
  select * into b from machinery_bookings where id = p_booking_id;
  if not found or b.farmer_id is null then return; end if;

  if b.status = 'cancelled' then
    -- Kaam shuru hone ke BAAD mansookhi hi tora hua waada hai. Us se
    -- pehle mansookh karna kisi ka nuqsan nahi -- us par manfi nishan
    -- lagana bandey ko us cheez ki saza dena hoga jo hui hi nahi.
    if b.reached_farm_at is not null or b.work_started_at is not null then
      perform fn_score_put_event('farmer', b.farmer_id, 'commitment_reliability',
        'cancelled_after_start', -1, 10, coalesce(b.cancelled_at, b.created_at),
        'machinery_bookings', b.id, 'verified', false, null, b.cancellation_reason);
      keep := array_append(keep, 'cancelled_after_start');
    end if;
    perform fn_score_drop_events('machinery_bookings', b.id, keep, 'booking mansookh ho gayi');
    perform fn_recalc_score('farmer', b.farmer_id);
    if b.vendor_id is not null then perform fn_recalc_score('vendor', b.vendor_id); end if;
    return;
  end if;

  -- Kisan ne rate ki tasdeeq ki
  if b.farmer_confirmed_at is not null
     and (b.rate_reopened_at is null or b.rate_reopened_at < b.farmer_confirmed_at) then
    if b.confirmation_override_by is not null then
      -- Tasdeeq kisan se nahi, daftar ke bandey se aayi. Ye saboot hai,
      -- magar kam wazan ka -- aur drill-down mein saaf nazar aata hai
      -- ke wo kis raaste se aaya.
      perform fn_score_put_event('farmer', b.farmer_id, 'commitment_reliability',
        'rate_confirmed_by_staff', 1, 3, b.farmer_confirmed_at,
        'machinery_bookings', b.id, 'verified', false, null, b.confirmation_override_reason);
      keep := array_append(keep, 'rate_confirmed_by_staff');
    else
      perform fn_score_put_event('farmer', b.farmer_id, 'commitment_reliability',
        'rate_confirmed', 1, 5, b.farmer_confirmed_at,
        'machinery_bookings', b.id, 'verified', false, null, b.farmer_confirmation_channel);
      keep := array_append(keep, 'rate_confirmed');
    end if;
    if b.vendor_id is not null then
      perform fn_score_put_event('vendor', b.vendor_id, 'farmer_confirmation',
        'confirmed', 1, 5, b.farmer_confirmed_at, 'machinery_bookings', b.id);
      vkeep := array_append(vkeep, 'confirmed');
    end if;
  end if;

  -- Kaam poora hua
  if b.status in ('completed','bill_pending','payment_pending','closed')
     and b.completed_at is not null then
    perform fn_score_put_event('farmer', b.farmer_id, 'commitment_reliability',
      'work_completed', 1, 10, b.completed_at, 'machinery_bookings', b.id);
    keep := array_append(keep, 'work_completed');
    if b.vendor_id is not null then
      perform fn_score_put_event('vendor', b.vendor_id, 'job_completion',
        'completed', 1, 10, b.completed_at, 'machinery_bookings', b.id);
      vkeep := array_append(vkeep, 'completed');
    end if;
  end if;

  perform fn_score_drop_events('machinery_bookings', b.id, keep || vkeep,
    'booking ki maujooda haalat mein ye baat ab sach nahi');

  perform fn_recalc_score('farmer', b.farmer_id);
  if b.vendor_id is not null then perform fn_recalc_score('vendor', b.vendor_id); end if;
end;
$$;

-- ---------------------------------------------------------------
-- Bill -- zimmedari aur adaigi
-- ---------------------------------------------------------------
create or replace function fn_sync_machinery_bill(p_bill_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  bl        record;
  bk        record;
  v_paid    numeric := 0;
  v_last    timestamptz;
  v_due     date;
  v_settled boolean;
  v_late    int;
  v_mag     numeric;
  keep      text[] := '{}';
begin
  select * into bl from machinery_bills where id = p_bill_id;
  if not found then return; end if;
  select * into bk from machinery_bookings where id = bl.booking_id;
  if not found or bk.farmer_id is null then return; end if;

  if bl.cancelled_at is not null then
    update score_obligations set state = 'cancelled'
     where source_table = 'machinery_bills' and source_id = bl.id;
    perform fn_score_drop_events('machinery_bills', bl.id, '{}'::text[], 'bill mansookh ho gaya');
    perform fn_recalc_score('farmer', bk.farmer_id);
    return;
  end if;

  -- Sirf TASDEEQ SHUDA adaigi ginti hai. Jo dawa abhi jaanchi nahi
  -- gayi wo paisa nahi, dawa hai.
  select coalesce(sum(amount), 0), max(payment_date)
    into v_paid, v_last
    from machinery_payments
   where booking_id = bk.id and kind = 'final'
     and verification_status = 'verified';

  v_due     := bk.payment_promise_date;
  v_settled := v_paid >= bl.balance_payable;

  insert into score_obligations (subject_type, subject_id, kind, source_table, source_id,
    amount, settled_amount, due_date, due_date_source, state, settled_at)
  values ('farmer', bk.farmer_id, 'bill', 'machinery_bills', bl.id,
    greatest(bl.balance_payable, 0.01), v_paid, v_due,
    case when v_due is not null then 'farmer_promise' end,
    case when v_settled then 'settled' else 'open' end,
    case when v_settled then v_last end)
  on conflict (source_table, source_id) do update set
    amount = excluded.amount, settled_amount = excluded.settled_amount,
    due_date = excluded.due_date, due_date_source = excluded.due_date_source,
    state = excluded.state, settled_at = excluded.settled_at;

  if v_settled then
    perform fn_score_put_event('farmer', bk.farmer_id, 'credit_repayment',
      'bill_settled', 1, 10, v_last, 'machinery_bills', bl.id);
    keep := array_append(keep, 'bill_settled');

    -- WAQT KA SAWAL SIRF WAHAN JAHAN TAREEKH THI.
    -- Due date na ho to na "waqt par", na "der se" -- kuch bhi nahi.
    if v_due is not null then
      v_late := greatest(0, (v_last::date - v_due));
      if v_late = 0 then
        perform fn_score_put_event('farmer', bk.farmer_id, 'payment_punctuality',
          'paid_on_time', 1, 10, v_last, 'machinery_bills', bl.id);
        keep := array_append(keep, 'paid_on_time');
      else
        v_mag := case when v_late <= 7 then 4 when v_late <= 30 then 8
                      when v_late <= 90 then 14 else 20 end;
        perform fn_score_put_event('farmer', bk.farmer_id, 'payment_punctuality',
          'paid_late', -1, v_mag, v_last, 'machinery_bills', bl.id, 'verified', false, null,
          v_late || ' din der');
        keep := array_append(keep, 'paid_late');
      end if;
    end if;

  elsif v_due is not null and v_due < current_date then
    -- Jo hal nahi hua wo purana nahi hota. never_decays.
    v_late := current_date - v_due;
    perform fn_score_put_event('farmer', bk.farmer_id, 'payment_punctuality',
      'overdue', -1, 20, (v_due + 1)::timestamptz, 'machinery_bills', bl.id,
      'verified', true, null, v_late || ' din se baqi');
    perform fn_score_put_event('farmer', bk.farmer_id, 'credit_repayment',
      'bill_unpaid', -1, 10, (v_due + 1)::timestamptz, 'machinery_bills', bl.id,
      'verified', true, null, v_late || ' din se baqi');
    keep := array_append(keep, 'overdue');
    keep := array_append(keep, 'bill_unpaid');
  end if;
  -- Bill khula hai magar tareekh nahi guzri (ya thi hi nahi) -- to koi
  -- waqia nahi. Zimmedari darj hai, faisla abhi nahi hua.

  perform fn_score_drop_events('machinery_bills', bl.id, keep,
    'bill ki maujooda haalat mein ye baat ab sach nahi');

  perform fn_recalc_score('farmer', bk.farmer_id);
end;
$$;

create or replace function fn_sync_machinery_all()
returns int language plpgsql security definer set search_path to 'public' as $$
declare n int := 0; r record;
begin
  for r in select id from machinery_bookings loop
    perform fn_sync_machinery_booking(r.id); n := n + 1;
  end loop;
  for r in select id from machinery_bills loop
    perform fn_sync_machinery_bill(r.id); n := n + 1;
  end loop;
  return n;
end;
$$;
