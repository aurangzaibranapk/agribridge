-- =====================================================================
-- AgriBridge — Migration 353: Live push ke liye ijazat aur publication
-- =====================================================================
-- Malik (6 September):
--
--   *"Bilkul live push hona chahiye, wo bilkul aana chahiye. Hamein to
--   har kaam realtime mein chahiye na — hamein ye nahi chahiye ke 10 din
--   ke baad pata chale."*
--
-- Safhe par `LiveRefresh` lag chuka hai. Magar us ke chalne ke liye
-- DATABASE par do cheezein chahiye thin, aur dono nahi thin.
--
-- =====================================================================
-- 1) PUBLICATION KHALI THI
-- =====================================================================
--
-- `supabase_realtime` naam ki publication maujood thi magar us mein EK
-- BHI table nahi tha. Yani koi tabdeeli kabhi bahar bheji hi nahi jati
-- thi. Safhe par "Live" ka nishan lag jata aur kuch hota hi nahi -- aur
-- ye khamosh nakami sab se mehngi hoti hai: banda "Live" dekh kar yaqeen
-- kar leta hai ke adad taaza hain.
--
-- =====================================================================
-- 2) TEEN TABLES PAR PARHNE KA KOI QANOON HI NAHI THA
-- =====================================================================
--
-- In teen par RLS chalu tha magar SELECT ka ek bhi qanoon nahi:
--
--   * company_expense_requests
--   * finance_transactions
--   * whatsapp_submissions
--
-- App ka kaam is se ruka nahi tha, kyunke wo teenon service client se
-- parhe jate hain (jo RLS se guzarta hi nahi). Magar Realtime bande ki
-- apni ijazat par chalta hai: jise qatar parhne ki ijazat nahi, usay us
-- ki tabdeeli ki khabar bhi nahi milti. Nateeja -- in teen par live push
-- KABHI na chalta.
--
-- Qanoon wohi lagaya ja raha hai jo saath wale tables par pehle se hai:
-- `fn_is_any_staff()`. Ye koi naya darwaza nahi kholta -- wo teenon
-- pehle bhi staff hi ke kaam ki thin, bas likha nahi tha.
--
-- =====================================================================
-- 3) REPLICA IDENTITY FULL -- AUR US KI QEEMAT
-- =====================================================================
--
-- RLS ke sath UPDATE aur DELETE ki khabar tabhi milti hai jab table par
-- `REPLICA IDENTITY FULL` ho. Is ke baghair sirf INSERT ki khabar aati.
--
-- Hamare liye UPDATE hi sab se ahem hai: manzoori ek UPDATE hai
-- (pending -> approved). Us ki khabar na aaye to manager manzoori de
-- de aur malik ke saamne wo qatar "intezar mein" pari rahe -- yani wohi
-- cheez jis se malik ne mana kiya.
--
-- Qeemat: WAL mein poori purani qatar bhi likhi jati hai, sirf key nahi.
-- Ye tables chhoti hain (roz ki gin-ne layak qatarein), is liye ye
-- qeemat qubool hai. Agar kabhi `pos_sales` bahut bara ho jaye to us ko
-- is fehrist se nikala ja sakta hai -- POS ki bikri ki khabar `journal`
-- se bhi pahunch jati hai.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) Parhne ka qanoon -- wohi jo saath wale tables par hai
-- ---------------------------------------------------------------------
drop policy if exists kharcha_staff_parh_sakta on public.company_expense_requests;
create policy kharcha_staff_parh_sakta on public.company_expense_requests
  for select using (fn_is_any_staff());

drop policy if exists finance_txn_staff_parh_sakta on public.finance_transactions;
create policy finance_txn_staff_parh_sakta on public.finance_transactions
  for select using (fn_is_any_staff());

drop policy if exists whatsapp_sub_staff_parh_sakta on public.whatsapp_submissions;
create policy whatsapp_sub_staff_parh_sakta on public.whatsapp_submissions
  for select using (fn_is_any_staff());


-- ---------------------------------------------------------------------
-- 2) UPDATE ki khabar bhi aaye
-- ---------------------------------------------------------------------
alter table public.company_expense_requests replica identity full;
alter table public.labour_work_entries      replica identity full;
alter table public.party_settlements        replica identity full;
alter table public.whatsapp_submissions     replica identity full;
alter table public.finance_transactions     replica identity full;
alter table public.journal_entries          replica identity full;
alter table public.pos_sales                replica identity full;


-- ---------------------------------------------------------------------
-- 3) Publication mein daalna
-- ---------------------------------------------------------------------
-- `add table` dobara chalane par ghalti deta hai, is liye pehle dekha
-- jata hai ke wo pehle se andar to nahi.
do $$
declare t text;
begin
  foreach t in array array[
    'company_expense_requests',
    'labour_work_entries',
    'party_settlements',
    'whatsapp_submissions',
    'finance_transactions',
    'journal_entries',
    'pos_sales'
  ]
  loop
    if not exists (
      select 1 from pg_publication_rel pr
        join pg_publication p on p.oid = pr.prpubid
        join pg_class c on c.oid = pr.prrelid
        join pg_namespace n on n.oid = c.relnamespace
       where p.pubname = 'supabase_realtime' and n.nspname = 'public' and c.relname = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
