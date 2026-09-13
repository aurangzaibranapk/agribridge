-- =====================================================================
-- AgriBridge — Migration 359: Purchase review mein items dikhna aur edit
-- =====================================================================
-- Malik (7 September): "yahan agar approval deni hai to products ko
-- view to karna chahiye aya ke kisi ka rate to nahi ghalat kuch... jo
-- edit kiya wo trackable hona chahiye."
--
-- `purchase_comments.kind` par pehle se ek check tha jo sirf
-- comment/submit/send_back/approve/reject/resubmit qabool karta tha
-- (259). Ab review ke doran line (quantity/rate) edit ka bhi asar
-- isi silsile mein, dekhe jane wale audit trail mein, jana hai -- is
-- liye 'edit' shamil kiya ja raha hai.
-- =====================================================================

alter table public.purchase_comments drop constraint if exists chk_purchase_comment_kind;
alter table public.purchase_comments add constraint chk_purchase_comment_kind
  check (kind in ('comment', 'submit', 'send_back', 'approve', 'reject', 'resubmit', 'edit'));
