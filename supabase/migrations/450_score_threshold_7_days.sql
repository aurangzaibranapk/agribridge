-- Score threshold: 30 din se 7 din
--
-- System abhi naya hai -- sab records 30 din se kam ke hain, is liye
-- koi score nahi dikh raha. 7 din ka threshold zyada practical hai:
-- agar 3+ verified events ho chuke hain to score dikhao.
-- Koi data delete nahi hoga, sirf rule change hoga.

CREATE OR REPLACE FUNCTION public.fn_recalc_score(p_subject_type text, p_subject_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- 7 din minimum (pehle 30 din tha -- system naya tha, koi score nahi dikha)
  if v_days < 7 or v_verified < 3 then
    v_state := 'score_building';
    v_score := null;
    v_reason := format('%s din, %s verified events -- data kum hai', v_days, v_verified);
  elsif v_coverage < 0.50 then
    v_state := 'insufficient_data';
    v_score := null;
    v_reason := format('Data incomplete -- %s%% coverage', round(v_coverage * 100));
  else
    v_state := 'active';
    v_score := round(100 * v_weighted / v_w_app)::int;
    v_reason := format('%s%% coverage par score bana', round(v_coverage * 100));
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
$function$;
