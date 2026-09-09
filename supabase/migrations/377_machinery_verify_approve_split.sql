-- =====================================================================
-- AgriBridge — Migration 377: Machinery — verify aur approve do alag qadam
-- =====================================================================
-- Malik ka hukm (9 September): "no 2 bhi fix karo" (Machinery/POS Return
-- ka verify→approve abhi ek hi qadam hai).
--
-- Poore machinery module mein `machinery_payments` aur
-- `machinery_fuel_logs` par teen dawe (advance claim, vendor collection,
-- fuel claim) EK HI qadam mein "verify" karte hi ledger mein post ho
-- jate the -- jaisa Kharche (364), Stock Count (370), Purchases (372)
-- mein pehle tha, us se pehle.
--
-- BLAST RADIUS ki wajah se `verified` ka MATLAB nahi badla -- 14 se
-- zyada purani migrations (145, 150, 152, 166, 169, 171, 172, 174, 194,
-- 205, 208, 209, 226, 227, 313) ke views/triggers `verification_status
-- = 'verified'` ko "final, ledger mein ja chuka" samajh kar bill
-- generation, vendor settlement, farmer portal, cash custody chalate
-- hain. Wo sab jaisi hain waisi rehti hain -- 'verified' abhi bhi wohi
-- FINAL halat hai.
--
-- Sirf ek nayi BEECH ki halat: `manager_confirmed`.
--   claimed -> manager_confirmed  (Manager 'verify' -- sirf sach ka
--                                   iqrar, koi ledger post nahi)
--   manager_confirmed -> verified (Finance/Owner 'approve' -- yahan
--                                   asal ledger post hota hai)
--   claimed / manager_confirmed -> rejected (dono marhalon par mumkin)
--
-- `verified_by`/`verified_at` ka matlab wohi rehta hai jo pehle tha
-- ("kab/kis ne FINAL kiya") -- kyunke wo har jagah isi maane mein parha
-- jata hai. Manager ke marhale ka apna alag record chahiye, is liye
-- naye `manager_confirmed_by`/`manager_confirmed_at`.
-- =====================================================================

alter table public.machinery_payments
  add column if not exists manager_confirmed_by uuid references auth.users(id),
  add column if not exists manager_confirmed_at timestamptz;

alter table public.machinery_fuel_logs
  add column if not exists manager_confirmed_by uuid references auth.users(id),
  add column if not exists manager_confirmed_at timestamptz;

alter table public.machinery_payments drop constraint if exists chk_machinery_payment_verification;
alter table public.machinery_payments add constraint chk_machinery_payment_verification check (
  verification_status in ('claimed', 'manager_confirmed', 'verified', 'rejected')
);

alter table public.machinery_fuel_logs drop constraint if exists chk_fuel_verification;
alter table public.machinery_fuel_logs add constraint chk_fuel_verification check (
  verification_status in ('claimed', 'manager_confirmed', 'verified', 'rejected', 'cancelled')
);

comment on column public.machinery_payments.verification_status is
  'claimed = kisan/vendor ka dawa. manager_confirmed = Manager ne sach maana, ledger abhi khali. verified = Finance/Owner ne FINAL manzoor kiya, ledger mein hai. rejected = dekh kar rad kiya gaya.';

-- role_feature_permissions: Manager 'verify' (claimed -> manager_confirmed
-- ya rejected), Finance ab 'approve' (manager_confirmed -> verified ya
-- rejected) -- Kharche (364) wala hi batwara, 'verify' aur 'approve' ek
-- hi bande ke paas nahi.
insert into role_feature_permissions (role, feature_key, actions, data_scope) values
  ('finance', 'machinery-rental.advance-claims', array['view','approve']::text[], 'all'),
  ('finance', 'machinery-rental.work-claims', array['view','approve']::text[], 'all')
on conflict (role, feature_key) do update set actions = excluded.actions, data_scope = excluded.data_scope;

-- Resync: jin Finance profiles ko 376 mein 'verify' mila tha (jab do
-- marhale nahi thay), un ka row ab 'approve' ban jaye.
update user_feature_permissions
   set actions = array['view','approve']::text[]
 where feature_key in ('machinery-rental.advance-claims', 'machinery-rental.work-claims')
   and profile_id in (select id from profiles where role::text = 'finance')
   and reason like 'Template resync (376)%';
