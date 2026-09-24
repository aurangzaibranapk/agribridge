-- =====================================================================
-- AgriBridge — Migration 357: Load & Bill ka udhaar kisan ko bhi
-- =====================================================================
-- Malik (7 September): Load & Bill ka "Kis ke khate par" (khata) sirf
-- dukan ke customer tak mehdood nahi -- kisan ko bhi udhaar milta hai.
--
-- `load_transactions.customer_id` sirf `customers` table ki taraf jata
-- hai; `farmer_id` isi tarah ka doosra khana hai, taake dono type
-- alag-alag record ho sakein aur koi bhi ghalat FK mein na dabaya jaye.
-- =====================================================================

alter table public.load_transactions
  add column farmer_id uuid references public.farmers(id);

comment on column public.load_transactions.farmer_id is
  'Khata (udhaar) kisan ke naam par ho to yahan, customer ho to customer_id mein — dono ek sath kabhi nahi bharte.';
