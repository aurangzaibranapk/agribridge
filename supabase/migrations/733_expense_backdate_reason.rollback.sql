-- 733 wapas. Sirf backdate_reason ka khana aur help ki wohi lakeer.
-- Koi journal, koi raqam nahi cherti.

alter table public.company_expense_requests drop column if exists backdate_reason;

update public.feature_help
set mistakes = array_remove(
    mistakes,
    'Guzri hui tareekh ka kharcha: manzoori se pehle wajah (kam az kam 10 harf). Bina wajah kitab nahi banti aur halat verified rehti hai.'
  ),
  updated_at = now()
where feature_key in ('pending-approvals', 'kharche') and lang = 'rm';

update public.feature_help
set mistakes = array_remove(
    mistakes,
    'A backdated expense needs a reason (at least 10 letters) before approval. Without it the ledger does not post and the expense stays verified.'
  ),
  updated_at = now()
where feature_key = 'pending-approvals' and lang = 'en';

update public.feature_help
set mistakes = array_remove(
    mistakes,
    'پرانی تاریخ کے خرچے کی منظوری سے پہلے وجہ (کم از کم ۱۰ حروف)۔ وجہ کے بغیر کتاب نہیں بنتی اور تصدیق برقرار رہتی ہے۔'
  ),
  updated_at = now()
where feature_key = 'pending-approvals' and lang = 'ur';
