-- =====================================================================
-- Migration 226: Fasal uthane wale -- tag, zimma, aur hamara commission
-- =====================================================================
-- Kisan kattai ke waqt kehta hai "fasal aap ko bechunga". Ab tak us ka
-- anjaam sirf ek fehrist thi (v_grain_leads_from_machinery) -- dilchaspi
-- ka record, sauda nahi. Wo theek tha aur waisa hi rahega.
--
-- Ab us se aage ka qadam: hum us fasal ko kisi UTHANE WALE (arhti,
-- beopari) ke hawale kar dete hain. Us ke baad do cheezein badalti hain:
--
--   1. Kattai ka baqi kisan ke zimme nahi rehta -- uthane wale ke zimme
--      chala jata hai. Wo fasal ka paisa kisan ko deta hai, aur us mein
--      se hamari kattai kaat kar hamein deta hai.
--   2. Us se hamara apna commission banta hai -- fasal ki qeemat ka
--      fisad. Ye machinery ke 12% se BILKUL ALAG cheez hai: wo kisan ke
--      bill par lagta hai, ye uthane wale par.
--
-- TEEN FAISLE JO MALIK NE KIYE, AUR UN KI WAJAH:
--
-- (a) UTHANE WALE KI APNI FEHRIST HAI -- `suppliers` mein nahi milaya
--     gaya. `suppliers` wo hain jin se HUM maal khareedte hain (khaad,
--     spare parts) -- un ke khate mein hamesha "hum ne dena" hota hai.
--     Uthane wale ke khate mein "us ne dena" hota hai. Do ulte hisaab
--     ek khate mein rakhne ka anjaam wohi hota hai jo migration 107
--     mein likha hai: bees ka lena aur bees ka dena aapas mein kat kar
--     sifar dikhata hai, aur kisi ko ye nazar nahi aata ke kis se lena
--     hai aur kis ko dena.
--
-- (b) COMMISSION FASAL KI QEEMAT PAR HAI, kattai ke bill par nahi.
--     Kaam hum ne ye kiya ke kisan aur uthane wale ko milaya -- to
--     mehnat ka barabar wohi saude ka size hai. Kattai ka bill us saude
--     se koi taalluq nahi rakhta: das lakh ki fasal par bhi kattai ka
--     bill utna hi hota hai jitna do lakh ki fasal par.
--
-- (c) KISAN KA KHATA SAAF, UTHANE WALE KE ZIMME. Jab uthane wala fasal
--     utha leta hai, wo baqi us ke zimme chala jata hai. Kisan se dobara
--     nahi maanga jata -- warna ek hi raqam do jagah khari rehti hai aur
--     kabhi dono se maang li jati hai.
--
-- YE RAASTA PEHLE SE MAUJOOD HAI, NAYA NAHI: `vendor_collected` bilkul
-- yehi kaam karta hai (kisan ne vendor ko diya, ab vendor hamein dega).
-- Uthane wale ka raasta usi ki nakal par bana hai, taake hisaab ka tareeqa
-- do na hon.

-- ---------------------------------------------------------------- 1
-- Do naye khate
-- ---------------------------------------------------------------- 
-- Uthane wale se lena apna khata maangta hai. Farmer (1150) ya dealer
-- (1160) mein daalna wohi purani ghalti hoti: teen alag logon ka lena
-- ek adad mein mil jata aur kisi se poochha na ja sakta ke tumhare
-- zimme kitna hai.
--
-- Aur commission ki aamdani machinery ki aamdani (4030) se alag hai.
-- Ek hi khate mein rakhne se P&L ye kabhi nahi bata sakta ke machine
-- se kitna kamaya aur fasal milane se kitna -- jabke ye do bilkul alag
-- karobar hain aur alag alag chalte hain.
insert into gl_accounts (code, name, account_type, normal_side, sort_order) values
('1170', 'Fasal uthane wale se lena', 'asset',  'debit',  47),
('4040', 'Fasal ka commission',       'income', 'credit', 404)
on conflict (code) do update set
  name = excluded.name, account_type = excluded.account_type,
  normal_side = excluded.normal_side, sort_order = excluded.sort_order;

