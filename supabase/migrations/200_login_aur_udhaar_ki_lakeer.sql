-- =====================================================================
-- Migration 200: Login aur udhaar ke darmiyan lakeer
-- =====================================================================
-- Malik ka faisla:
--
--     Phone OTP Verified  =/=  Farmer Profile Verified  =/=  Credit Approved
--
-- Anjaan number ko OTP milta rahega -- wo rok nahi lagti. Naya kisan
-- khud ban sakta hai. Rok wahan lagni chahiye jahan asal khatra hai:
-- OTP theek hone par bande ko TASDEEQ SHUDA kisan samajh lena.
--
-- Aaj nizam mein pehli aur teesri cheez ka koi khana hi nahi:
--
--   * OTP theek hua -- ye kahin darj nahi hota. verifyFarmerOtp login
--     bana kar aage barh jata hai. Kal koi poochhe "is number ki
--     milkiyat kab sabit hui thi?" to jawab kisi qatar mein nahi.
--
--   * Udhaar ki manzoori -- sirf credit_limit ka khana hai. Aur us se
--     ye nahi pata chalta ke kisi ne manzoori di thi ya khana khali
--     para hai. Khali khana "mana kiya gaya" bhi ho sakta hai aur
--     "abhi tak poochha hi nahi gaya" bhi -- ye poore project ki wohi
--     purani ghalti hai: na hone aur sifar ko ek samajh lena.
--
-- DOOSRI CHEEZ PEHLE SE MAUJOOD HAI, is liye dobara nahi banayi ja
-- rahi. profile_status ek generated column hai (124) jo khud ba khud
-- banta hai:
--
--     basic_registered -> profile_incomplete -> profile_complete -> verified
--
-- Wo kisi ke haath se nahi likha jata, kaghazon se khud nikalta hai.
-- Us ke sath koi doosra khana rakhna do jagah ek sach rakhna hota, aur
-- wo hamesha ek din alag ho jate hain.
--
-- (registration_stage ka khana bhi maujood hai, magar us mein har kisan
-- par 'new' hi para hai -- koi jagah us mein kuch likhti hi nahi. Us
-- par naya qaida lagana bekar hota: aisi cheez par pehra jo kabhi
-- badalti hi nahi. Usay waise hi chhora ja raha hai.)
-- ---------------------------------------------------------------

-- ---------------------------------------------------------------
-- 1) Mobile ki milkiyat kab sabit hui
-- ---------------------------------------------------------------
-- Ye SIRF itna kehta hai ke is number par OTP pahuncha aur theek
-- nikla. Is se ye nahi nikalta ke banda kaun hai, us ke paas zameen
-- hai, ya usay udhaar diya ja sakta hai.
alter table farmers
  add column if not exists phone_verified_at timestamptz;

comment on column farmers.phone_verified_at is
  'OTP theek hone ka waqt. Sirf mobile ki milkiyat -- profile ki tasdeeq nahi, udhaar ki manzoori nahi.';

-- ---------------------------------------------------------------
-- 2) Udhaar ki manzoori
-- ---------------------------------------------------------------
--   none       -- kabhi baat hi nahi hui. YE SIFAR NAHI HAI.
--   requested  -- kisan ne maanga, faisla baqi
--   approved   -- manzoor
--   suspended  -- waqti rok (misal: baqaya hal hone tak)
--   blocked    -- bandh
--
-- 'none' ka default jaan boojh kar hai. Aaj har kisan is haalat mein
-- hai, aur wo sach hai: kisi ke bare mein faisla hua hi nahi.
alter table farmers
  add column if not exists credit_status text not null default 'none';

alter table farmers drop constraint if exists chk_farmer_credit_status;
alter table farmers add constraint chk_farmer_credit_status
  check (credit_status in ('none', 'requested', 'approved', 'suspended', 'blocked'));

comment on column farmers.credit_status is
  'Udhaar ki manzoori ka darja. none = faisla hua hi nahi (mana karna nahi).';

create index if not exists idx_farmers_credit_status
  on farmers (credit_status)
  where credit_status <> 'none';
