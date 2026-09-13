-- =====================================================================
-- AgriBridge — Migration 368: POS Counter tables par ijazat (GRANT)
-- =====================================================================
-- Wahi ghalti dobara -- is dafa POS Counter/Shift (366) mein. RLS lagi
-- thi (policies "using (true)"), magar GRANT nahi diya gaya tha.
--
-- 279 ka sabaq (us waqt 58 tables isi wajah se khali dikh rahi thin):
-- "RLS ki rok KHALI jawab deti hai; GRANT ki rok saaf mana karti hai."
-- Yahan Anwar Ul Hassan ke real test mein yehi hua -- browser ka
-- (RLS-bound) client `pos_counter_staff` se "permission denied" laata
-- raha, aur code us error ko chup chaap PURANE raaste (profiles.shop_id)
-- par gira deta raha -- counter/shift ka sawal kabhi aaya hi nahi.
--
-- 279 khud sirf EK DAFA ka backfill tha (jo us waqt tak ki tables ko
-- pakarta hai) -- is ke baad banayi gayi har nayi table (jaise ye
-- migration khud) ko apna GRANT chahiye hota hai. Aage se har naye RLS
-- wale table ke sath yehi teen line saath jani chahiye.
-- =====================================================================

grant select, insert, update, delete on public.pos_counters to authenticated, service_role;
grant select, insert, update, delete on public.pos_counter_staff to authenticated, service_role;
grant select, insert, update, delete on public.pos_shifts to authenticated, service_role;

-- pos_shift_counters -- RLS nahi (279 ke usool ke mutabiq "andar ka
-- khana", sirf server/service client chhoota hai -- nextShiftNumber()).
grant select, insert, update on public.pos_shift_counters to service_role;

select pg_notify('pgrst', 'reload schema');
