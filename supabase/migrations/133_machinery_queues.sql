-- =====================================================================
-- AgriBridge — Migration 133: Machinery ki kaam qatarein
-- =====================================================================
-- Malik ki fehrist mein Machinery ke neeche chhe cheezein hain: Booking,
-- Machine Assignment, Harvest Schedule, Fuel/Expense, Work Completion,
-- aur Final Bill/Payment.
--
-- Bunyadi baat ye ke ye ALAG kaam nahi hain -- ye EK booking ke chhe
-- qadam hain, aur wo poora silsila pehle se bana hua hai (116). Har
-- qadam ka apna safha banane ka matlab hota ke ek hi booking chhe jagah
-- likhi jaye.
--
-- Jo cheez waqai nahi thi wo ye: staff ko ye nazar hi nahi aata tha ke
-- "MERE intezar mein kya para hai". Booking ki poori fehrist mein sab
-- kuch ek sath hota hai -- jo abhi bani hai, jis ka rate bhejna hai, jis
-- ki machine nikalni hai, jis ka bill banana hai. Machine bhejne wale ko
-- un mein se apni qatar dhoondni paRti thi.
--
-- Is liye qatarein. Har booking apne aap us qatar mein aa jati hai jahan
-- wo abhi khari hai, aur nikal jati hai jab agla qadam ho jata hai.
-- Fehrist hath se nahi banti -- yehi baat ahem hai, kyunke hath se bani
-- fehrist wo booking bhool jati hai jise koi update karna bhool gaya.
-- =====================================================================

create or replace view v_machinery_queue as
select
  b.id,
  b.booking_number,
  b.status,
  b.booking_date,
  b.preferred_date,
  b.crop_type,
  b.harvest_area,
  b.machine_type_requested,
  b.final_rate,
  b.field_ready,
  b.harvest_ready,
  b.location_address,
  f.full_name as farmer_name,
  f.farmer_code,
  f.phone_number as farmer_phone,

  -- Kaun si qatar. Tarteeb ahem hai: pehla milne wala jeetta hai, aur
  -- tarteeb wohi hai jo asal silsile ki hai.
  case
    when b.status = 'new' and b.rate_confirmation_sent_at is null then 'rate_bhejna'
    when b.status = 'new' and b.farmer_confirmed_at is null       then 'tasdeeq_ka_intezar'
    when b.status = 'ready_for_harvest'                            then 'machine_bhejna'
    when b.status = 'in_progress'                                  then 'kaam_darj_karna'
    when b.status = 'bill_pending'                                 then 'bill_banana'
    when b.status = 'payment_pending'                              then 'paisa_lena'
  end as queue,

  -- Kitne din se khari hai. Ye adad qatar se zyada ahem hai: teen din
  -- purani booking aur teen hafte purani booking ek hi qatar mein hoti
  -- hain, magar dusri par foran dekhna chahiye.
  (current_date - b.booking_date) as din_purani,

  -- Kaam ki tareekh nikal chuki ho -- yani wada guzar gaya.
  (b.preferred_date is not null and b.preferred_date < current_date) as tareekh_guzar_gayi

from machinery_bookings b
left join farmers f on f.id = b.farmer_id
where b.status not in ('closed', 'cancelled');

comment on view v_machinery_queue is
  'Har khuli booking apne agle qadam ki qatar mein. Fehrist khud banti hai -- kisi ke update karne ka intezar nahi.';

-- ---------------------------------------------------------------------
-- Menu mein
-- ---------------------------------------------------------------------
-- Char alag raaste, ek hi component. Wajah IJAZAT hai: jo banda machine
-- bhejta hai usay bill banane ki ijazat dena zaroori nahi -- aur alag
-- ijazat sirf alag raaste par lag sakti hai.
insert into features (key, label, route, icon, label_en, label_ur) values
  ('machinery-rental.assign',   'Machine Bhejna',      '/admin/machinery-rental/assign',   'Truck',
   'Machine Assignment', 'مشین بھیجنا'),
  ('machinery-rental.schedule', 'Kattai ka Schedule',  '/admin/machinery-rental/schedule', 'CalendarClock',
   'Harvest Schedule',   'کٹائی کا شیڈول'),
  ('machinery-rental.work',     'Kaam Darj Karna',     '/admin/machinery-rental/work',     'ClipboardCheck',
   'Work Completion',    'کام درج کرنا'),
  ('machinery-rental.billing',  'Bill aur Adaigi',     '/admin/machinery-rental/billing',  'Receipt',
   'Final Bill / Payment', 'بل اور ادائیگی')
on conflict (key) do update set label = excluded.label, route = excluded.route,
  icon = excluded.icon, label_en = excluded.label_en, label_ur = excluded.label_ur;

insert into dashboard_features (dashboard_key, feature_key, sort_order) values
  ('machinery', 'machinery-rental.assign',   20),
  ('machinery', 'machinery-rental.schedule', 21),
  ('machinery', 'machinery-rental.work',     22),
  ('machinery', 'machinery-rental.billing',  23)
on conflict do nothing;
