-- =====================================================================
-- Migration 218: Sync ab WAJAH dekhta hai, sirf nishan nahi
-- =====================================================================
-- 217 ne teen jagah wajah ka khana banaya. Yahan engine usay parhna
-- shuru karta hai -- aur jahan wajah khali hai, wahan koi faisla nahi
-- deta.

insert into score_event_severity
  (subject_type, factor_key, event_type, direction, magnitude, never_decays, label) values
  ('staff','verification_accuracy','unexplained_edit', -1,  8, false, 'Raqam badli aur wajah nahi di'),
  -- Customer ke apne waqiat -- ab jur sakte hain kyunke pehchan ka khana
  -- ban chuka hai (217).
  ('customer','credit_repayment','bill_settled',        1, 10, false, 'Bill poora ada hua'),
  ('customer','credit_repayment','bill_unpaid',        -1, 10, true,  'Bill baqi -- tareekh guzar chuki'),
  ('customer','payment_punctuality','paid_on_time',     1, 10, false, 'Waqt par diya'),
  ('customer','payment_punctuality','paid_late_1_7',   -1,  4, false, 'Ek hafte tak der'),
  ('customer','payment_punctuality','paid_late_8_30',  -1,  8, false, 'Ek mahine tak der'),
  ('customer','payment_punctuality','paid_late_31_90', -1, 14, false, 'Teen mahine tak der'),
  ('customer','payment_punctuality','paid_late_90_plus',-1,20, false, 'Teen mahine se ziyada der'),
  ('customer','payment_punctuality','overdue',         -1, 20, true,  'Tareekh guzar chuki, raqam baqi')
on conflict do nothing;

-- ---------------------------------------------------------------
-- Mansookhi -- ab sirf tab jab wajah likhi ho
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
    -- DO SHARTEIN, DONO ZAROORI:
    --   kaam shuru ho chuka tha (us se pehle mansookhi kisi ka nuqsan nahi)
    --   AUR wajah kisan ki likhi hui ho
    --
    -- Pehle sirf pehli shart thi. Us ka matlab tha ke machine kharab ho
    -- jaye, mausam bigar jaye, ya vendor na pahunche -- teenon soorton
    -- mein nishan KISAN par lagta tha. Ab jahan wajah likhi hi nahi,
    -- wahan koi faisla nahi.
    if (b.reached_farm_at is not null or b.work_started_at is not null)
       and b.cancellation_party = 'farmer' then
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

