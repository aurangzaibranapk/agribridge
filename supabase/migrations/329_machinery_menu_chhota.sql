-- =====================================================================
-- AgriBridge — Migration 329: Machinery ka menu chhota
-- =====================================================================
-- Malik ka kehna (6 September): *"machinery ke bohot tabs bane hain. Ye
-- asan form banayein — ek form booking ka ho, baqi ek form jab machine
-- dispatch hui, baqi ek form jahan vendor work complete karta hai. Ye
-- sab ek hi form mein aayein, lamba chaura na ho. Ye bohot mushkil kaam
-- hua para hai."*
--
-- =====================================================================
-- PEHLE YE DEKHA GAYA KE WO FORM PEHLE SE HAI YA NAHI
-- =====================================================================
--
-- Hai. `/admin/machinery-rental/booking/<id>` par saat qadam ek hi safhe
-- par, ek ke neeche ek:
--
--   1 Advance → 2 Rate ki tasdeeq → 3 Machine ki rawangi →
--   4 Kaam ki entry → 5 Bill → 6 Kisan ki adaigi → 7 Vendor ka hissa
--
-- Aur har qadam agle se taala band hai (tasdeeq ke baghair rawangi nahi,
-- kaam ke baghair bill nahi). Yani booking, dispatch aur vendor ka kaam
-- -- teenon WAHIN hote hain.
--
-- To phir kaam mushkil kyun lag raha tha? **Menu ki wajah se.** Machinery
-- ke 21 naam SAAT hisson mein bikhre hue the. Ikkis naam dekh kar lagta
-- hai ikkis alag kaam hain -- jabke rozana ka kaam ek hi safhe par hai.
--
-- =====================================================================
-- DO QATAREIN JIN MEIN KOI FORM HAI HI NAHI
-- =====================================================================
--
-- `Machine Rawangi` (assign) aur `Kaam ki Entry` (work) -- dono kholi
-- kar dekhi gayin. Dono `MachineryQueue` hain: sirf FEHRIST, koi form
-- nahi, aur har naam wapas usi booking wale safhe par le jata hai.
--
-- Aur ek baat jo faisla saaf kar deti hai: **`Kattai Schedule` un dono
-- ko pehle se dikhata hai** -- dono qatarein, aur behtar tarteeb se
-- (tareekh ke hisaab se: "kis din kya hona hai", qatar ke hisaab se
-- nahi). Yani wo do sirf zyada nahi thin -- un ka kaam pehle se ho raha
-- tha.
--
-- Malik ne ye bhi bataya ke **abhi har booking wo khud karte hain**,
-- staff ki training baqi hai. Yani in do qataron ka koi rozana ka
-- istemal karne wala hai hi nahi.
--
-- **FEATURE MITAYA NAHI GAYA -- SIRF MENU SE HATAYA GAYA.** Ijazat,
-- madad aur safha teenon apni jagah hain. Jis din staff ki training ho
-- jaye aur kisi banday ka poora din rawangi dekhna ho, ye do qatarein
-- ek qatar likh kar wapas menu par aa jayengi.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) Wo do qatarein menu se
-- ---------------------------------------------------------------------
delete from public.dashboard_features
where dashboard_key = 'machinery'
  and feature_key in ('machinery-rental.assign', 'machinery-rental.work');


-- ---------------------------------------------------------------------
-- 2) Baqi unnees naam SAAT hisson se CHAAR mein
-- ---------------------------------------------------------------------
-- Saat unwan 21 naamon par lagane se fehrist aur lambi ho jati hai:
-- har unwan apni jagah leta hai aur nazar ko rokta hai. Chaar hisse,
-- aur har hisse ka ek saaf sawal:
--
--   ROZANA          -- aaj kya karna hai
--   MANZOORI AUR HISAAB -- paisa kis ka, kis ko, kitna
--   SETUP           -- machine, rate, diesel, zameen (kabhi kabhi)
--   REPORTS         -- guzar chuki baat
update public.dashboard_features set section = 'Rozana', section_order = 1, sort_order = 10
 where dashboard_key = 'machinery' and feature_key = 'machinery-rental';
update public.dashboard_features set section = 'Rozana', section_order = 1, sort_order = 11
 where dashboard_key = 'machinery' and feature_key = 'machinery-rental.list';
update public.dashboard_features set section = 'Rozana', section_order = 1, sort_order = 12
 where dashboard_key = 'machinery' and feature_key = 'machinery-rental.schedule';
update public.dashboard_features set section = 'Rozana', section_order = 1, sort_order = 13
 where dashboard_key = 'machinery' and feature_key = 'machinery-rental.calendar';

update public.dashboard_features set section = 'Manzoori aur Hisaab', section_order = 2, sort_order = 20
 where dashboard_key = 'machinery' and feature_key = 'machinery-rental.advance-claims';
