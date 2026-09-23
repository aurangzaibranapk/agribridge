-- =====================================================================
-- Migration 215: Score ki tableon par parhne ki ijazat
-- =====================================================================
-- SAYE WALA SAFHA BANATE WAQT EK ASAL KHARABI NIKLI.
--
-- Score ki tableon par RLS laga di gayi thi aur policy bhi likh di gayi
-- thi -- magar table par PARHNE KI BUNIYADI IJAZAT hi kisi ko nahi di
-- gayi thi. Postgres mein ye do alag cheezein hain:
--
--   GRANT  -- kya ye banda is table ko chhoo bhi sakta hai
--   RLS    -- chhoo sakta hai to KAUNSI QATAREIN
--
-- Grant ke baghair RLS ka koi matlab hi nahi -- darwaza hi band tha.
-- Master Admin ki chaabi laga kar dekha to jawab aaya: "permission
-- denied for table score_snapshots". Yani safha banta, build bhi hota,
-- aur kholte hi toot jata.
--
-- Ye ghalti sirf ASAL CHAABI laga kar dekhne se milti hai. Service key
-- se sab kuch chalta rehta hai, kyunke wo RLS aur grant, dono se bahar
-- hai.
--
-- SIRF SELECT. Likhne ki ijazat kisi ko nahi -- na insert, na update,
-- na delete. Score sirf engine likhta hai aur wo SECURITY DEFINER se
-- chalta hai, is liye usay in grants ki zaroorat hi nahi. "Apna score
-- theek karo" ka koi darwaza kahin nahi khulta.

grant select on score_snapshots      to authenticated;
grant select on score_events         to authenticated;
grant select on score_obligations    to authenticated;
grant select on score_factor_weights to authenticated;
grant select on score_event_severity to authenticated;
grant select on score_runs           to authenticated;

-- ---------------------------------------------------------------
-- loan_installments -- pehle pehra, phir darwaza
-- ---------------------------------------------------------------
-- Ye table 199 mein bani thi aur us par RLS lagi hi nahi thi. Us waqt
-- koi khatra nahi tha kyunke us tak koi pahunch hi nahi sakta tha.
-- Magar ab agar sirf grant de dein to har login kiye hue bande ko har
-- kisan ka qarz ka schedule nazar aane lagega.
--
-- Is liye tarteeb ulti nahi ki ja sakti: pehle pehra, phir darwaza.
alter table loan_installments enable row level security;

drop policy if exists p_loan_inst_staff on loan_installments;
create policy p_loan_inst_staff on loan_installments for select
  using (fn_is_any_staff());

grant select on loan_installments to authenticated;
