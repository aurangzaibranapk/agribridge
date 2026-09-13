-- 189: Khet se aane wale indraj ke liye idempotency ki chaabi.
--
-- PHASE 17 -- QADAM 1 KI BUNYAAD.
--
-- Offline entry ki sab se buri shakal ye nahi ke wo gum ho jaye. Sab se
-- buri shakal ye hai ke wo DO DAFA pahunch jaye: phone restart hua,
-- network beech mein toota, ya bande ne dobara "Bhejein" daba diya --
-- aur do bill, do adaigi, do ledger entry ban gayin. Gum hui entry
-- nazar aa jati hai; do dafa gini hui raqam kayi hafte tak nahi.
--
-- Is ka hal is project mein pehle se maujood hai, aur DOODH mein chal
-- raha hai:
--
--   1. Chaabi DEVICE par banti hai, bhejne se PEHLE.
--   2. Server par us par unique index hai.
--   3. Wohi chaabi dobara aaye to error nahi -- PEHLI entry ka jawab
--      wapas jata hai.
--
-- Ye migration wohi teesra qadam baqi chaar jagah par le jati hai.
-- Doodh ko haath nahi lagaya: us ka `client_uuid` chal raha hai aur
-- production mein qatarein us par khari hain. Naya engine dono naamon
-- ko ek hi cheez samjhega -- naam badal kar khatra mol lena bekaar hai.
--
-- Index JAAN BOOJH KAR partial hai (`where client_action_id is not
-- null`), bilkul doodh wale ki tarah. Purani qatarein aur wo indraj jo
-- daftar se aate hain (jin ke paas koi chaabi nahi hoti) NULL rakhte
-- hain, aur NULL par ye taala lagta hi nahi. Yani purana raasta jyun ka
-- tyun chalta rehta hai.

alter table public.machinery_work_records
  add column if not exists client_action_id uuid;
alter table public.machinery_fuel_logs
  add column if not exists client_action_id uuid;
alter table public.machinery_payments
  add column if not exists client_action_id uuid;
alter table public.attendance_records
  add column if not exists client_action_id uuid;

create unique index if not exists idx_machinery_work_records_client_action
  on public.machinery_work_records (client_action_id)
  where client_action_id is not null;

create unique index if not exists idx_machinery_fuel_logs_client_action
  on public.machinery_fuel_logs (client_action_id)
  where client_action_id is not null;

create unique index if not exists idx_machinery_payments_client_action
  on public.machinery_payments (client_action_id)
  where client_action_id is not null;

create unique index if not exists idx_attendance_records_client_action
  on public.attendance_records (client_action_id)
  where client_action_id is not null;

comment on column public.machinery_work_records.client_action_id is
  'Device par bana nishan, bhejne se PEHLE. Wohi nishan dobara aaye to nayi qatar nahi banti -- pehli ka jawab jata hai. Daftar se aane wale indraj mein NULL rehta hai aur taala NULL par lagta hi nahi.';
comment on column public.machinery_fuel_logs.client_action_id is
  'Device par bana nishan -- dekhein machinery_work_records.client_action_id.';
comment on column public.machinery_payments.client_action_id is
  'Device par bana nishan -- dekhein machinery_work_records.client_action_id.';
comment on column public.attendance_records.client_action_id is
  'Device par bana nishan -- dekhein machinery_work_records.client_action_id.';
