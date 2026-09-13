-- =====================================================================
-- AgriBridge — Migration 254: Bill se seedha Purchase
-- =====================================================================
-- Malik ke naqshe (docs/AI-PURCHASE-PIPELINE.md) ka qadam A.
--
-- Bill reader (248) ab tak sirf TRADE RATE charhata tha. Purchase alag,
-- haath se banti thi. Halanke wohi bill, wohi qatarein, wohi product ka
-- milaan -- sab kuch purchase banane ke liye bhi kaafi hai. Do dafa wohi
-- kaam karwana staff ka waqt bhi khata hai aur do jagah alag adad ka
-- darwaza bhi kholta hai.
--
-- Is liye bill se ab purchase (pending) banti hai. Wo /admin/purchases
-- par jati hai; wahan "Receive" dabne par -- aur SIRF tab -- maal andar
-- aata hai (129) aur supplier ka dena charhta hai (139). Approval aur
-- warehouse ka stock do alag baatein rehti hain, jaisa malik ne kaha.
--
-- Yahan sirf ek link banta hai: kaun sa bill kaun si purchase bana.
-- Baad mein "ye purchase kis bill se aayi thi" ka jawab isi se milta
-- hai, aur ek bill se do purchase banne ki rok bhi yahin lagti hai.
-- =====================================================================

alter table supplier_bill_reads
  add column if not exists purchase_id uuid references purchases(id) on delete set null;

create unique index if not exists idx_bill_read_purchase_once
  on supplier_bill_reads (purchase_id) where purchase_id is not null;

comment on column supplier_bill_reads.purchase_id is
  'Is bill se jo purchase bani. Ek bill se ek hi purchase (254).';
