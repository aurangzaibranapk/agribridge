-- =====================================================================
-- AgriBridge — Migration 410: Phone number, ek hi format (92...)
-- =====================================================================
-- Malik (14 September): "sab ka number set kar do 034 se 92
-- international code — system mein update kar dein."
--
-- `farmers` aur `customers` dono mein kuch numbers mulki format
-- (0342...) mein the, jab ke baaqi sab 92342... (international) mein
-- -- isi wajah se search aur POS ka milan kabhi kabhi chook jata tha.
-- Verify kiya: dono taraf koi collision nahi (na farmers mein, na
-- customers mein) -- seedha update karna mehfooz hai.

update public.farmers
set phone_number = '92' || substring(phone_number from 2)
where phone_number like '0%' and is_deleted = false;

update public.customers
set phone_number = '92' || substring(phone_number from 2)
where phone_number like '0%';
