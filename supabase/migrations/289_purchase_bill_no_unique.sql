-- =====================================================================
-- AgriBridge — Migration 289: Ek bill, ek purchase
-- =====================================================================
-- Malik ne 4 September ko Live par ye pakRa: ek hi sheet teen dafa
-- charhayi gayi aur TEEN purchase ban gayin. Supplier ka dena
-- Rs 315,914 ho gaya, jab ke asal ek tihai tha.
--
-- Ye ghalti khamosh hai aur yehi us ka sab se bura pehlu hai. Har
-- purchase apni jagah bilkul theek nazar aati hai -- wohi supplier,
-- wohi cheezein, wohi rate. Farq sirf statement par nikalta hai, aur
-- wahan tak pahunchte pahunchte adaigi ho chuki hoti hai.
--
-- Malik ka hukm (unhi ke matlab mein): bill number darj ho to charhe;
-- na likha ho to charhe hi nahi; aur wohi bill number dobara aaye to
-- purchase kabhi na bane.
--
-- Rok DO jagah lagti hai, aur dono zaroori hain:
--
--   1. Code mein -- taake banday ko saaf paighaam mile ("ye bill pehle
--      charh chuka hai") na ke koi database ki ajeeb ghalti.
--   2. Yahan, database mein -- kyunke sirf code ki rok us waqt kaam
--      nahi karti jab do bande ek hi lamhe mein charhayein, ya koi
--      naya raasta banaya jaye jo jaanch karna bhool jaye. Jo qanoon
--      sirf ek darwaze par likha ho, wo qanoon nahi -- guzarish hai.
--
-- Radd ki hui purchase ka number azad ho jata hai: ghalti se bani
-- purchase radd kar ke wohi bill dobara theek se charhaya ja sake.
-- =====================================================================

alter table public.purchases
  add column if not exists supplier_bill_no text;

comment on column public.purchases.supplier_bill_no is
  'Supplier ke apne bill ka number. Ek supplier ka ek bill sirf ek dafa charh sakta hai (289).';

-- Naam ke chhote bare harf aur aage peeche ki jagah se farq nahi paRta:
-- "INV-001", "inv-001" aur " INV-001 " ek hi bill hain.
create unique index if not exists ux_purchases_supplier_bill_no
  on public.purchases (supplier_id, lower(btrim(supplier_bill_no)))
  where supplier_bill_no is not null
    and btrim(supplier_bill_no) <> ''
    and status <> 'cancelled';
