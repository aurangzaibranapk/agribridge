-- =====================================================================
-- AgriBridge — Migration 384: Farmer khud POS mein customer ki tarah
-- =====================================================================
-- Malik (10 September): "Farmer khud POS mein customer ki tarah
-- dhoondna chahiye" -- jo bandaa hamein maal (doodh, anaj) bechta hai,
-- wo counter se cheezein khareedna chahe to use dobara se "Customer"
-- register kiye bina, apne farmer record se hi POS mein mil jana chahiye.
--
-- Farmer ka WALLET (hum us ka kitna dete hain) aur Customer ka KHATA
-- (wo hamara kitna dega) DO ALAG hisaab hain, aur alag hi rahenge --
-- inhen milana ek din ek doosre ka paisa doosre ke khate mein daal
-- dega. Is liye farmer ko POS mein "customer" banane ka tareeqa ye hai:
-- pehli dafa counter se kuch khareedte hi, us ke apne farmer record se
-- ek chhota, juRa hua Customer record khud ban jata hai (naam/phone/CNIC
-- farmer se copy), aur agli dafa se wahi record istemal hota hai --
-- dobara nahi banta.
-- =====================================================================

alter table public.customers
  add column if not exists farmer_id uuid references public.farmers(id);

comment on column public.customers.farmer_id is
  'Agar ye Customer record kisi farmer se khud-kaar bana hai (384) -- taake dobara na bane. Farmer ka apna wallet is se bilkul alag hai.';

create unique index if not exists uq_customers_farmer_id
  on public.customers (farmer_id)
  where farmer_id is not null;
