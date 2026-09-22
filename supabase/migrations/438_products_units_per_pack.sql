-- Pet aur single botal (Boss, 19 September, supplier bill "CC PET1L
-- 1X6" ke sath): kharid PET (peti) ke hisaab se hoti hai -- bill par
-- rate pet ka hota hai ("1X6" = pet mein 6 botal, Rs 753.41 fi pet) --
-- magar shop par sale SINGLE botal ki hoti hai, aur stock bhi botal
-- mein chalta hai.
--
-- Ye khana yaad rakhta hai ke is cheez ki pet mein kitni botal hain,
-- taake purchase form khud hisaab kare: pet ka rate likho, botal ka
-- rate khud nikle; wholesale rate pet ka likho, system botal ka nikaal
-- kar rakhe. Products ke rate (purchase/selling/wholesale/mrp) HAMESHA
-- fi botal mehfooz hote hain -- POS botal bechta hai.

alter table products add column if not exists units_per_pack numeric;

comment on column products.units_per_pack is
  'Pet/carton mein kitni units (botal) hain -- jaise "1X6" = 6. NULL ya 1 = ye cheez pet mein nahi aati. Rates phir bhi fi unit rehte hain.';
