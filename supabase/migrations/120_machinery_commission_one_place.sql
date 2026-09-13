-- =====================================================================
-- AgriBridge — Migration 120: Commission ka rate sirf ek jagah
-- =====================================================================
-- Malik ka faisla: rate admin tay karega -- 10%, 12%, 20%, jo chahe. Us
-- ke liye zaroori hai ke rate ki JAGAH sirf ek ho.
--
-- Ab tak do jagah thi: platform_settings mein company ka rate (119 se),
-- aur machinery_vendor_machines par har machine ka apna
-- commission_percentage (us par 10% pada hua tha).
--
-- Doosri jagah ab hataayi ja rahi hai. Wajah sajawat nahi:
--
--   * 119 ke baad wo column kisi hisaab mein aata hi nahi tha -- bill ka
--     commission platform_settings se banta hai. Yani wo screen par 10%
--     dikhata rehta jabke bill 12% ka banta. Do number dikhna aur unhen
--     alag hona -- ye us se bura hai ke ek hi number ho.
--
--   * Machine ka form us ko abhi bhi bharta tha. Yani nayi machine banane
--     wala samajhta ke wo commission tay kar raha hai, jabke us ki likhi
--     hui baat kahin lagti hi nahi thi.
--
-- Column giraya ja raha hai, sifar nahi kiya ja raha: sifar chhoR dene ka
-- matlab hota ke wo khana wahin para rahe aur kisi din koi use dobara
-- bharne lage.
-- =====================================================================

alter table machinery_vendor_machines drop column if exists commission_percentage;

comment on table machinery_vendor_machines is
  'Vendor ki machinein. Commission ka rate yahan NAHI hota -- wo poori company ke liye ek hi hai: platform_settings.machinery_commission_rate (Admin -> Machinery Rental se badalta hai).';
