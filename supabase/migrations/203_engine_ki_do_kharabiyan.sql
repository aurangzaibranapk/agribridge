-- =====================================================================
-- Migration 203: Engine ki do kharabiyan jo imtihaan mein pakri gayin
-- =====================================================================
-- P1 ke pandrah scenario chala kar dekha to do cheezein ghalat nikleen.
-- Dono aisi thin jo kaghaz par theek lagti hain aur chalte hue nizam
-- mein nuqsan pahunchati hain.
--
-- ---------------------------------------------------------------
-- PEHLI: tasdeeq purani ho kar khatam ho jati thi
-- ---------------------------------------------------------------
-- ZTEST-09 ka kisan saat saal purana hai. Us ka CNIC bees mahine pehle
-- tasdeeq hua tha. Engine ne us tasdeeq ko waqt ke sath halka karte
-- karte SIFAR kar diya, aur phir kaha: "is ka koi tasdeeq shuda record
-- nahi" (N/A).
--
-- Ye ghalat hai. Do alag kism ki cheezein ek paimane se naapi ja rahi
-- thin:
--
--   WAQIA -- "waqt par paisa diya". Ye purana ho jata hai, aur hona
--            chahiye: paanch saal purani adaigi aaj ke bare mein kam
--            batati hai.
--
--   HAALAT -- "CNIC tasdeeq shuda hai". Ye purani nahi hoti. Kisi ka
--             shanakhti card bees mahine baad khud ba khud ghair-tasdeeq
--             shuda nahi ho jata. Agar tasdeeq wapas li jaye to us ka
--             apna manfi waqia banta hai -- waqt us ka faisla nahi
--             karta.
--
-- Ab wazan ki table hi batati hai ke ye factor kis kism ka hai.
--
-- ---------------------------------------------------------------
-- DOOSRI: sifar wale kisan ko "standard" udhaar mil raha tha
-- ---------------------------------------------------------------
-- ZTEST-13 wo kisan hai jis ne udhaar mara, der se diya, aur waade se
-- phira -- us ka score theek sifar bana, darja Low. Aur eligibility ne
-- kaha: "standard".
--
-- Wajah ye thi ke eligibility sirf khatre ke nishan, coverage aur
-- credit history dekhti thi -- SCORE DEKHTI HI NAHI THI. Ye us usool ko
-- had se aage le jana tha ke "eligibility darje ka doosra naam nahi".
-- Wo darje ka doosra naam nahi hai -- magar us se aankhein bhi nahi
-- band kar sakti.
--
-- Ab Low aur Bronze apni jagah rok lagate hain. Upar ka rukh waisa hi
-- hai: Gold ya Platinum khud ba khud udhaar ki manzoori nahi banta, aur
-- requires_human_approval hamesha true rehta hai.
-- ---------------------------------------------------------------

alter table score_factor_weights
  add column if not exists decays boolean not null default true;

comment on column score_factor_weights.decays is
  'false = ye factor haalat batata hai, waqia nahi. Tasdeeq purani ho kar khatam nahi hoti.';

update score_factor_weights set decays = false
 where factor_key in ('profile_verification', 'kyc_verification');

-- ---------------------------------------------------------------
-- Engine dobara -- ab wazan ki table batati hai ke waqt ka asar hoga
-- ya nahi.
-- ---------------------------------------------------------------
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
     and evidence_state = 'verified';

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
       and e.evidence_state = 'verified';

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
                    and kind in ('credit','installment'))
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

-- ---------------------------------------------------------------
-- Eligibility -- ab neeche ke darje apni jagah rok lagate hain
-- ---------------------------------------------------------------
create or replace function fn_credit_eligibility(p_subject_type text, p_subject_id uuid)
returns table (level text, blocked text[], requires_human_approval boolean, reasons jsonb)
language plpgsql stable security definer set search_path to 'public' as $$
declare s record;
begin
  -- Staff aur department par udhaar ka sawal hi nahi banta.
  if p_subject_type in ('staff','department') then
    return query select 'not_applicable'::text, array[]::text[], true,
      jsonb_build_array(jsonb_build_object('reason', 'Udhaar ka sawal is par lagta hi nahi'));
    return;
  end if;

  select * into s from score_snapshots
   where subject_type = p_subject_type and subject_id = p_subject_id
   order by snapshot_date desc limit 1;

  if not found or s.state <> 'active' then
    return query select 'not_assessed'::text, array['new_credit']::text[], true,
      jsonb_build_array(jsonb_build_object('reason',
        coalesce(s.reason_summary, 'Koi hisaab abhi bana hi nahi')));
    return;
  end if;

  if 'unresolved_write_off' = any (s.risk_flags) then
    return query select 'high_risk'::text, array['gold_credit','platinum_credit','new_credit']::text[], true,
      jsonb_build_array(jsonb_build_object('reason', 'Write-off abhi hal nahi hua', 'flag', 'unresolved_write_off'));
    return;
  end if;

  if 'overdue' = any (s.risk_flags) then
    return query select 'restricted'::text, array['new_credit']::text[], true,
      jsonb_build_array(jsonb_build_object('reason', 'Tay shuda tareekh guzar chuki aur raqam baqi hai', 'flag', 'overdue'));
    return;
  end if;

  -- Eligibility darje ka doosra naam nahi -- magar us se aankhein band
  -- bhi nahi kar sakti.
  if s.band = 'low' then
    return query select 'high_risk'::text, array['new_credit']::text[], true,
      jsonb_build_array(jsonb_build_object('reason', 'Guzra hua chaal chalan bohat kamzor', 'score', s.score, 'band', s.band));
    return;
  end if;

  if s.band = 'bronze' then
    return query select 'restricted'::text, array['gold_credit','platinum_credit']::text[], true,
      jsonb_build_array(jsonb_build_object('reason', 'Chaal chalan kamzor', 'score', s.score, 'band', s.band));
    return;
  end if;

  if s.credit_history_state <> 'established' or s.evidence_coverage < 0.70 then
    return query select 'unproven'::text, array[]::text[], true,
      jsonb_build_array(jsonb_build_object(
        'reason', 'Darja bana hai magar udhaar ka apna record poora nahi',
        'credit_history', s.credit_history_state,
        'evidence_coverage', s.evidence_coverage));
    return;
  end if;

  return query select 'standard'::text, array[]::text[], true,
    jsonb_build_array(jsonb_build_object(
      'reason', 'Record poora hai', 'band', s.band, 'evidence_coverage', s.evidence_coverage));
end;
$$;
