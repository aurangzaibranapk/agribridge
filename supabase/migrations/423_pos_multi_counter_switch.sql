-- =====================================================================
-- AgriBridge — Migration 423: Ek staff, kai POS counters — shift band
-- kiye baghair switch
-- =====================================================================
-- Malik (15 September, screenshot ke sath): "agr ek staff ko 2/3 pos hy
-- to wo whan pay shift close kiay bina hy dosry pos pay ja k dosri
-- dukan ki bhi sale kr sky, or dosry pos pay same button ho wo wapis
-- grosry shop k pos pay a jay."
--
-- WAJAH `uq_pos_shift_open_staff` (366) purani soorat mein sahi thi
-- (ek waqt mein ek hi counter chalta tha), magar ab ek staff jis ke
-- paas 2-3 counters ki ijazat hai, use har dukan ka apna alag cash
-- till/shift chahiye -- jaisa asal mein hota hai (ek counter ka golak
-- doosre counter tak sath nahi jata). Counter-level taala
-- (`uq_pos_shift_open_counter`) waisa hi rehta hai -- ek counter par
-- ek waqt mein sirf EK khula shift, chahe wo kisi ka bhi ho.
create unique index if not exists uq_pos_shift_open_counter on pos_shifts (counter_id) where status = 'open';
drop index if exists uq_pos_shift_open_staff;

comment on table pos_shifts is 'Phase 6/423: Counter physical sale point hai, Shift us par staff ka session. Ek counter par ek waqt mein sirf EK khula shift (uq_pos_shift_open_counter). Ek staff ab APNE kai counters par ek sath khula shift rakh sakta hai (423) -- switch karne ke liye shift band karna zaroori nahi.';
