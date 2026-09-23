-- =====================================================================
-- Migration 212: Anaj se score ke waqiat
-- =====================================================================
-- AUDIT KI SAB SE AHEM BAAT: ANAJ MEIN TASDEEQ KA KOI QADAM HAI HI
-- NAHI.
--
-- Doodh ka apna silsila hai -- pending_fat, priced, verified, rejected
-- -- aur 'verified' hone ke liye database khud maangta hai ke kis ne
-- tasdeeq ki aur paanch harf ka tabsara likha (chk_milk_verify_comment).
-- Machinery mein kisan ki apni tasdeeq hai (farmer_confirmed_at).
--
-- Anaj mein in mein se kuch nahi. grain_procurement_entries mein na
-- status hai, na verified_at, na verified_by -- aur code mein bhi
-- tasdeeq ka koi function nahi. Ek banda tulai likhta hai aur baat
-- khatam. Doosri nazar kahin nahi.
--
-- Faisla project ke apne usool se kiya gaya (190):
--
--   "jab DAFTAR ka banda darj karta hai, to wohi us ki tasdeeq hai --
--    us ko dobara tasdeeq karana bekaar kaam hai."
--
-- Yani jis qatar par ek naam likha hai (created_by), wo tasdeeq shuda
-- mani jayegi. Aur jis par koi naam hi nahi, wo sirf 'pending' rahegi
-- -- drill-down mein nazar aayegi, ginti mein nahi aayegi.
--
-- YE BAAT MALIK KE SAAMNE ALAG SE RAKHI GAYI HAI, kyunke is ka matlab
-- ye hai ke anaj ka saboot doodh ke saboot se KAMZOR hai: ek aadmi ki
-- likhai par khaRa hai, do ki nahi.

insert into score_event_severity
  (subject_type, factor_key, event_type, direction, magnitude, never_decays, label) values
  ('farmer','supply_engagement','grain_month', 1, 5, false, 'Us mahine anaj diya')
on conflict do nothing;

-- ---------------------------------------------------------------
-- Kisan -- kitne mahine anaj laaya
-- ---------------------------------------------------------------
-- Doodh wala hi qanoon: MIQDAR KA KOI DAKHAL NAHI. Mahine ka ek waqia,
-- chahe do bori ho ya do sau. Aur us mahine ki pehli entry us waqie ka
-- lungar banti hai.
create or replace function fn_sync_grain_farmer(p_farmer_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare r record; anchors uuid[] := '{}';
begin
  for r in
    select distinct on (date_trunc('month', entry_date))
           id, entry_date, created_by
      from grain_procurement_entries
     where farmer_id = p_farmer_id
     order by date_trunc('month', entry_date), entry_date, id
  loop
    perform fn_score_put_event('farmer', p_farmer_id, 'supply_engagement',
      'grain_month', r.entry_date::timestamptz, 'grain_procurement_entries', r.id,
      -- Naam likha hai to tasdeeq, warna sirf nazar aane wali qatar.
      case when r.created_by is not null then 'verified' else 'pending' end,
      null, to_char(r.entry_date, 'Mon YYYY') || ' -- anaj aaya');
    anchors := array_append(anchors, r.id);
  end loop;

  update score_events
     set invalidated_at = now(), invalidated_reason = 'us mahine ka lungar badal gaya'
   where subject_type = 'farmer' and subject_id = p_farmer_id
     and source_table = 'grain_procurement_entries' and event_type = 'grain_month'
     and invalidated_at is null
     and not (source_id = any (anchors));

  perform fn_recalc_score('farmer', p_farmer_id);
end;
$$;

create or replace function fn_sync_grain_all()
returns int language plpgsql security definer set search_path to 'public' as $$
declare n int := 0; r record;
begin
  -- SIRF KISAN. Jahan party_id hai aur farmer_id nahi, wahan bechne wala
  -- aarhti ya beopari hai -- us ka apna koi darja hai hi nahi, aur us ki
  -- supply kisi kisan ke khate mein daalna jhoot hoga.
  for r in select distinct farmer_id from grain_procurement_entries where farmer_id is not null loop
    perform fn_sync_grain_farmer(r.farmer_id); n := n + 1;
  end loop;
  return n;
end;
$$;

-- ---------------------------------------------------------------
-- JO CHEEZEIN JAAN BOOJH KAR CHHORI GAYIN
-- ---------------------------------------------------------------
-- grain_procurement_payments -- ye HAMARI zimmedari hai, kisan ka chaal
--   chalan nahi. Aur anaj mein se udhaar ki katauti pehle se
--   farmer_credit_ledger mein 'grain_procurement' ke naam se aati hai
--   (137) aur 209 use gin chuka hai. Yahan dobara ginna wohi paisa do
--   dafa ginna hota.
--
-- is_edited / original_amount -- adaigi ki raqam baad mein badli gayi.
--   Ye ek asal nishan hai, magar wajah ka koi khana nahi. Ho sakta hai
--   pehli likhai ghalat thi, ho sakta hai baat dobara tay hui. Bina
--   wajah jane darj karne wale par manfi nishan lagana andaza hai.
--   Malik ke saamne rakha gaya hai: wajah ka khana ban jaye to ye staff
--   ki durusti ka acha paimana banega.
--
-- cut_percentage, cut_kg, moisture, quality_grade -- anaj geela tha ya
--   us mein katauti lagi. Kisan ko us ka paisa PEHLE HI kam mila. Us par
--   score bhi ghatana ek hi baat ki do dafa saza hogi.
--
-- chungi -- ye local mehsool hai, kisi ke chaal chalan ka paimana nahi.
