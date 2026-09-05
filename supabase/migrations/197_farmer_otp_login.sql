-- =====================================================================
-- 197  Kisan ka login: mobile aur OTP
-- =====================================================================
--
-- Ab tak kisan ke liye email aur password lazmi tha. Ye us kisan se
-- maanga ja raha tha jis ke paas aksar email hai hi nahi -- database
-- gawah hai: is waqt EK bhi kisan ke paas email darj nahi.
--
-- Malik ka usool: "Kisan ki pehchan Farmer ID se, lookup mobile se, aur
-- portal authentication OTP se."
--
-- Buniyad pehle se pari hui thi aur wo yahan chhui nahi ja rahi:
--   farmers.user_id pehle se KHALI reh sakta hai -- yani kisan ka
--     record login ke baghair banta hai (booking, doodh, WhatsApp se).
--   farmers.phone_key (aakhri das hindse) aur us par lagi hui unique
--     rok pehle se maujood hai -- ek mobile, ek kisan.
--   portal pehle se farmers.user_id = auth.uid() se kisan pehchanta hai.
--
-- Is migration ka kaam sirf itna hai: OTP ko mehfooz tareeqe se rakhna,
-- aur us ek jagah ko sakht karna jahan login kisan se jurta hai.

-- ---------------------------------------------------------------------
-- 1. OTP ki qatarein
-- ---------------------------------------------------------------------
-- Code KHUD nahi rakha jata -- us ka hash rakha jata hai. Wajah wohi jo
-- password ki hoti hai: agar kisi din ye qatarein kisi ke haath lag
-- jayen to un se kisi ka darwaza na khule. OTP paanch minute ka mehmaan
-- hai, magar paanch minute bhi kaafi hote hain.
create table if not exists public.farmer_login_otps (
  id          uuid primary key default gen_random_uuid(),
  phone_key   text not null,
  code_hash   text not null,
  -- Kis raaste se gaya: whatsapp, sms, ya kahin nahi gaya (null).
  -- Ye likhna zaroori hai: "OTP nahi aaya" ki shikayat par pehla sawal
  -- yehi hota hai, aur us ka jawab kisi aur jagah nahi milta.
  sent_via    text check (sent_via in ('whatsapp', 'sms')),
  send_error  text,
  attempts    integer not null default 0,
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists farmer_login_otps_lookup
  on public.farmer_login_otps (phone_key, created_at desc);

comment on table public.farmer_login_otps is
  'Kisan ke login ka OTP -- code ka hash, us ki umar aur koshishon ki ginti (197).';

-- Ye qatarein browser se kabhi nazar nahi aani chahiyen. RLS chalu hai
-- aur koi bhi ijazat wali shart nahi likhi gayi -- yani anon aur
-- authenticated dono ke liye darwaza band. Sirf service role (server)
-- in tak pahunchta hai.
alter table public.farmer_login_otps enable row level security;

-- ---------------------------------------------------------------------
-- 2. OTP ki jaanch -- ek hi lamhe mein
-- ---------------------------------------------------------------------
-- Ginti barhana aur code milana ALAG ALAG nahi ho sakte. Alag hote to
-- ek hi waqt mein das koshishein bhej kar ginti ko dhoka diya ja sakta
-- hai: sab dekhtin "abhi to ek hi koshish hui hai" aur sab guzar jatin.
-- Is liye dono kaam ek hi function ke andar, ek hi qatar par taala
-- laga kar.
--
-- Jawab jaan boojh kar chhota hai: 'ok', 'ghalat', 'khatam' (waqt guzar
-- gaya ya pehle istemal ho chuka), ya 'band' (koshishein poori ho
-- gayin). Bulane wala in mein se har ek ka apna jumla likhta hai.
create or replace function public.fn_verify_farmer_otp(p_phone_key text, p_code text)
returns text
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  r record;
begin
  select * into r
    from public.farmer_login_otps
   where phone_key = p_phone_key
     and consumed_at is null
   order by created_at desc
   limit 1
   for update;

  if r is null then
    return 'khatam';
  end if;

  if r.expires_at < now() then
    return 'khatam';
  end if;

  -- Teen koshishein. Chauthi par qatar khatam kar di jati hai, taake
  -- naya OTP mangwana pare -- andaze lagane wale ko har dafa naye sire
  -- se shuru karna pare.
  if r.attempts >= 3 then
    update public.farmer_login_otps set consumed_at = now() where id = r.id;
    return 'band';
  end if;

  if r.code_hash = extensions.crypt(p_code, r.code_hash) then
    update public.farmer_login_otps set consumed_at = now() where id = r.id;
    return 'ok';
  end if;

  update public.farmer_login_otps set attempts = r.attempts + 1 where id = r.id;
  return 'ghalat';
end;
$$;

comment on function public.fn_verify_farmer_otp(text, text) is
  'OTP milana aur koshish ginna -- ek hi lamhe mein, taake ek sath kai koshishein ginti ko dhoka na de sakein (197).';

revoke all on function public.fn_verify_farmer_otp(text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Ek login, ek kisan
-- ---------------------------------------------------------------------
-- farmers.user_id par koi rok nahi thi. Do kisan ke record ek hi login
-- par daawa kar sakte the, aur portal ".single()" se kisan uthata hai --
-- yani us din portal khulta hi nahi, bina kisi wajah ke.
create unique index if not exists farmers_user_id_uniq
  on public.farmers (user_id)
  where user_id is not null;

-- ---------------------------------------------------------------------
-- 4. OTP banana -- code sirf database ke andar hash hota hai
-- ---------------------------------------------------------------------
-- Ye function is liye hai ke server ko hash BANANA na pare. Server code
-- jaanta hai (usay bhejna jo hai), magar us code ko kisi qatar mein
-- likhne ka kaam yahin hota hai -- aur yahan wo hash ban kar hi girta
-- hai. Do qadam (pehle qatar banao, phir hash daalo) rakhte to beech
-- mein wo qatar bina hash ke khari hoti.
create or replace function public.fn_create_farmer_otp(
  p_phone_key text,
  p_code      text,
  p_minutes   integer
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  v_id uuid;
begin
  insert into public.farmer_login_otps (phone_key, code_hash, expires_at)
  values (
    p_phone_key,
    extensions.crypt(p_code, extensions.gen_salt('bf')),
    now() + make_interval(mins => p_minutes)
  )
  returning id into v_id;
  return v_id;
end;
$$;

comment on function public.fn_create_farmer_otp(text, text, integer) is
  'OTP ki qatar banata hai -- code hash ban kar hi girta hai, kabhi khula nahi (197).';

revoke all on function public.fn_create_farmer_otp(text, text, integer) from public, anon, authenticated;
