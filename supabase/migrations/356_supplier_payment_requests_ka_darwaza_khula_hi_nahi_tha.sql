-- =====================================================================
-- AgriBridge — Migration 356: supplier_payment_requests ka darwaza
-- khula hi nahi tha
-- =====================================================================
-- ERP ki poori review ke doraan (6 September) mila -- malik ne khud
-- nahi poocha tha, review karte hue nikla.
--
-- supplier_payment_requests par RLS chalu thi magar koi policy nahi
-- thi -- matlab is safhe (Finance Queue, /admin/finance/queue) ka ye
-- pura hissa (request banana, dekhna, approve/reject karna) kabhi kaam
-- hi nahi kar saka, kisi ke liye bhi, khud owner ke liye bhi. Table
-- mein abhi bhi zero qatarein hain -- kisi ne is se pehle koshish
-- nahi ki thi ya har koshish khamoshi se rok di gayi thi.
--
-- company_expense_requests (isi tarah ki qatar) mein pehle se ye
-- pattern hai: SELECT har staff ke liye khula, likhna/badalna sirf
-- un logon ke liye jo app code mein bhi ye kaam kar sakte hain
-- (finance + HQ: super_admin/admin/owner) -- yehi yahan bhi lagaya.
-- =====================================================================

alter table public.supplier_payment_requests enable row level security;

create policy "spr_staff_parh_sakta"
on public.supplier_payment_requests for select
using (fn_is_any_staff());

create policy "spr_finance_hq_likh_sakta"
on public.supplier_payment_requests for all
using (fn_has_dept(array['owner','super_admin','admin','finance']::public.user_role[]))
with check (fn_has_dept(array['owner','super_admin','admin','finance']::public.user_role[]));
