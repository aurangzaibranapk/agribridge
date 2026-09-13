-- =====================================================================
-- 381: Farmer User ID — naam aur email bhi chal sakein
-- =====================================================================
-- Malik ka hukm (9 September): User ID mein sirf chhota, sakht-shakal
-- wala naam nahi -- kisan apna PURA NAAM (space ke sath) ya apna EMAIL
-- bhi User ID bana sake.
--
-- 198 ka regex is liye tang tha ke chhota, aasani se yaad rehne wala
-- naam chaha gaya tha (comment: "chhota naam yaad rehta hai, bara naam
-- kisi ko yaad nahi rehta"). Ab malik ka faisla is se aage hai -- kisan
-- ko zyada azaadi chahiye. Purana rok hatakar naya, khula rakha gaya
-- hai: harf/hindse/nuqta/underscore/@ /khali jagah/hyphen, 4 se 50 tak.
--
-- Purane, chhote username (198 ke tareeqe se bane) is naye, zyada khule
-- regex mein bhi fit hote hain -- kisi ka username tootega nahi.
-- =====================================================================

alter table public.farmers drop constraint if exists chk_farmer_username_shakl;
alter table public.farmers
  add constraint chk_farmer_username_shakl
  check (username is null or username ~ '^[a-z0-9][a-z0-9._@ -]{3,49}$');

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
  if v_saaf !~ '^[a-z0-9][a-z0-9._@ -]{3,49}$' then
    return 'shakl_ghalat';
  end if;
  if exists (select 1 from public.reserved_usernames r where r.name = v_saaf) then
    return 'mahfooz_naam';
  end if;

  begin
    update public.farmers set username = v_saaf where id = v_farmer.id;
  exception when unique_violation then
    return 'kisi_aur_ka';
  end;

  return 'ok';
end;
$$;

comment on function public.fn_set_farmer_username(text) is
  'Kisan apni User ID rakhta hai -- shakl, mahfooz naam aur duplicate, teenon ek hi lamhe mein (198, 381: naam/email ki ijazat).';
