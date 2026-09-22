-- =====================================================================
-- Migration 204: Waqia mit-ta nahi -- batil hota hai
-- =====================================================================
-- Asal ERP ka record ek jagah khara nahi rehta. Wo pending se verified
-- hota hai, verified se durust shuda, phir mansookh, ulta, ya
-- write-off. Agar score ka waqia sirf INSERT par banta, to wo pehle
-- lamhe ki tasweer par hamesha ke liye khara rehta -- aur jis booking
-- ko kal mansookh kar diya gaya, us ki tareef aaj bhi score mein jama
-- rehti.
--
-- Is liye waqia kabhi mitaya nahi jata. Usay BATIL kiya jata hai: qatar
-- apni jagah rehti hai, us par tareekh aur wajah likh di jati hai, aur
-- engine usay ginna chhoR deta hai. Guzra hua waqt yun mehfooz rehta
-- hai aur aaj ka hisaab bhi sach bolta hai.

alter table score_events
  add column if not exists invalidated_at     timestamptz,
  add column if not exists invalidated_reason text;

comment on column score_events.invalidated_at is
  'Bhara ho to engine is waqie ko nahi ginta. Qatar phir bhi rehti hai -- tareekh mitai nahi jati.';

-- Purana pehra (source, factor, event_type) par ek hi qatar kehta tha
-- -- hamesha. Us ka matlab tha ke durusti mumkin hi nahi: batil kar ke
-- naya waqia daalna chahen to purani qatar raasta rok leti.
--
-- Naya pehra wohi baat kehta hai magar sirf ZINDA qataron par: ek waqt
-- mein ek hi chalta hua waqia. Batil qatarein jitni marzi ho -- wo
-- tareekh hain, dawa nahi.
alter table score_events
  drop constraint if exists score_events_source_table_source_id_factor_key_event_type_key;

create unique index if not exists idx_score_events_zinda
  on score_events (source_table, source_id, factor_key, event_type)
  where invalidated_at is null;

create index if not exists idx_score_events_source
  on score_events (source_table, source_id);

-- Engine ab batil waqia kahin nahi ginta -- na saboot ki ginti mein, na
-- hisaab mein. (Poora function 203 wala hai, sirf do jagah
-- "and invalidated_at is null" ka izafa hua hai, aur credit history ke
-- sawal mein 'bill' bhi shamil hua hai.)

create or replace function fn_recalc_score(p_subject_type text, p_subject_id uuid)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare
  v_version   int := fn_score_engine_version();
  v_since     timestamptz := fn_subject_since(p_subject_type, p_subject_id);
  v_days      int := case when v_since is null then 0
                          else floor(extract(epoch from (now() - v_since)) / 86400)::int end;
  v_verified  int;
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
  select count(*) into v_verified
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
    verified_event_count, factors, risk_flags, engine_version, reason_summary)
  values (
    p_subject_type, p_subject_id, current_date, v_score, fn_score_band(v_score), v_state,
    round(v_coverage, 3), v_credit, v_days, v_verified, v_factors, v_flags, v_version, v_reason)
  on conflict (subject_type, subject_id, snapshot_date) do update set
    score = excluded.score, band = excluded.band, state = excluded.state,
    evidence_coverage = excluded.evidence_coverage,
    credit_history_state = excluded.credit_history_state,
    relationship_days = excluded.relationship_days,
    verified_event_count = excluded.verified_event_count,
    factors = excluded.factors, risk_flags = excluded.risk_flags,
    engine_version = excluded.engine_version, reason_summary = excluded.reason_summary,
    computed_at = now()
  returning id into v_id;

  return v_id;
end;
$$;
