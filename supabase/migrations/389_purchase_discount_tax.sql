-- =====================================================================
-- AgriBridge — Migration 389: Discount aur Tax bill se purchase tak
-- =====================================================================
-- Malik (10 September): "tax aur discount ki amount kahan gayi hai, wo
-- nazar nahi aayi." Wajah: supplier bill ka discount_amount/tax_amount
-- AI parh kar `supplier_bill_reads` mein daal deta hai (mismatch check
-- ke liye), magar wahan se aage kabhi jata hi nahi tha -- Purchase ban
-- te hi ye raqam gum ho jati, kyunke `purchases` par koi khana hi nahi
-- tha.
--
-- Ab teen khane purchases par bhi hain. Poore bill ka discount/tax sirf
-- ISI bill ki PEHLI purchase par lagta hai -- agar ek bill do-teen
-- purchases mein banti hai (388) to raqam sirf ek dafa gine, teen dafa
-- nahi.
-- =====================================================================

alter table public.purchases
  add column if not exists discount_amount numeric(12,2),
  add column if not exists tax_amount numeric(12,2),
  add column if not exists tax_label text;

comment on column public.purchases.discount_amount is
  'Poore supplier bill ka discount -- sirf us bill ki pehli purchase par (10 September). KHALI = maloom nahi, sifar nahi.';
comment on column public.purchases.tax_amount is
  'Poore supplier bill ka tax (jaise Advance Tax) -- sirf us bill ki pehli purchase par. KHALI = maloom nahi.';
