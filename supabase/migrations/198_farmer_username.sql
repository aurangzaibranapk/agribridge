-- =====================================================================
-- 198  Kisan ki apni User ID (marzi se)
-- =====================================================================
--
-- OTP se login ho jata hai (197), magar har dafa code ka intezar karna
-- us bande ke liye bojh hai jo roz portal kholta hai. Malik ka faisla:
-- kisan CHAHE to apni User ID aur password bana le, aur aage se sirf
-- wohi likh kar andar aa jaye. Na chahe to koi zabardasti nahi -- OTP
-- apni jagah chalta rahega.
--
-- SAB SE AHEM SHART: User ID kabhi duplicate na ho.
--
-- Aur "duplicate" ka matlab sirf harf-ba-harf ek jaisa nahi. Aaj
-- "Aurangzeb" bane, kal koi "aurangzeb" ya "AURANGZEB" bana le -- ye
-- teen alag qatarein hoti hain magar bande ke liye ek hi naam hai, aur
-- login ke waqt wo yaad nahi rakhta ke us ne bare harf likhe the ya
-- chhote. Is liye rok lower() par lagti hai: ek hi naam, chahe kisi
-- bhi andaz mein likha jaye.
--
-- Rok DATABASE mein hai, safhe par nahi. Safha "ye naam mil sakta hai"
-- keh kar bhi ghalat ho sakta hai -- do log ek hi lamhe mein wohi naam
-- maang lein to dono ko haan mil jayegi. Aakhri faisla yahin hota hai.

alter table public.farmers
  add column if not exists username text;

comment on column public.farmers.username is
  'Kisan ki apni User ID -- marzi se banti hai, aur poore nizam mein ek hi dafa (198).';

-- ---------------------------------------------------------------------
-- Shakl: kya likha ja sakta hai
-- ---------------------------------------------------------------------
-- Chhote harf, hindse, nuqta aur underscore. Shuru harf se, taake ye
-- kabhi kisi adad ya code se na uljhe. Chaar se bees tak: chhota naam
-- andaza lagane ke liye bulata hai, bara naam kisi ko yaad nahi rehta.
alter table public.farmers drop constraint if exists chk_farmer_username_shakl;
alter table public.farmers
  add constraint chk_farmer_username_shakl
  check (username is null or username ~ '^[a-z][a-z0-9._]{3,19}$');

-- ---------------------------------------------------------------------
-- Ek naam, ek hi banda
-- ---------------------------------------------------------------------
create unique index if not exists farmers_username_uniq
  on public.farmers (lower(username))
  where username is not null and is_deleted = false;

-- ---------------------------------------------------------------------
-- Kuch naam kisi ko nahi milte
-- ---------------------------------------------------------------------
-- Ye naam idare ke hain. Inhen kisi kisan ko de dena us ko wo darja de
-- deta hai jo us ka nahi -- aur us ki qeemat kisi din koi aur bharta
-- hai. Fehrist yahan rakhi gayi hai, code mein nahi, taake safha aur
-- database dono ek hi jawab dein.
create table if not exists public.reserved_usernames (
  name text primary key
);

insert into public.reserved_usernames (name) values
  ('admin'), ('administrator'), ('owner'), ('malik'), ('support'),
  ('help'), ('info'), ('office'), ('daftar'), ('staff'), ('manager'),
  ('alrana'), ('alranatraders'), ('agribridge'), ('art'), ('artagribridge'),
  ('system'), ('root'), ('test'), ('null'), ('undefined'), ('kisan'), ('farmer')
on conflict (name) do nothing;

alter table public.reserved_usernames enable row level security;

-- Fehrist sab parh sakte hain -- us mein chhupane ki koi baat nahi, aur
-- safhe ko "ye naam nahi mil sakta" foran batana hota hai.
drop policy if exists reserved_usernames_read on public.reserved_usernames;
create policy reserved_usernames_read on public.reserved_usernames
  for select using (true);

-- ---------------------------------------------------------------------
-- Naam rakhne ka wahid raasta
-- ---------------------------------------------------------------------
-- Kisan apni hi qatar badal sakta hai, magar sirf is function se --
-- aur ye teen baatein ek hi lamhe mein dekhta hai: shakl theek hai,
-- naam idare ka nahi hai, aur pehle se kisi aur ka nahi hai.
--
-- Naam EK DAFA banta hai. Badalne ki ijazat dena ye darwaza kholta hai
-- ke koi naam chhoR kar doosre ka naam pakaR le, aur jis ka naam tha
-- us ke purane kaghazon par likha hua naam ab kisi aur ka ho. Badalna
-- ho to daftar se -- wahan bande ka saamna hota hai.
create or replace function public.fn_set_farmer_username(p_username text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_farmer  record;
  v_saaf    text;
begin
  v_saaf := lower(btrim(coalesce(p_username, '')));

  select id, username into v_farmer
    from public.farmers
   where user_id = auth.uid() and is_deleted = false
   limit 1;

  if v_farmer.id is null then
    return 'koi_kisan_nahi';
  end if;
  if v_farmer.username is not null then
    return 'pehle_se_bana';
  end if;
  if v_saaf !~ '^[a-z][a-z0-9._]{3,19}$' then
    return 'shakl_ghalat';
  end if;
  if exists (select 1 from public.reserved_usernames r where r.name = v_saaf) then
    return 'mahfooz_naam';
  end if;

  begin
    update public.farmers set username = v_saaf where id = v_farmer.id;
  exception when unique_violation then
    -- Do log ek hi lamhe mein wohi naam maang lein to safhe ki "mil
    -- sakta hai" wali haan dono ko mil chuki hoti hai. Asal faisla
    -- yahin hota hai, aur doosre ko yahin rok diya jata hai.
    return 'kisi_aur_ka';
  end;

  return 'ok';
end;
$$;

comment on function public.fn_set_farmer_username(text) is
  'Kisan apni User ID rakhta hai -- shakl, mahfooz naam aur duplicate, teenon ek hi lamhe mein (198).';

grant execute on function public.fn_set_farmer_username(text) to authenticated;
