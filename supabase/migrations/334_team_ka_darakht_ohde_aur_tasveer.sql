-- =====================================================================
-- AgriBridge — Migration 334: Team ka darakht — ohde aur tasveer
-- =====================================================================
-- Malik ne 6 September ko safha khali dekh kar kaha:
--
--   *"ye tree banayein — Board of Director, phir CEO, phir Admin, phir
--   Assistant Admin, is tarah se banayein. Aur sath har file edit kar
--   sakein, aur sare staff apni image laga sakein, aur tree mein image
--   bhi aani chahiye."*
--
-- Safha khali is liye tha ke `staff_details` mein EK BHI qatar nahi
-- (19 active profiles, 0 HR records). `fn_hr_staff_directory` us table
-- par INNER JOIN karta tha -- yani jis ka HR record na ho, wo fehrist
-- mein aata hi nahi tha.
--
-- Ye teen alag kaam hain:
--
--   1) Darakht mein SAB nazar aayein -- jis ka HR record adhoora ho wo
--      bhi, saaf nishan ke sath. Chhupa dena "company mein bas itne log
--      hain" jaisa ghalat jawab deta hai.
--   2) Ohde ki ek PAKKI seerhi ho, free text nahi. "CEO", "C.E.O",
--      "Chief Executive" teen alag likhe jayen to darakht kabhi tarteeb
--      se nahi banta.
--   3) Har banda apni tasveer khud laga sake -- magar SIRF tasveer.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Ohde ki seerhi
-- ---------------------------------------------------------------------
-- `rank` chhota = ooper. Ye khana darakht ke lie NAHI hai (darakht
-- `reports_to` se banta hai) -- ye tarteeb aur fehrist ke liye hai,
-- taake ek hi afsar ke neeche wale log ohde ke hisaab se lagen, naam ke
-- alphabet se nahi.
--
-- Do cheezein alag rakhi hain aur jaan boojh kar:
--
--   `profiles.role`  -- system mein KYA KHOL SAKTA HAI (ijazat)
--   `position_key`   -- company mein KYA HAI (ohda)
--
-- Ek banda CEO ho sakta hai aur us ka system role `owner` ho; doosra
-- Assistant Admin ho aur role `manager`. Inhen ek karna ye maan lena
-- hai ke ohda barhne par ijazat khud barh jaye -- jo is nizam mein
-- kabhi nahi hona chahiye.
create table if not exists org_positions (
  key         text primary key,
  label       text not null,
  rank        int  not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

comment on table org_positions is
  'Company ke ohde -- Board of Director se neeche tak. rank chhota = ooper. Ye ijazat NAHI deta; ijazat profiles.role se aati hai (334).';

insert into org_positions (key, label, rank) values
  ('board_of_director', 'Board of Director', 10),
  ('ceo',               'CEO',               20),
  ('director',          'Director',          30),
  ('admin',             'Admin',             40),
  ('assistant_admin',   'Assistant Admin',   50),
  ('manager',           'Manager',           60),
  ('assistant_manager', 'Assistant Manager', 70),
  ('supervisor',        'Supervisor',        80),
  ('officer',           'Officer',           90),
  ('staff',             'Staff',            100)
on conflict (key) do nothing;

alter table staff_details
  add column if not exists position_key text references org_positions(key);

comment on column staff_details.position_key is
  'Company ka ohda (org_positions). Purana `designation` free text hai aur rehne diya gaya -- wo naukri ka naam hai, ye seerhi ka darja (334).';

create index if not exists idx_staff_details_position on staff_details(position_key);

-- ---------------------------------------------------------------------
-- 2) Fehrist: ab HR record na hone par bhi banda nazar aata hai
-- ---------------------------------------------------------------------
-- INNER JOIN se LEFT JOIN. Sath teen naye khane: tasveer, ohda, aur ye
-- ke HR record hai bhi ya nahi.
--
-- `hr_record` khana is liye hai ke safha "adhoora" aur "khali" mein
-- farq kar sake. Bina is ke wo har adhoore bande ko waise hi dikhata
-- jaise poore record wale ko -- aur phir kabhi pata na chalta ke kis ka
-- record bharna baqi hai.
--
-- Return type badal raha hai, is liye pehle DROP -- `create or replace`
-- yahan chalta hi nahi.
drop function if exists fn_hr_staff_directory();