-- ---------------------------------------------------------------- 2
-- Uthane walon ki fehrist
-- ---------------------------------------------------------------- 
create table if not exists crop_lifters (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  contact_person text,
  phone text not null,
  cnic text,
  village text,
  address text,

  -- Commission ka rate BANDE par rehta hai, booking par nahi.
  --
  -- Wohi usool jo machinery ke commission ka hai (migration 120): rate
  -- ek jagah se aata hai. Har booking par alag likhne ka darwaza khula
  -- rakhte to ek hi bande ke do saudon par do rate ho jate, aur mahine
  -- baad koi na bata pata ke kaun sa theek tha.
  --
  -- Phir bhi booking par us ka AKS rakha jata hai (neeche) -- kyunke
  -- rate kal badal sakta hai, aur purana sauda us purane rate par hi
  -- hua tha.
  commission_rate numeric(5,2) not null default 0
    check (commission_rate >= 0 and commission_rate <= 100),

  is_active boolean not null default true,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

comment on table crop_lifters is
  'Fasal uthane wale (arhti/beopari). Suppliers se alag: in ke khate mein "us ne dena" hota hai, suppliers ke khate mein "hum ne dena".';
comment on column crop_lifters.commission_rate is
  'Fasal ki QEEMAT ka fisad -- kattai ke bill ka nahi. Booking par is ka aks rakha jata hai.';

-- Ek phone ek uthane wala -- wohi qanoon jo kisan (124) aur vendor (181)
-- par lagta hai. Do ek jaise record ban jayen to un ke khate alag alag
-- chalte hain aur dono adhoore hote hain.
create unique index if not exists ux_crop_lifters_phone
  on crop_lifters (regexp_replace(phone, '\D', '', 'g'))
  where is_active;

-- ---------------------------------------------------------------- 3
-- Booking par tag
-- ---------------------------------------------------------------- 
create table if not exists booking_crop_lifts (
  id uuid primary key default uuid_generate_v4(),

  -- Ek booking par ek hi uthane wala. Do ho jayen to ye sawal paida
  -- hota hai ke kattai ka baqi kis ke zimme gaya -- aur us ka koi jawab
  -- nahi hota.
  booking_id uuid not null unique references machinery_bookings(id) on delete cascade,
  lifter_id  uuid not null references crop_lifters(id) on delete restrict,

  status text not null default 'tagged'
    check (status in ('tagged', 'lifted', 'cancelled')),

  -- Tag ke waqt ka rate -- aks. Bande ka rate kal badle to purana sauda
  -- us purane rate par hi khara rehta hai.
  commission_rate numeric(5,2) not null,

  -- Uthane ke waqt bharte hain. Tag ke waqt ye maloom hi nahi hota:
  -- na wazan hua, na rate tay hua.
  --
  -- KHALI aur SIFAR ek cheez nahi. Khali kehta hai "abhi utha hi nahi",
  -- sifar kehta hai "utha, magar qeemat sifar" -- jo jhoot hai.
  crop_value        numeric(14,2) check (crop_value is null or crop_value > 0),
  commission_amount numeric(14,2) check (commission_amount is null or commission_amount >= 0),
  lifted_at         timestamptz,
  lifted_by         uuid references profiles(id),

  -- Kattai ka baqi jo is ke zimme gaya. Ye raqam machinery_payments
  -- mein apni qatar banati hai (method = 'lifter_collected') -- yahan
  -- sirf us ka hawala rehta hai, taake ek hi raqam do jagah se na gini
  -- jaye.
  harvest_charge_moved numeric(14,2),
  moved_at             timestamptz,
  moved_by             uuid references profiles(id),

  cancelled_at   timestamptz,
  cancelled_by   uuid references profiles(id),
  cancel_reason  text,

  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),

  -- Utha hai to qeemat aur tareekh dono honi chahiyen. Ek ke baghair
  -- doosri adhoori qatar banati hai, aur adhoori qatar hisaab mein
  -- chup chaap sifar ban jati hai.
  constraint chk_lift_value_with_date
    check ((status <> 'lifted') or (crop_value is not null and lifted_at is not null))
);

create index if not exists idx_booking_crop_lifts_lifter on booking_crop_lifts(lifter_id, status);

comment on table booking_crop_lifts is
  'Kis booking ki fasal kis ne uthani hai. Tag = wada, lifted = utha chuki.';

-- ---------------------------------------------------------------- 4
-- Payment ka naya raasta: uthane wale ne liya
-- ---------------------------------------------------------------- 
-- Bilkul `vendor_collected` jaisa: paisa kisi khate mein nahi aaya, us
-- ka MALIK badla hai. Kisan ka zimma khatam, uthane wale ka shuru.
alter table machinery_payments
  add column if not exists collected_by_lifter_id uuid references crop_lifters(id);

comment on column machinery_payments.collected_by_lifter_id is
  'Kis uthane wale ke zimme gaya. Sirf method = lifter_collected par bharta hai.';

alter table machinery_payments drop constraint if exists chk_machinery_payment_method;
alter table machinery_payments add constraint chk_machinery_payment_method
  check (method = any (array['cash','bank','wallet','khata','other','vendor_collected','lifter_collected']));

