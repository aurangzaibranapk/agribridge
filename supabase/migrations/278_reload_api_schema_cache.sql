-- =====================================================================
-- AgriBridge — Migration 278: API ka schema cache dobara banwana
-- =====================================================================
-- /admin/access-requests par saare adad sifar aa rahe the, jab ke
-- database mein 1 pending darkhwast aur 2 khule takraao maujood the.
--
-- Farq ye tha: saada query (sirf profiles) chal rahi thi, magar jin
-- query mein profiles ka JORR (embed) hai wo khali jawab de rahi thin --
-- yani API ka schema cache un rishton ko jaanta hi nahi tha. Ye tables
-- 270/271/276 mein bani thin.
--
-- `notify pgrst, 'reload schema'` pooler ke raaste se nahi pahuncha, is
-- liye yahan asal DDL (comment) chalayi ja rahi hai: us par Supabase ka
-- apna event trigger chalta hai jo cache khud dobara banata hai.
--
-- Ye migration data ko haath nahi lagati -- sirf tafseel likhti hai.
-- =====================================================================

comment on table access_requests is 'Ijazat ki darkhwastein (270). AI draft banata hai, insaan manzoor karta hai.';
comment on table access_conflict_findings is 'Ijazat ke takraao ki fehrist (271). Advisory -- kuch khud nahi hatta.';
comment on table access_conflict_rules is 'Takraao ke qawaid (271) -- badalne ke qabil, code mein hard-code nahi.';
comment on table access_conflict_events is 'Takraao ka audit (271) -- sirf jorna, badalna nahi.';
comment on table access_conflict_scans is 'Takraao ke scan (271).';
comment on table user_feature_permissions is 'Kisi ek banday ki apni ijazat (104/193), miyaad ke sath.';
comment on table staff_message_broadcasts is 'Ek se ziyada bandon ko bheje gaye paighaam ka audit (276).';

select pg_notify('pgrst', 'reload schema');
