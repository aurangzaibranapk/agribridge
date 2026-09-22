-- =====================================================================
-- AgriBridge — Migration 409: Customer aur Farmer, ek hi phone, do record
-- =====================================================================
-- Malik (14 September): "POS mein hamare farmer nahi aa rahe, jo CRM
-- list mein nahi hain, in ka balance a raha hai jo in k naam already
-- hai jo lena hai."
--
-- Wajah: `customer_import` (bulk balance upload) `farmer_id` kabhi set
-- nahi karta -- sirf phone number se dekhta hai. Jin farmers ka phone
-- import list mein bhi tha, un ka ek `customers` row asal balance ke
-- sath ban gaya, magar `farmers` se juda kabhi nahi -- POS ke safhe
-- (`/admin/pos/page.tsx`) ko pata hi nahi ke ye dono ek hi banda hain,
-- is liye farmer ke liye ek KHAALI (`balance: null`) banawati qatar
-- alag se dikhata hai, aur asal balance wali qatar "farmer" ki tarah
-- pehchani hi nahi jati.
--
-- 78 farmers isi haal mein mile (naam bilkul milte hain, kisi ka
-- balance Rs 14 lakh tak) -- verify kiya ke koi phone clash nahi (na
-- customers mein do baar ek phone, na kisi farmer ka pehle se koi
-- doosra customer juda hua), is liye seedha phone se milan safe hai.

update public.customers c
set farmer_id = f.id
from public.farmers f
where c.farmer_id is null
  and f.is_deleted = false
  and f.phone_number = c.phone_number
  and not exists (
    select 1 from public.customers c2 where c2.farmer_id = f.id
  );
