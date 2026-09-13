-- =====================================================================
-- 196  Vendor ke saamne wohi gross jis par us ka hissa banta hai
-- =====================================================================
--
-- Vendor ke safhe par teen adad ek sath khare the:
--
--   Gross            Rs 30,000
--   ART commission   Rs  3,360
--   Vendor ka hissa  Rs 24,640
--
-- 30,000 - 3,360 = 26,640, magar hissa 24,640 likha hai. Do hazar ka
-- farq kahin nazar nahi aata. Wo riayat hai jo kisan ko di gayi (194),
-- magar is safhe par us ka koi khana nahi -- is liye wo aisa lagta hai
-- jaise vendor ke hisse mein se kuch chup chaap kaat liya gaya ho.
--
-- Ek hi safhe par aisa jor jo mel na khaye, bande ka bharosa le doobta
-- hai -- khaas taur par jab wo bahar ka aadmi ho aur adad us ke apne
-- paison ke hon.
--
-- gross wahi hona chahiye jis par hissa BANTA hai: riayat ke baad wala.
-- Ab 28,000 - 3,360 = 24,640 theek baithta hai.

do $$
declare
  v_def text;
  v_new text;
begin
  v_def := pg_get_viewdef('public.v_machinery_vendor_booking_settlement'::regclass, true);

  v_new := replace(
    v_def,
    'COALESCE(bl.gross_amount, 0::numeric) AS gross,',
    'COALESCE(bl.gross_amount, 0::numeric) - COALESCE(bl.discount_amount, 0::numeric) AS gross,'
  );

  if v_new = v_def then
    raise exception '196: gross wali lakeer nahi mili -- view ka matn badal chuka hai, haath se dekhein.';
  end if;

  execute 'create or replace view public.v_machinery_vendor_booking_settlement as ' || v_new;
end $$;
