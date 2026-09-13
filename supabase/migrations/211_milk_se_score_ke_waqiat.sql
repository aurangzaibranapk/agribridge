-- =====================================================================
-- Migration 211: Doodh se score ke waqiat
-- =====================================================================
-- YAHAN MIQDAR KA KOI DAKHAL NAHI.
--
-- Malik ka faisla saaf hai: supply_engagement TASALSUL naapta hai,
-- miqdar nahi. Is liye us mahine ka ek waqia banta hai jis mein kisan
-- ne doodh diya -- chahe das litre ho ya paanch sau. Do kisanon ke
-- darmiyan faraq sirf ye rehta hai ke kaun kitne mahine sath raha, ye
-- nahi ke kaun kitna bara hai. Warna ye factor khaamoshi se AMEERI ko
-- bharose ka paimana bana deta.
--
-- HAR WAQIE KE PEECHE EK ASAL QATAR. Mahina koi document nahi hota, is
-- liye us mahine ki PEHLI TASDEEQ SHUDA entry us waqie ka lungar banti
-- hai. Drill-down mein us par click kar ke wohi entry khul jati hai.
-- Lungar badal sakta hai (koi purani parchi baad mein tasdeeq ho jaye)
-- -- us soorat mein purana waqia batil hota hai aur naya banta hai;
-- mahine ka ek hi waqia rehta hai.
--
-- TASDEEQ KA MATLAB YAHAN SAKHT HAI. milk_entries mein 'verified' hone
-- ke liye database khud maangta hai (chk_milk_verify_comment): kis ne
-- tasdeeq ki, aur kam az kam paanch harf ka tabsara. Ye nishan kisi ke
-- baithe baithe nahi lagta.
--
-- JO DOODH KA PAISA HUM KISAN KO DETE HAIN, WO US KA CHAAL CHALAN NAHI.
-- milk_payments hamari zimmedari hai. Aur jahan doodh mein se udhaar
-- kata jata hai, wo farmer_credit_ledger mein 'produce_repayment' ke
-- naam se pehle hi darj hota hai aur 209 use gin chuka hai -- yahan
-- dobara ginna wohi paisa do dafa ginna hota.
--
-- REJECTED ENTRY PAR KOI WAQIA NAHI. status 'rejected' ho sakta hai
-- kharab doodh ki wajah se, aur ho sakta hai daftar ki apni ghalti se.
-- Table mein wajah ka koi khana nahi. Bina wajah jane kisan par manfi
-- nishan lagana andaza hai, hisaab nahi.

insert into score_event_severity
  (subject_type, factor_key, event_type, direction, magnitude, never_decays, label) values
  ('farmer','supply_engagement','milk_month',            1,  5, false, 'Us mahine doodh diya'),
  ('staff','verification_accuracy','verified_month',     1,  8, false, 'Us mahine tasdeeq ka kaam kiya'),
  ('staff','verification_accuracy','duplicate_verified',-1, 10, false, 'Dobara wali entry tasdeeq kar di')
on conflict do nothing;

-- ---------------------------------------------------------------
-- Kisan -- kitne mahine sath raha
-- ---------------------------------------------------------------
create or replace function fn_sync_milk_farmer(p_farmer_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare r record; anchors uuid[] := '{}';
begin
  for r in
    select distinct on (date_trunc('month', entry_date))
           id, entry_date
      from milk_entries
     where farmer_id = p_farmer_id and status = 'verified' and verified_at is not null
     order by date_trunc('month', entry_date), entry_date, id
  loop
    perform fn_score_put_event('farmer', p_farmer_id, 'supply_engagement',
      'milk_month', r.entry_date::timestamptz, 'milk_entries', r.id,
      'verified', null, to_char(r.entry_date, 'Mon YYYY') || ' -- doodh aaya');
    anchors := array_append(anchors, r.id);
  end loop;

  update score_events
     set invalidated_at = now(),
         invalidated_reason = 'us mahine ka lungar badal gaya ya tasdeeq baqi nahi rahi'
   where subject_type = 'farmer' and subject_id = p_farmer_id
     and source_table = 'milk_entries' and event_type = 'milk_month'
     and invalidated_at is null
     and not (source_id = any (anchors));

  perform fn_recalc_score('farmer', p_farmer_id);
end;
$$;

-- ---------------------------------------------------------------
-- Staff -- tasdeeq ka kaam, aur us ki durusti
-- ---------------------------------------------------------------
create or replace function fn_sync_milk_staff(p_profile_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare r record; anchors uuid[] := '{}';
begin
  for r in
    select distinct on (date_trunc('month', verified_at))
           id, verified_at
      from milk_entries
     where verified_by_profile_id = p_profile_id and status = 'verified'
       and verified_at is not null
     order by date_trunc('month', verified_at), verified_at, id
  loop
    perform fn_score_put_event('staff', p_profile_id, 'verification_accuracy',
      'verified_month', r.verified_at, 'milk_entries', r.id,
      'verified', null, to_char(r.verified_at, 'Mon YYYY') || ' -- tasdeeq ka kaam');
    anchors := array_append(anchors, r.id);
  end loop;

  update score_events
     set invalidated_at = now(), invalidated_reason = 'us mahine ka lungar badal gaya'
   where subject_type = 'staff' and subject_id = p_profile_id
     and source_table = 'milk_entries' and event_type = 'verified_month'
     and invalidated_at is null
     and not (source_id = any (anchors));

  -- Dobara wali entry jise tasdeeq kar diya gaya. Nishan pehle se lagta
  -- hai (101) magar rok nahi -- faisla manager ka hota hai. Agar us ke
  -- bawajood tasdeeq ho gayi to wo TASDEEQ KARNE WALE ki apni ghalti
  -- hai, kisan ki nahi. Isi liye ye waqia staff par lagta hai.
  for r in
    select id, verified_at from milk_entries
     where verified_by_profile_id = p_profile_id and status = 'verified'
       and possible_duplicate_of is not null and verified_at is not null
  loop
    perform fn_score_put_event('staff', p_profile_id, 'verification_accuracy',
      'duplicate_verified', r.verified_at, 'milk_entries', r.id,
      'verified', null, 'is par pehle se dobara hone ka nishan tha');
  end loop;

  update score_events
     set invalidated_at = now(), invalidated_reason = 'ab is par dobara hone ka nishan nahi'
   where subject_type = 'staff' and subject_id = p_profile_id
     and source_table = 'milk_entries' and event_type = 'duplicate_verified'
     and invalidated_at is null
     and source_id not in (
       select id from milk_entries
        where verified_by_profile_id = p_profile_id and status = 'verified'
          and possible_duplicate_of is not null);

  perform fn_recalc_score('staff', p_profile_id);
end;
$$;

create or replace function fn_sync_milk_all()
returns int language plpgsql security definer set search_path to 'public' as $$
declare n int := 0; r record;
begin
  for r in select distinct farmer_id from milk_entries where status = 'verified' loop
    perform fn_sync_milk_farmer(r.farmer_id); n := n + 1;
  end loop;
  for r in select distinct verified_by_profile_id as pid from milk_entries
            where status = 'verified' and verified_by_profile_id is not null loop
    perform fn_sync_milk_staff(r.pid); n := n + 1;
  end loop;
  return n;
end;
$$;
