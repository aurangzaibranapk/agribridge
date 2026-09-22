-- =====================================================================
-- Migration 208: Machinery ka sync ab wazan table se poochhta hai
-- =====================================================================
-- 207 ne har waqie ka wazan table mein rakh diya. Yahan machinery ke
-- dono sync function usi par le aaye gaye hain -- ab in ke andar koi
-- number likha hua nahi.
--
-- Ek cheez aur behtar hui: "der se diya" pehle ek hi waqia tha jis ka
-- wazan hisaab se badalta tha. Ab wo chaar alag waqiat hain --
-- paid_late_1_7, _8_30, _31_90, _90_plus -- aur har ek ka wazan table
-- mein apni qatar rakhta hai. Der ki shiddat ab drill-down mein khud
-- nazar aati hai, kisi number ko dekh kar samajhni nahi parti.

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
    -- pehle mansookh karna kisi ka nuqsan nahi.
    if b.reached_farm_at is not null or b.work_started_at is not null then
      perform fn_score_put_event('farmer', b.farmer_id, 'commitment_reliability',
        'cancelled_after_start', coalesce(b.cancelled_at, b.created_at),
        'machinery_bookings', b.id, 'verified', null, b.cancellation_reason);
      keep := array_append(keep, 'cancelled_after_start');
    end if;
    perform fn_score_drop_events('machinery_bookings', b.id, keep, 'booking mansookh ho gayi');
    perform fn_recalc_score('farmer', b.farmer_id);
    if b.vendor_id is not null then perform fn_recalc_score('vendor', b.vendor_id); end if;
    return;
  end if;

  if b.farmer_confirmed_at is not null
     and (b.rate_reopened_at is null or b.rate_reopened_at < b.farmer_confirmed_at) then
    if b.confirmation_override_by is not null then
      -- Tasdeeq kisan se nahi, daftar ke bandey se. Alag naam, kam wazan
      -- -- aur note mein kaun, kyun aur kaunsa saboot, teenon likhe jate
      -- hain taake drill-down mein ye kabhi "kisan ki tasdeeq" na lage.
      perform fn_score_put_event('farmer', b.farmer_id, 'commitment_reliability',
        'rate_confirmed_by_staff', b.farmer_confirmed_at,
        'machinery_bookings', b.id, 'verified', null,
        format('override: %s | wajah: %s | saboot: %s',
          coalesce(b.confirmation_override_by::text, '-'),
          coalesce(b.confirmation_override_reason, '-'),
          coalesce(b.confirmation_override_evidence_url, '-')));
      keep := array_append(keep, 'rate_confirmed_by_staff');
    else
      perform fn_score_put_event('farmer', b.farmer_id, 'commitment_reliability',
        'rate_confirmed', b.farmer_confirmed_at,
        'machinery_bookings', b.id, 'verified', null,
        coalesce(b.farmer_confirmation_channel, 'kisan ki apni tasdeeq'));
      keep := array_append(keep, 'rate_confirmed');
    end if;
    if b.vendor_id is not null then
      perform fn_score_put_event('vendor', b.vendor_id, 'farmer_confirmation',
        'confirmed', b.farmer_confirmed_at, 'machinery_bookings', b.id);
      vkeep := array_append(vkeep, 'confirmed');
    end if;
  end if;

  if b.status in ('completed','bill_pending','payment_pending','closed')
     and b.completed_at is not null then
    perform fn_score_put_event('farmer', b.farmer_id, 'commitment_reliability',
      'work_completed', b.completed_at, 'machinery_bookings', b.id);
    keep := array_append(keep, 'work_completed');
    if b.vendor_id is not null then
      perform fn_score_put_event('vendor', b.vendor_id, 'job_completion',
        'completed', b.completed_at, 'machinery_bookings', b.id);
      vkeep := array_append(vkeep, 'completed');
    end if;
  end if;

  perform fn_score_drop_events('machinery_bookings', b.id, keep || vkeep,
    'booking ki maujooda haalat mein ye baat ab sach nahi');

  perform fn_recalc_score('farmer', b.farmer_id);
  if b.vendor_id is not null then perform fn_recalc_score('vendor', b.vendor_id); end if;
end;
$$;

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
  v_type    text;
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

  -- SIRF TASDEEQ SHUDA ADAIGI. Aur "ek dafa tasdeeq" hamesha ka nahi:
  -- hisaab har dafa naye sire se hota hai, is liye jo adaigi baad mein
  -- badal jaye wo apne aap yahan se nikal jati hai.
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
      'bill_settled', v_last, 'machinery_bills', bl.id);
    keep := array_append(keep, 'bill_settled');

    -- WAQT KA SAWAL SIRF WAHAN JAHAN TAREEKH THI.
    if v_due is not null then
      v_late := greatest(0, (v_last::date - v_due));
      if v_late = 0 then
        perform fn_score_put_event('farmer', bk.farmer_id, 'payment_punctuality',
          'paid_on_time', v_last, 'machinery_bills', bl.id);
        keep := array_append(keep, 'paid_on_time');
      else
        v_type := case when v_late <= 7 then 'paid_late_1_7'
                       when v_late <= 30 then 'paid_late_8_30'
                       when v_late <= 90 then 'paid_late_31_90'
                       else 'paid_late_90_plus' end;
        perform fn_score_put_event('farmer', bk.farmer_id, 'payment_punctuality',
          v_type, v_last, 'machinery_bills', bl.id, 'verified', null, v_late || ' din der');
        keep := array_append(keep, v_type);
      end if;
    end if;

  elsif v_due is not null and v_due < current_date then
    -- Jo hal nahi hua wo purana nahi hota.
    v_late := current_date - v_due;
    perform fn_score_put_event('farmer', bk.farmer_id, 'payment_punctuality',
      'overdue', (v_due + 1)::timestamptz, 'machinery_bills', bl.id,
      'verified', null, v_late || ' din se baqi');
    perform fn_score_put_event('farmer', bk.farmer_id, 'credit_repayment',
      'bill_unpaid', (v_due + 1)::timestamptz, 'machinery_bills', bl.id,
      'verified', null, v_late || ' din se baqi');
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
