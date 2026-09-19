-- =====================================================================
-- AgriBridge — Migration 435: Wholesale customer ka apna Shop/Business naam
-- =====================================================================
-- Malik (19 September): "wholesale ke liye Shop ka naam bhi add ho aur
-- wahi POS mein aana chahiye, jaisay dealer ya buyer/supplier ke hota
-- hai." `customers.name` sirf contact/person ka naam hai (jaise
-- "Amir Sultan") -- us ki apni dukaan ka naam ("Sultan Traders") kahin
-- darj nahi hota tha, jab ke dealers ke paas apna `business_name`
-- pehle se hai.
alter table customers add column if not exists business_name text;
