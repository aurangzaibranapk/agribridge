-- 190: Phone se aayi vendor ki raqam, dawa hi rahe.
--
-- PEHLE EK TASHEEH. Qadam 1 ke test mein maine likha tha ke teenon
-- maali tables ka default 'verified' hai aur "Sync ke barabar Approval
-- nahi" wala qanoon sirf TypeScript par khaRa hai. Default ka hissa
-- durust tha, natija ghalat tha:
--
--   fn_guard_work_verification aur fn_guard_fuel_log PEHLE SE maujood
--   hain, aur wo mere tajweez se ZYADA sakht hain:
--
--     source='vendor' ki qatar paida hote waqt 'claimed' ke ilawa kuch
--     ho hi nahi sakti -- device ka nishan ho ya na ho.
--
--   Mere test ne `source` likha hi nahi tha, is liye wo STAFF ki qatar
--   bani aur us ka 'verified' hona bilkul durust tha. Guard chala hi
--   nahi kyunke chalne ki baat hi nahi thi.
--
-- ASAL KHAALI JAGAH SIRF EK HAI: machinery_payments.
--
-- Wahan aisi koi rok nahi. Vendor ki wasool ki hui raqam seedha
-- 'verified' ban sakti hai. Aur ye jaan boojh kar hai: jab DAFTAR ka
-- banda darj karta hai ke "vendor ne kisan se paisa liya", to wohi us
-- ki tasdeeq hai -- us ko dobara tasdeeq karana bekaar kaam hai.
--
-- Is liye yahan rok utni hi tang hai jitni honi chahiye (malik ka
-- Option B): SIRF us qatar par jis par PHONE ka nishan ho.
--
--   device ka nishan (client_action_id) + vendor ne wasool ki
--   -> paida hote waqt 'verified' nahi ho sakti.
--
-- Daftar ka raasta bilkul waisa hi chalta hai -- us par koi nishan
-- nahi hota.
--
-- SIRF BANATE WAQT (BEFORE INSERT). Jab daftar baad mein us dawe ki
-- tasdeeq karega wo UPDATE hoga, aur nishan tab bhi qatar par maujood
-- hoga -- CHECK constraint laga dete to wohi rok us tasdeeq ko bhi rok
-- deti aur dawa hamesha ke liye dawa reh jata.
--
-- Rok khamoshi se theek karne ke bajaye SAAF MANA karti hai: agar ye
-- kabhi chali to matlab code mein ghalti hai, aur wo ghalti qatar ko
-- wajah ke sath rokegi jahan nazar aa jayegi.

create or replace function public.fn_guard_offline_payment_claim()
returns trigger
language plpgsql
as $function$
begin
  if new.client_action_id is not null
     and new.collected_by_vendor_id is not null
     and new.verification_status = 'verified' then
    raise exception
      'Phone se aayi hui vendor ki raqam paida hote waqt tasdeeq shuda nahi ho sakti. Usay "claimed" bhejein -- tasdeeq daftar ka alag qadam hai. (Sync ka matlab manzoori nahi.)';
  end if;
  return new;
end $function$;

-- Kaam aur diesel par apni rok pehle se hai (fn_guard_work_verification,
-- fn_guard_fuel_log). Wahan doosra guard lagana sirf drift paida karta:
-- do jagah ek hi baat, alag alfaz mein, aur kal koi ek badal deta.
drop trigger if exists trg_offline_claim_work on public.machinery_work_records;
drop trigger if exists trg_offline_claim_fuel on public.machinery_fuel_logs;
drop trigger if exists trg_offline_claim_payment on public.machinery_payments;
drop function if exists public.fn_guard_offline_claim_not_verified();

create trigger trg_offline_payment_claim
  before insert on public.machinery_payments
  for each row execute function public.fn_guard_offline_payment_claim();