update public.dashboard_features set section = 'Manzoori aur Hisaab', section_order = 2, sort_order = 21
 where dashboard_key = 'machinery' and feature_key = 'machinery-rental.work-claims';
update public.dashboard_features set section = 'Manzoori aur Hisaab', section_order = 2, sort_order = 22
 where dashboard_key = 'machinery' and feature_key = 'machinery-rental.billing';
update public.dashboard_features set section = 'Manzoori aur Hisaab', section_order = 2, sort_order = 23
 where dashboard_key = 'machinery' and feature_key = 'machinery-rental.reminders';
update public.dashboard_features set section = 'Manzoori aur Hisaab', section_order = 2, sort_order = 24
 where dashboard_key = 'machinery' and feature_key = 'machinery-rental.vendor-cash';
update public.dashboard_features set section = 'Manzoori aur Hisaab', section_order = 2, sort_order = 25
 where dashboard_key = 'machinery' and feature_key = 'machinery-rental.vendor-settlement';
update public.dashboard_features set section = 'Manzoori aur Hisaab', section_order = 2, sort_order = 26
 where dashboard_key = 'machinery' and feature_key = 'machinery-rental.lifters';

update public.dashboard_features set section = 'Setup', section_order = 3, sort_order = 30
 where dashboard_key = 'machinery' and feature_key = 'machinery-rental.machines';
update public.dashboard_features set section = 'Setup', section_order = 3, sort_order = 31
 where dashboard_key = 'machinery' and feature_key = 'machinery-rental.rate-card';
update public.dashboard_features set section = 'Setup', section_order = 3, sort_order = 32
 where dashboard_key = 'machinery' and feature_key = 'machinery-rental.diesel';
update public.dashboard_features set section = 'Setup', section_order = 3, sort_order = 33
 where dashboard_key = 'machinery' and feature_key = 'machinery-rental.farm-map';

update public.dashboard_features set section = 'Reports', section_order = 4, sort_order = 40
 where dashboard_key = 'machinery' and feature_key = 'machinery-rental.dashboard';
update public.dashboard_features set section = 'Reports', section_order = 4, sort_order = 41
 where dashboard_key = 'machinery' and feature_key = 'machinery-rental.pnl';
update public.dashboard_features set section = 'Reports', section_order = 4, sort_order = 42
 where dashboard_key = 'machinery' and feature_key = 'machinery-rental.reports';
update public.dashboard_features set section = 'Reports', section_order = 4, sort_order = 43
 where dashboard_key = 'machinery' and feature_key = 'machinery-rental.arhti-board';


-- ---------------------------------------------------------------------
-- 3) Madad par wo baat likhna jo sab se ahem hai
-- ---------------------------------------------------------------------
-- Malik ko ye maloom hi nahi tha ke saara kaam ek safhe par hai -- kyunki
-- menu ne ulta bataya. Ye baat madad ke safhe par pehla jumla honi
-- chahiye.
insert into public.feature_help
  (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
values (
  'machinery-rental',
  'rm',
  'Machine ki booking ka poora kaam. Ek booking ka HAR qadam ek hi safhe par hota hai — booking se le kar vendor ke hisse tak. Alag alag form nahi.',
  'Malik, Manager aur machinery ka staff.',
  'Jab kisan machine mange, aur us ke baad har qadam par.',
  ARRAY[
    'Nayi booking banayein — kisan, machine, raqbe aur rate ke saath.',
    'Booking ke naam par click karein. Ab SAARA kaam usi ek safhe par hai:',
    '1) Advance  2) Rate ki tasdeeq  3) Machine ki rawangi  4) Kaam ki entry  5) Bill  6) Kisan ki adaigi  7) Vendor ka hissa',
    'Har qadam agle se taala band hai — tasdeeq ke baghair rawangi nahi, kaam ke baghair bill nahi.',
    'Aaj kis booking par kya karna hai — wo "Kattai Schedule" par tareekh ke hisaab se dikhta hai.'
  ],
  'Booking ke safhe par jayein — poora kaam wahin hai.',
  ARRAY[
    'Rawangi aur kaam ki entry ke liye ALAG form dhoondhne ki zaroorat nahi. Wo dono usi booking wale safhe ke qadam 3 aur 4 hain.',
    '"Kattai Schedule" ek FEHRIST hai, form nahi — us par naam daba kar booking ke safhe par jayein, kaam wahin hota hai.',
    'Qadam apni tarteeb se hi hote hain. Agar koi qadam taala band nazar aaye to us ka matlab hai us se pehle wala abhi baqi hai — wo koi kharabi nahi.'
  ]
)
on conflict (feature_key, lang) do update set
  purpose = excluded.purpose, who_uses = excluded.who_uses, when_use = excluded.when_use,
  how_steps = excluded.how_steps, next_step = excluded.next_step, mistakes = excluded.mistakes,
  updated_at = now();
