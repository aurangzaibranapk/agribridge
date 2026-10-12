-- Testing par unified khata migration chalne ke baad legacy Migration 010
-- policy nazar aayi. Permissive RLS policies OR hoti hain, is liye ye old
-- FOR ALL policy nayi organization policies ko bypass kar rahi thi.
drop policy if exists staff_all_access_farmers on public.farmers;