-- ---------------------------------------------------------------
-- Anaj ki adaigi ki durusti -- sirf BINA WAJAH wali
-- ---------------------------------------------------------------
create or replace function fn_sync_grain_payment_edit(p_payment_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare p record; keep text[] := '{}'; v_farq numeric;
begin
  select * into p from grain_procurement_payments where id = p_payment_id;
  if not found or not coalesce(p.is_edited, false) or p.created_by is null then return; end if;

  v_farq := abs(coalesce(p.amount, 0) - coalesce(p.original_amount, 0));

  -- Durusti jurm nahi. 'correction' aur 'renegotiation' dono jaiz hain --
  -- un par koi nishan nahi. Sawal sirf wahan hai jahan raqam badli aur
  -- wajah kisi ne likhi hi nahi.
  if p.edit_kind = 'unexplained' and v_farq > 0 then
    perform fn_score_put_event('staff', p.created_by, 'verification_accuracy',
      'unexplained_edit', coalesce(p.edited_at, p.created_at),
      'grain_procurement_payments', p.id, 'verified', null,
      format('Rs %s se Rs %s -- wajah nahi likhi', round(coalesce(p.original_amount,0)), round(p.amount)));
    keep := array_append(keep, 'unexplained_edit');
  end if;

  perform fn_score_drop_events('grain_procurement_payments', p.id, keep,
    'is durusti ki wajah ab likhi ja chuki hai');
  perform fn_recalc_score('staff', p.created_by);
end;
$$;

-- ---------------------------------------------------------------
-- Order -- ab customer bhi, magar sirf jahan PEHCHAN TAY HO
-- ---------------------------------------------------------------
create or replace function fn_sync_agri_order(p_order_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  o         record;
  v_type    text;
  v_subject uuid;
  v_paid    numeric := 0;
  v_last    timestamptz;
  v_settled boolean;
  v_late    int;
  v_ev      text;
  keep      text[] := '{}';
begin
  select * into o from agri_orders where id = p_order_id;
  if not found then return; end if;

  -- Doosri taraf kaun hai -- do jaiz raaste, aur koi teesra nahi.
  if o.customer_id is not null and o.party_link_state = 'linked' then
    v_type := 'customer'; v_subject := o.customer_id;
  elsif o.order_to_type = 'Farmer' and o.mobile_number is not null then
    v_type := 'farmer';
    select id into v_subject from farmers
     where phone_key = fn_phone_key(o.mobile_number) and coalesce(is_deleted, false) = false
     limit 1;
  end if;
  -- Naam se joRna yahan bhi nahi hota. Pehchan na ho to score chhoo-ta
  -- bhi nahi -- 'unlinked_unknown' apni jagah rehta hai.
  if v_subject is null then return; end if;

  if o.status in ('cancelled', 'rejected') then
    update score_obligations set state = 'cancelled'
     where source_table = 'agri_orders' and source_id = o.id;
    perform fn_score_drop_events('agri_orders', o.id, '{}'::text[], 'order mansookh ho gaya');
    perform fn_recalc_score(v_type, v_subject);
    return;
  end if;

  -- Maal pahunche baghair koi qarz nahi.
  if o.status not in ('delivered', 'grn_submitted', 'completed') then
    perform fn_score_drop_events('agri_orders', o.id, '{}'::text[], 'maal abhi pahuncha hi nahi');
    perform fn_recalc_score(v_type, v_subject);
    return;
  end if;

  select coalesce(sum(paid_amount), 0), max(payment_date)
    into v_paid, v_last
    from agri_order_payments
   where order_id = o.id and status = 'verified';

  v_settled := v_paid >= o.grand_total;

  insert into score_obligations (subject_type, subject_id, kind, source_table, source_id,
    amount, settled_amount, due_date, due_date_source, state, settled_at)
  values (v_type, v_subject, 'bill', 'agri_orders', o.id,
    greatest(o.grand_total, 0.01), v_paid, o.payment_due_date,
    case when o.payment_due_date is not null then 'bill_terms' end,
    case when v_settled then 'settled' else 'open' end,
    case when v_settled then v_last end)
  on conflict (source_table, source_id) do update set
    subject_type = excluded.subject_type, subject_id = excluded.subject_id,
    amount = excluded.amount, settled_amount = excluded.settled_amount,
    due_date = excluded.due_date, due_date_source = excluded.due_date_source,
    state = excluded.state, settled_at = excluded.settled_at;

  if v_settled then
    perform fn_score_put_event(v_type, v_subject, 'credit_repayment',
      'bill_settled', v_last, 'agri_orders', o.id, 'verified', null, 'order ' || o.order_number);
    keep := array_append(keep, 'bill_settled');

    if o.payment_due_date is not null then
      v_late := greatest(0, (v_last::date - o.payment_due_date));
      if v_late = 0 then
        perform fn_score_put_event(v_type, v_subject, 'payment_punctuality',
          'paid_on_time', v_last, 'agri_orders', o.id);
        keep := array_append(keep, 'paid_on_time');
      else
        v_ev := case when v_late <= 7 then 'paid_late_1_7'
                     when v_late <= 30 then 'paid_late_8_30'
                     when v_late <= 90 then 'paid_late_31_90'
                     else 'paid_late_90_plus' end;
        perform fn_score_put_event(v_type, v_subject, 'payment_punctuality',
          v_ev, v_last, 'agri_orders', o.id, 'verified', null, v_late || ' din der');
        keep := array_append(keep, v_ev);
      end if;
    end if;

  elsif o.payment_due_date is not null and o.payment_due_date < current_date then
    v_late := current_date - o.payment_due_date;
    perform fn_score_put_event(v_type, v_subject, 'payment_punctuality',
      'overdue', (o.payment_due_date + 1)::timestamptz, 'agri_orders', o.id,
      'verified', null, v_late || ' din se baqi');
    perform fn_score_put_event(v_type, v_subject, 'credit_repayment',
      'bill_unpaid', (o.payment_due_date + 1)::timestamptz, 'agri_orders', o.id,
      'verified', null, v_late || ' din se baqi');
    keep := array_append(keep, 'overdue');
    keep := array_append(keep, 'bill_unpaid');
  end if;

  perform fn_score_drop_events('agri_orders', o.id, keep,
    'order ki maujooda haalat mein ye baat ab sach nahi');
  perform fn_recalc_score(v_type, v_subject);
end;
$$;

create or replace function fn_sync_orders_all()
returns int language plpgsql security definer set search_path to 'public' as $$
declare n int := 0; r record;
begin
  for r in select id from agri_orders
            where (order_to_type = 'Farmer') or (customer_id is not null and party_link_state = 'linked')
  loop
    perform fn_sync_agri_order(r.id); n := n + 1;
  end loop;
  for r in select distinct pid from (
      select sales_verified_by as pid from agri_orders where sales_verified_by is not null
      union select approved_by from agri_orders where approved_by is not null
      union select assigned_to from agri_complaints where assigned_to is not null) z
   where pid is not null
  loop
    perform fn_sync_order_staff(r.pid); n := n + 1;
  end loop;
  return n;
end;
$$;
