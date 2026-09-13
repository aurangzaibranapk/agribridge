-- =====================================================================
-- AgriBridge — Migration 341: Membership ka darja, aur udhaar ka taala
-- =====================================================================
-- Malik (6 September):
--
--   *"Farmers ki jagah staff ko Farmers/Membership aana chahiye, jis se
--   ye sirf member add kar sakein — us ki maloomat le kar us ko member
--   bana dein. Agar koi udhaar hai to us ke liye pehle MUKAMMAL PROCESS
--   hoga, account FULLY ACTIVE hoga. Har cheez add karenge, CNIC ki copy
--   le kar, saari details ke sath — jaisa ke wo farmer khud kar sakta
--   hai apni profile."*
--
-- =====================================================================
-- MASLA
-- =====================================================================
--
-- Staff ke paas jo "Add Farmer" ka khana tha wo PAANCH khane maangta
-- tha: naam, mobile, CNIC ka number, gaon, zila. Na CNIC ki copy, na
-- bank, na zameen. Yani daftar mein bana hua member hamesha adhoora
-- rehta tha, jab ke wohi kisan apne portal par poori profile bhar sakta
-- hai.
--
-- Aur udhaar par koi rok nahi thi. `credit_status` ka khana maujood tha
-- magar us ko kisi cheez se bandha hua nahi tha -- yani adhoori profile
-- wale bande par bhi udhaar khul sakta tha. Udhaar wo jagah hai jahan
-- adhoori maloomat sab se mehngi parti hai: paisa gaya, aur wapas
-- maangne ke liye na poora pata hai na CNIC ki copy.
--
-- =====================================================================
-- KYA HO RAHA HAI
-- =====================================================================
--
-- 1. **Mukammal hone ka matlab EK jagah likha ja raha hai**, database
--    mein -- taake safha, report aur AI teenon ek hi jawab dein. Abhi ye
--    sirf TypeScript mein tha (`computeProfileCompletion`), aur database
--    ko us ki khabar hi nahi thi.
--
-- 2. **`is_profile_complete` ab HAATH SE nahi likha jata** -- wo usi
--    hisaab se khud nikalta hai. Wohi usool jo stock, cash book aur
--    supplier ke dene par laga hua hai (127, 129, 139): ek adad, ek
--    malik.
--
-- 3. **Udhaar ka taala.** `credit_status = 'approved'` ya koi
--    `credit_limit` tab tak nahi lag sakti jab tak member mukammal,
--    tasdeeq shuda aur fa'aal na ho.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) Mukammal hone ka matlab -- paanch hissay, wohi jo portal par hain
-- ---------------------------------------------------------------------
create or replace function public.fn_farmer_profile_complete(f public.farmers)
returns boolean
language sql
immutable
as $$
  select
    -- Pehchan. Walid ka naam is liye ke gaon mein ek hi naam ke kai log
    -- hote hain.
    nullif(btrim(coalesce(f.full_name, '')), '')    is not null
    and nullif(btrim(coalesce(f.father_name, '')), '')  is not null
    and nullif(btrim(coalesce(f.cnic, '')), '')         is not null
    and nullif(btrim(coalesce(f.phone_number, '')), '') is not null
    -- Pata
    and nullif(btrim(coalesce(f.village, '')), '')  is not null
    and nullif(btrim(coalesce(f.tehsil, '')), '')   is not null
    and nullif(btrim(coalesce(f.district, '')), '') is not null
    and nullif(btrim(coalesce(f.address, '')), '')  is not null
    -- Zameen aur fasal
    and f.land_size_acres is not null
    and coalesce(array_length(f.crop_types, 1), 0) > 0
    -- Adaigi ka raasta: bank YA mobile wallet -- koi ek.
    -- Bank ko lazmi karna ghalat hoga: bohot se kisanon ke paas khata hai
    -- hi nahi, aur unhein rok dene ka matlab ye ke un ka paisa hamare
    -- paas para rehta hai.
    and (nullif(btrim(coalesce(f.bank_account_number, '')), '') is not null
         or nullif(btrim(coalesce(f.mobile_wallet_number, '')), '') is not null)
    -- CNIC ki DONO taraf ki copy
    and nullif(btrim(coalesce(f.cnic_image_url, '')), '')      is not null
    and nullif(btrim(coalesce(f.cnic_back_image_url, '')), '') is not null
$$;

comment on function public.fn_farmer_profile_complete(public.farmers) is
  'Member ki profile mukammal hai ya nahi -- paanch hissay: pehchan, pata, zameen, adaigi ka raasta, CNIC ki dono copy. Wohi hisaab jo portal par hai (341).';


-- ---------------------------------------------------------------------
-- 2) `is_profile_complete` khud nikalta hai, likha nahi jata
-- ---------------------------------------------------------------------
create or replace function public.fn_sync_farmer_profile_complete()
returns trigger
language plpgsql
as $$
begin
  new.is_profile_complete := public.fn_farmer_profile_complete(new);
  return new;
end;
$$;

drop trigger if exists trg_farmer_profile_complete on public.farmers;
create trigger trg_farmer_profile_complete
  before insert or update on public.farmers
  for each row execute function public.fn_sync_farmer_profile_complete();


-- ---------------------------------------------------------------------
-- 3) Udhaar ka taala
-- ---------------------------------------------------------------------
-- Teen sharten, aur teenon ki apni wajah hai:
--
--   * **Profile mukammal** -- warna paisa maangne ke liye na poora pata
--     hai na CNIC ki copy.
--   * **Tasdeeq shuda** (`is_verified`) -- yani kisi bande ne kaghaz
--     apni aankh se dekha. Naam likh dena tasdeeq nahi.
--   * **Fa'aal** (`is_active`) -- band khate par udhaar ka koi maani
--     nahi.
--
-- Rok sirf BARHNE par lagti hai. Udhaar wapas lena, rokna ya hadd kam
-- karna hamesha khula rehta hai -- warna kisi ki profile adhoori ho jane
-- par us ka chalta hua udhaar band bhi na kiya ja sakta.
create or replace function public.fn_guard_farmer_credit()
returns trigger
language plpgsql
as $$
declare
  v_barh_raha boolean;
begin
  v_barh_raha :=
    (new.credit_status = 'approved' and coalesce(old.credit_status, 'none') <> 'approved')
    or (coalesce(new.credit_limit, 0) > coalesce(old.credit_limit, 0));

  if tg_op = 'INSERT' then
    v_barh_raha := new.credit_status = 'approved' or coalesce(new.credit_limit, 0) > 0;
  end if;

  if not v_barh_raha then
    return new;
  end if;

  if not public.fn_farmer_profile_complete(new) then
    raise exception
      'Udhaar tab tak nahi khul sakta jab tak member ki poori maloomat na ho — naam, walid ka naam, CNIC, poora pata, zameen aur fasal, bank ya wallet, aur CNIC ki dono taraf ki copy.';
  end if;

  if not new.is_verified then
    raise exception
      'Udhaar se pehle member ki tasdeeq zaroori hai — kisi ne kaghaz apni aankh se dekhe hon. Naam likh dena tasdeeq nahi.';
  end if;

  if not new.is_active then
    raise exception 'Band khate par udhaar nahi khulta.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_farmer_credit on public.farmers;
create trigger trg_guard_farmer_credit
  before insert or update on public.farmers
  for each row execute function public.fn_guard_farmer_credit();

comment on function public.fn_guard_farmer_credit() is
  'Udhaar sirf mukammal, tasdeeq shuda aur fa''aal member par. Rok sirf barhne par -- rokna aur kam karna hamesha khula (341).';
