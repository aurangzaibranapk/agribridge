-- =====================================================================
-- Migration 216: Kisan apni qist khud dekh sake
-- =====================================================================
-- 215 mein qiston ki policy yun likhi gayi thi ke wo farmer_loans mein
-- jhaank kar dekhe ke ye qarz kis ka hai. Chalte hue nizam mein wo kaam
-- nahi karti -- aur wajah baareek hai:
--
--   Policy usi bande ki haisiyat se chalti hai jo sawal kar raha hai.
--   To policy ke ANDAR wali query bhi usi ke pehre mein hai. Kisan
--   farmer_loans nahi parh sakta, is liye us ki apni qist bhi "kisi ki
--   nahi" nikli.
--
-- Imtihaan mein yehi hua: kisan ko apni chaar qiston mein se ek bhi
-- nazar nahi aayi.
--
-- Ilaj wohi jo score ke liye pehle se chal raha hai: milkiyat ka sawal
-- ek SECURITY DEFINER function se poochha jaye. Wo apni haisiyat se
-- dekhta hai aur sirf HAAN/NAHI lautata hai -- na koi qatar bahar aati
-- hai, na kisi doosre ka data.

create or replace function fn_owns_loan(p_loan_type text, p_loan_id uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from farmer_loans l join farmers f on f.id = l.farmer_id
     where p_loan_type = 'farmer' and l.id = p_loan_id and f.user_id = auth.uid()
  ) or exists (
    select 1 from livestock_loans l join farmers f on f.id = l.farmer_id
     where p_loan_type = 'livestock' and l.id = p_loan_id and f.user_id = auth.uid()
  );
$$;

drop policy if exists p_loan_inst_own on loan_installments;
create policy p_loan_inst_own on loan_installments for select
  using (fn_owns_loan(loan_type, loan_id));
