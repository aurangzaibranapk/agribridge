-- 162: Driver machine ke sath likha jaye, har booking par nahi
--
-- Rawangi ke form par operator ka naam aur phone haath se likhe jate
-- the. Wohi machine, wohi driver, har booking par dobara.
--
-- Wo sirf mehnat ka masla nahi. Ek hi driver ka naam kabhi "nadeem",
-- kabhi "Nadeem", kabhi "nadim" likha jata hai, aur phone ka ek adad
-- galat lag jaye to jis din machine kahin nahi pahunchti us din wo
-- number kisi kaam ka nahi hota. Jo cheez badalti nahi, use hamesha
-- naya likhwana ghalti ki dawat hai.
--
-- Driver machine ke sath rehta hai, booking ke sath nahi -- is liye wo
-- machine par likha jata hai, aur rawangi ke waqt khud bhar jata hai.
-- Wahan badla bhi ja sakta hai: kisi din koi doosra bhi le jata hai.

alter table public.machinery_vendor_machines
  add column if not exists driver_name  text,
  add column if not exists driver_phone text;

comment on column public.machinery_vendor_machines.driver_name is
  'Is machine ka apna driver. Rawangi ke waqt khud bhar jata hai; us din koi aur le jaye to wahan badla ja sakta hai.';
comment on column public.machinery_vendor_machines.driver_phone is
  'Driver ka phone. Ek hi jagah likha jata hai, taake jis din machine kahin nahi pahunchti us din number theek ho.';
