-- 175: Machinery ke menu naam -- malik ke tay kiye hue alfaz par
--
-- Yahan sirf DIKHNE WALA naam badalta hai. Feature ki key wahi hai,
-- raasta wahi hai, ijazat wahi hai -- is liye kisi ki ijazat nahi
-- toot-ti aur koi link nahi marta.
--
-- Teen naam khaas tor par ghalat the:
--
--   "Machinery Rental" -- module ab sirf kiraya nahi. Us mein booking,
--   vendor, rate, kaam, diesel aur billing sab aa chuka hai.
--
--   "Vendor ke paas Paisa" -- ye vendor ko dena hai ya vendor se lena,
--   naam se pata hi nahi chalta tha. Aur usi safhe ke saath ek doosra
--   safha "Vendor Settlement" bhi hai; do mein farq karna mushkil tha.
--
--   "Payment ki Yaad Dahani" -- wahan sirf yaad nahi dilai jati, wasooli
--   ka poora kaam wahin hota hai.
--
-- Roman ka khana hamesha bhara rehta hai (123 ka usool): English ya
-- Urdu khali ho to Roman hi dikhta hai, menu khali nahi hota.

update public.features set label = v.rm, label_en = v.en, label_ur = v.ur
  from (values
    ('machinery-rental.dashboard',        'Machinery Dashboard',        'Machinery Dashboard',      'مشینری ڈیش بورڈ'),
    ('machinery-rental',                  'Machinery Booking',          'Machinery Booking',        'مشینری بکنگ'),
    ('machinery-rental.list',             'Tamam Bookings',             'All Bookings',             'تمام بکنگز'),
    ('machinery-rental.assign',           'Machine Rawangi',            'Machine Dispatch',         'مشین روانگی'),
    ('machinery-rental.schedule',         'Kattai Schedule',            'Work Schedule',            'کٹائی شیڈول'),
    ('machinery-rental.work',             'Kaam ki Entry',              'Work Entry',               'کام کی انٹری'),
    ('machinery-rental.billing',          'Kisan Bill aur Adaigiyan',   'Farmer Bills & Payments',  'کسان بل اور ادائیگیاں'),
    ('machinery-rental.farm-map',         'Farm Map',                   'Farm Map',                 'فارم میپ'),
    ('machinery-rental.advance-claims',   'Advance Tasdeeq',            'Advance Verification',     'ایڈوانس تصدیق'),
    ('machinery-rental.work-claims',      'Vendor ka Kaam',             'Vendor Work',              'وینڈر کا کام'),
    ('machinery-rental.vendor-cash',      'Vendor Adaigiyan',           'Vendor Payments',          'وینڈر ادائیگیاں'),
    ('machinery-rental.reminders',        'Raqam Wasooli',              'Payment Recovery',         'رقم وصولی'),
    ('machinery-rental.vendor-settlement','Vendor Settlement',          'Vendor Settlement',        'وینڈر سیٹلمنٹ'),
    ('machinery-rental.machines',         'Machinein',                  'Machines',                 'مشینیں'),
    ('machinery-rental.diesel',           'Diesel aur Fuel',            'Diesel & Fuel',            'ڈیزل اور فیول'),
    ('machinery-rental.pnl',              'Machinery P&L',              'Machinery P&L',            'مشینری منافع و نقصان'),
    ('machinery-rental.reports',          'Machinery Reports',          'Machinery Reports',        'مشینری رپورٹس')
  ) as v(key, rm, en, ur)
 where public.features.key = v.key;