-- Khata sirf un raaston par lazmi hai jahan paisa waqai kisi khate mein
-- aata hai. Uthane wale ke zimme gayi raqam kisi khate mein nahi aati --
-- wahan khata maangna hi ghalat hai (wohi wajah jo vendor_collected ki
-- hai).
alter table machinery_payments drop constraint if exists chk_machinery_payment_account;
alter table machinery_payments add constraint chk_machinery_payment_account
  check (
    (method = any (array['khata','vendor_collected','lifter_collected']))
    or verification_status <> 'verified'
    or finance_account_id is not null
    or custody_profile_id is not null
  );

-- Uthane wale ka naam sirf usi raaste par -- warna cash wali qatar par
-- bhi kisi ka naam laga rehta aur khata us ko bhi ginta.
alter table machinery_payments drop constraint if exists chk_machinery_payment_lifter;
alter table machinery_payments add constraint chk_machinery_payment_lifter
  check ((method = 'lifter_collected') = (collected_by_lifter_id is not null));

-- ---------------------------------------------------------------- 5
-- Uthane wale ki adaigi
-- ---------------------------------------------------------------- 
create table if not exists crop_lifter_payments (
  id uuid primary key default uuid_generate_v4(),
  lifter_id uuid not null references crop_lifters(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  payment_date date not null default current_date,
  method text not null default 'cash'
    check (method in ('cash','bank','wallet','other')),
  finance_account_id uuid references finance_accounts(id),
  reference text,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),

  -- Bank/wallet ka paisa kisi khate mein aata hai -- us ka naam likhna
  -- lazmi hai. Cash lene wale ke haath mein hota hai (migration 171 ka
  -- wohi faisla), is liye wahan khata nahi maanga jata.
  constraint chk_lifter_payment_account
    check (method = any (array['cash','other']) or finance_account_id is not null)
);

create index if not exists idx_crop_lifter_payments on crop_lifter_payments(lifter_id, payment_date);

-- ---------------------------------------------------------------- 6
-- Uthane wale ka khata
-- ---------------------------------------------------------------- 
-- Teen adad, teen alag sabab -- aur jaan boojh kar alag alag rakhe gaye
-- hain. "Kul baqi" ek hi adad ho to us se ye kabhi nahi poochha ja sakta
-- ke ye kattai ka hai ya commission ka, aur kis par baat karni hai.
create or replace view v_crop_lifter_balances as
select
  l.id                                          as lifter_id,
  l.name,
  l.phone,
  l.village,
  l.commission_rate,
  l.is_active,
  coalesce(h.kattai_ka_zimma, 0)                as kattai_ka_zimma,
  coalesce(c.commission_bana, 0)                as commission_bana,
  coalesce(p.diya, 0)                           as diya,
  coalesce(h.kattai_ka_zimma, 0)
    + coalesce(c.commission_bana, 0)
    - coalesce(p.diya, 0)                       as baqi,
  coalesce(c.uthai_hui_bookings, 0)             as uthai_hui_bookings
from crop_lifters l
left join lateral (
  -- Kattai ka wo hissa jo is ke zimme gaya. Sirf tasdeeq shuda -- wohi
  -- qaida jo kisan ke khate ka hai: bina tasdeeq wali qatar hisaab
  -- badalti nahi, sirf nazar aati hai.
  select sum(mp.amount) as kattai_ka_zimma
    from machinery_payments mp
   where mp.collected_by_lifter_id = l.id
     and mp.method = 'lifter_collected'
     and mp.verification_status = 'verified'
) h on true
left join lateral (
  select sum(bcl.commission_amount) as commission_bana,
         count(*)                   as uthai_hui_bookings
    from booking_crop_lifts bcl
   where bcl.lifter_id = l.id
     and bcl.status = 'lifted'
) c on true
left join lateral (
  select sum(clp.amount) as diya
    from crop_lifter_payments clp
   where clp.lifter_id = l.id
) p on true;

-- ---------------------------------------------------------------- 7
-- Pehra
-- ---------------------------------------------------------------- 
-- Ye teenon karobari maloomat hain -- staff ke ilawa koi nahi dekhta.
-- Kisan ko ye nazar aana bhi nahi chahiye: us ke saamne wo rate aa jata
-- jo hum uthane wale se lete hain.
alter table crop_lifters        enable row level security;
alter table booking_crop_lifts  enable row level security;
alter table crop_lifter_payments enable row level security;

drop policy if exists p_crop_lifters_staff on crop_lifters;
create policy p_crop_lifters_staff on crop_lifters
  for all using (fn_is_any_staff()) with check (fn_is_any_staff());

drop policy if exists p_booking_crop_lifts_staff on booking_crop_lifts;
create policy p_booking_crop_lifts_staff on booking_crop_lifts
  for all using (fn_is_any_staff()) with check (fn_is_any_staff());

drop policy if exists p_crop_lifter_payments_staff on crop_lifter_payments;
create policy p_crop_lifter_payments_staff on crop_lifter_payments
  for all using (fn_is_any_staff()) with check (fn_is_any_staff());

grant select on v_crop_lifter_balances to authenticated;
