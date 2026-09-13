-- =====================================================================
-- AgriBridge — Migration 264: Bill ki qatar par "andaza" aur "tasdeeq"
-- =====================================================================
-- H (score ke sath milaan) match_source mein 'fuzzy:NN' aur 'confirmed'
-- likhta hai, magar 248 ki rok sirf barcode / auto_name / chosen ko
-- guzarne deti thi. Us se milti julti qatar wala bill charhta hi nahi
-- tha. Rok ab in dono ko bhi maanti hai. Live par jaate waqt pakRa gaya.
-- =====================================================================

alter table supplier_bill_lines drop constraint if exists chk_bill_line_match_source;
alter table supplier_bill_lines add constraint chk_bill_line_match_source
  check (
    match_source is null
    or match_source in ('barcode', 'auto_name', 'chosen', 'confirmed')
    or match_source ~ '^fuzzy:[0-9]{1,3}$'
  );
