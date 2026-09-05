-- =====================================================================
-- AgriBridge — Migration 126: Farmer 360 Profile ke baqi khane
-- =====================================================================
-- Registration sirf teen cheezein leti hai: naam, mobile, zila. Baqi sab
-- kuch EK BAAR yahan bharta hai, aur phir har service isi ko parhti hai --
-- machinery, milk, grain, marketplace, wallet. Kisi service ka dobara
-- CNIC ya bank poochhna is poore intezam ko bemani kar deta hai.
--
-- Jo khane pehle se maujood the (cnic, village, tehsil, address,
-- land_size_acres, crop_types, kaghazat) unhein haath nahi lagaya. Sirf
-- wo daal rahe hain jo the hi nahi.
-- =====================================================================

alter table farmers
  add column if not exists father_name text,
  add column if not exists bank_name text,
  add column if not exists bank_account_title text,
  add column if not exists bank_account_number text,
  add column if not exists bank_iban text,
  add column if not exists mobile_wallet_provider text,
  add column if not exists mobile_wallet_number text,
  add column if not exists preferred_language text;

-- Walid ka naam is liye ke gaon mein ek hi naam ke kai log hote hain, aur
-- CNIC har kisi ke paas nahi hoti. "Aslam walad Ghulam Muhammad" wo
-- pehchan hai jo wahan waqai chalti hai.
comment on column farmers.father_name is
  'Walid ka naam. Gaon mein ek naam ke kai log hote hain -- asal pehchan yahi banti hai.';

-- Paisa kahan bheja jaye. Do raaste hain aur dono chalte hain: bank ka
-- khata, ya JazzCash/Easypaisa. Kisi ek ko lazmi karna ghalat hoga --
-- bohot se kisanon ke paas bank ka khata hai hi nahi.
alter table farmers drop constraint if exists farmers_mobile_wallet_provider_check;
alter table farmers add constraint farmers_mobile_wallet_provider_check
  check (mobile_wallet_provider is null or mobile_wallet_provider in ('jazzcash', 'easypaisa', 'sadapay', 'nayapay', 'other'));

-- Kaun si zaban mein baat ki jaye. Ye cookie mein rakhna kaafi nahi:
-- WhatsApp ka paighaam cookie nahi parhta, aur wahi paighaam kisan sab se
-- zyada parhta hai.
alter table farmers drop constraint if exists farmers_preferred_language_check;
alter table farmers add constraint farmers_preferred_language_check
  check (preferred_language is null or preferred_language in ('en', 'rm', 'ur'));

comment on column farmers.preferred_language is
  'en / rm (Roman Urdu) / ur. WhatsApp aur SMS ke liye -- wahan cookie nahi hoti.';
