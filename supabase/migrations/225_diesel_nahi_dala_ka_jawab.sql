-- =====================================================================
-- Migration 225: "Diesel nahi dala" -- ye bhi ek jawab hai
-- =====================================================================
-- Booking ke safhe par qadam 4 (Diesel) mein litre aur rate dono lazmi
-- hain. Us ka matlab ye tha ke jis booking par diesel dala hi nahi
-- gaya, us par koi jawab diya hi nahi ja sakta tha: form bhara nahi ja
-- sakta (sifar litre likhna jhoot hai -- us ka matlab "dala tha, sifar
-- dala" banta hai), aur "nahi dala" kehne ka koi raasta tha hi nahi.
--
-- Nateeja ye tha ke qadam 4 hamesha adhoora khara rehta, aur us khali
-- gole ko dekh kar koi ye nahi bata sakta tha ke:
--
--     diesel dala hi nahi tha
--   ya
--     dala tha magar kisi ne abhi tak darj nahi kiya
--
-- Ye do bilkul alag baatein hain aur dono ek jaisi nazar aati thin --
-- wohi purani ghalti jis se ye project bar bar bachta aaya hai: jis
-- cheez ka indraj hi nahi hota, us ke saamne khali jagah chhoR dena.
--
-- Hal wohi hai jo ISI SAFHE par advance ke liye pehle se maujood hai
-- (advance_declined_at / advance_declined_by): jawab likh lo. Raqam
-- kahin nahi jati, koi ledger nahi hilta -- sirf ye darj hota hai ke
-- sawal ka jawab aa chuka hai, kis ne diya aur kab.
--
-- Baad mein diesel dal jaye to nishan hat jata hai aur darwaza dobara
-- khul jata hai -- magar us ke kehne par, safhe ke poochhne par nahi.

alter table machinery_bookings
  add column if not exists diesel_none_at timestamptz,
  add column if not exists diesel_none_by uuid references profiles(id);

comment on column machinery_bookings.diesel_none_at is
  'Kab darj hua ke is booking par diesel dala hi nahi gaya. Khali = jawab abhi aaya hi nahi (ye "diesel nahi dala" ke barabar NAHI hai).';

comment on column machinery_bookings.diesel_none_by is
  'Kis ne ye jawab darj kiya.';
