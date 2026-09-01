-- 182: Vendor ka aakhri jawab -- "haan" ho ya "nahi", darj to ho.
--
-- Masla jo live par saamne aaya:
--
--   Booking MB-2026-00001 par daftar ke bande ne KHUD kaam mukammal
--   darj kar diya (source='staff', is_final=true, verified). Us ke
--   baad vendor ke safhe par "Kattai ki tafseel bhejein" ka button
--   ghayab ho gaya -- kyunke wahan shart yehi thi ke koi FINAL indraj
--   maujood na ho.
--
--   Nateeja: vendor se wo do sawal kabhi poochhe hi na gaye jo sirf
--   USI ko maloom hain -- kisan ne diesel dala ya nahi, aur kisan ne
--   paisa diya ya nahi. Daftar ke bande ko in ka jawab pata nahi.
--
-- Kaam ka indraj dobara khulna DRUST NAHI hai: raqba do dafa verified
-- ho jaye to bill do guna ban jata hai. Is liye kaam band hi rehta
-- hai -- magar do sawal alag se poochhe jate hain.
--
-- Aur "nahi" bhi ek jawab hai. Us ke bina safha vendor se hamesha
-- poochta rahega, aur vendor poochna band karne ke liye jhoota "haan"
-- likh dega. Is liye jawab dene ka waqt yahan mehfooz hota hai.

alter table public.machinery_bookings
  add column if not exists vendor_closing_at timestamptz,
  add column if not exists vendor_closing_by uuid references auth.users(id);

comment on column public.machinery_bookings.vendor_closing_at is
  'Vendor ne kaam ke baad ke do sawal (diesel, kisan ki adaigi) ka jawab de diya -- "nahi" bhi jawab hai. Is se ye nahi banta ke diesel ya raqam maujood hai; wo apne apne khaton mein hai.';

comment on column public.machinery_bookings.vendor_closing_by is
  'Kis login ne jawab diya. Vendor ka user, daftar ka nahi.';
