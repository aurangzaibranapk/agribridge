-- =====================================================================
-- AgriBridge — Migration 303: Vendor ka dawa maante waqt naap ka farq
-- =====================================================================
-- Malik ne 5 September ko screenshot bheja: Kaam ke Dawe par raqba
-- theek karne ki koshish par ye jumla aata tha --
--
--   "Sabit (0.2500) aur Kutra (1.5000) ka jor asal raqbe (1.5313) ke
--    barabar hona chahiye."
--
-- Ye jumla database ki us rok (176) se aata hai jo DO QISM wali
-- ('dono') booking par lagti hai: jo kaam hua us ka sabit aur kutra
-- hissa mila kar poore raqbe ke barabar hona chahiye. Rok theek hai --
-- sabit aur kutra ka RATE ALAG hota hai, is liye batwara galat ho to
-- bill hi galat banta hai.
--
-- Magar tasdeeq wale safhe par batware ka koi khana hi nahi tha. Banda
-- sirf acre aur kanal badal sakta tha, aur purana batwara jyun ka tyun
-- reh jata tha -- jis se jor mel nahi khata tha aur dawa MAAN HI NAHI
-- SAKTA THA. Yani do qism wali booking par naap theek karne ka koi
-- raasta hi nahi tha.
--
-- Ab batware ke khane bhi wahin aa rahe hain. Us ke liye safhe ko ye
-- maloom hona chahiye ke booking kis qism ki hai aur abhi batwara kya
-- hai -- aur wo is view mein nahi tha. Ye migration wohi teen khane
-- daal rahi hai.
-- =====================================================================

-- Naye khane AAKHIR mein jur rahe hain, beech mein nahi -- Postgres
-- view ke maujooda khanon ki tarteeb ya naam badalne nahi deta.
--
-- Aur `security_invoker` yahan JAAN BOOJH KAR NAHI lagaya ja raha. Is
-- view ki rok us ke apne WHERE mein hai (`fn_is_any_staff()`).
-- security_invoker laga dene se machinery_work_records ki apni RLS
-- lagti, aur is project mein aisi rok ka nateeja hamesha wohi hota hai:
-- ghalti nahi aati, bas fehrist KHALI aa jati hai -- aur khali fehrist
-- "koi dawa nahi hai" kehti hai, jo jhoot hota hai.
create or replace view public.v_machinery_work_claims as
 SELECT w.id AS work_id,
    w.booking_id,
    b.booking_number,
    f.full_name AS farmer_name,
    v.vendor_name,
    w.work_date,
    w.actual_area,
    w.is_final,
    w.meter_reading,
    w.completion_photo_url,
    w.notes,
    w.created_at,
    CURRENT_DATE - w.work_date AS din_purane,
    w.actual_area_acres,
    w.actual_area_kanal,
    -- Do qism ki booking par tasdeeq karne wale ko batwara bhi dikhana
    -- aur maangna parta hai; ek qism wali par ye khane bemani hain.
    b.harvest_type,
    w.sabit_area,
    w.kutra_area
   FROM machinery_work_records w
     JOIN machinery_bookings b ON b.id = w.booking_id
     LEFT JOIN farmers f ON f.id = b.farmer_id
     LEFT JOIN machinery_vendors v ON v.id = b.vendor_id
  WHERE w.verification_status = 'claimed'::text AND fn_is_any_staff();