create function fn_hr_staff_directory()
returns table (
  profile_id uuid,
  full_name text,
  role text,
  designation text,
  department_key text,
  department_label text,
  branch_id uuid,
  branch_name text,
  employment_type text,
  hire_date date,
  reports_to uuid,
  reports_to_name text,
  direct_reports int,
  photo_url text,
  position_key text,
  position_label text,
  position_rank int,
  hr_record boolean
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not coalesce(fn_is_any_staff(), false) then
    raise exception 'Ye fehrist sirf staff ke liye hai.';
  end if;

  return query
  select
    pr.id,
    pr.full_name,
    pr.role::text,
    sd.designation,
    sd.department_key,
    d.label,
    coalesce(sd.branch_id, pr.branch_id),
    b.name,
    sd.employment_type,
    sd.hire_date,
    sd.reports_to,
    mgr.full_name,
    (select count(*)::int from staff_details x
      where x.reports_to = pr.id and x.is_active),
    sd.photo_url,
    sd.position_key,
    op.label,
    op.rank,
    (sd.profile_id is not null)
  from profiles pr
  -- LEFT: jis ka HR record nahi, wo bhi aata hai. Pehle yahan INNER tha
  -- aur 6 September ko us ki wajah se darakht bilkul khali tha.
  left join staff_details sd on sd.profile_id = pr.id and sd.is_active
  left join org_positions op on op.key = sd.position_key
  left join departments d on d.key = sd.department_key
  left join branches b on b.id = coalesce(sd.branch_id, pr.branch_id)
  left join profiles mgr on mgr.id = sd.reports_to
  where pr.is_active
    and coalesce(fn_hr_can_view_staff(pr.id), false)
  -- Ohda pehle, phir naam. Jis ka ohda darj nahi wo neeche -- gayab
  -- nahi.
  order by coalesce(op.rank, 999), pr.full_name;
end;
$$;

comment on function fn_hr_staff_directory() is
  'Staff ki fehrist -- tankhwah ka khana yahan JAAN BOOJH KAR nahi hai (235). 334 se: HR record na hone par bhi banda aata hai (hr_record = false), aur tasveer/ohda sath aate hain.';

-- ---------------------------------------------------------------------
-- 3) Apni tasveer -- aur SIRF tasveer
-- ---------------------------------------------------------------------
-- Staff `staff_details` par UPDATE ki ijazat nahi rakhta, aur ye jaan
-- boojh kar hai: us table mein `basic_salary`, `reports_to` aur
-- `designation` bhi hain. Ek khula UPDATE policy dene ka matlab hota ke
-- banda apni tankhwah aur apna afsar khud badal le.
--
-- Is liye tasveer ke liye ek TANG darwaza: ye function sirf `photo_url`
-- ko haath lagata hai, aur sirf usi bande ka jo abhi login hai.
-- `auth.uid()` bahar se nahi bheja ja sakta, is liye kisi aur ki
-- tasveer yahan se nahi badalti.
--
-- Record na ho to ban jata hai -- warna naya mulazim apni tasveer laga
-- hi nahi sakta, aur uski shakayat HR tak pahunchne mein hafte lag jate
-- hain.
create or replace function fn_set_my_photo(p_url text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'Pehle login karein.';
  end if;
  if not coalesce(fn_is_any_staff(), false) then
    raise exception 'Ye kaam sirf staff ke liye hai.';
  end if;

  insert into staff_details (profile_id, photo_url)
  values (v_me, p_url)
  on conflict (profile_id) do update set photo_url = excluded.photo_url;

  return true;
end;
$$;

comment on function fn_set_my_photo(text) is
  'Apni tasveer lagana. SIRF photo_url, aur sirf apni -- taake staff ko poore staff_details par UPDATE na dena pare (334).';

revoke all on function fn_set_my_photo(text) from public;
grant execute on function fn_set_my_photo(text) to authenticated;

alter table org_positions enable row level security;

drop policy if exists org_positions_read on org_positions;
create policy org_positions_read on org_positions
  for select using (public.fn_is_any_staff());

drop policy if exists org_positions_write on org_positions;
create policy org_positions_write on org_positions
  for all using (public.fn_is_admin_level()) with check (public.fn_is_admin_level());

-- ---------------------------------------------------------------------
-- 4) Safhe ki madad
-- ---------------------------------------------------------------------
insert into feature_help (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
values (
  'hr.org-tree', 'rm',
  'Poori company ka dhaancha ek nazar mein: kaun kis ke ooper hai, kis ka kya ohda hai, aur kis ki shakal kya hai.',
  'HR, Admin, Malik. Manager ko sirf apni shakh nazar aati hai.',
  'Jab naya banda aaye, kisi ka afsar badle, ya ye dekhna ho ke kis ke neeche kitne log hain.',
  array[
    'Kisi bhi naam par "Badlein" dabayein -- wahin us ka khana khulta hai.',
    'Ohda chunein (Board of Director, CEO, Admin, Assistant Admin...), afsar chunein, shoba aur shakha bharein.',
    'Mehfooz karein -- darakht foran nayi jagah par bana deta hai.',
    'Tasveer har banda apne "My HR" safhe se KHUD lagata hai; wo yahan se nahi lagti.'
  ],
  'Jis ke saamne "HR record adhoora" likha ho, us ka ohda aur afsar bharein -- us se pehle wo darakht ki jaR par para rehta hai.',
  array[
    'Ohda aur system role ko ek na samjhein. Ohda company mein darja hai; role ye tay karta hai ke system mein kya khul sakta hai. CEO ka role manager bhi ho sakta hai.',
    'Kisi ko darakht se nikal dena us ka masla hal nahi karta -- wo phir bhi company mein hai. Us ka record bharein.'
  ]
)
on conflict (feature_key, lang) do update set
  purpose = excluded.purpose, who_uses = excluded.who_uses, when_use = excluded.when_use,
  how_steps = excluded.how_steps, next_step = excluded.next_step, mistakes = excluded.mistakes;
