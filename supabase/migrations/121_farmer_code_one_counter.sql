-- =====================================================================
-- AgriBridge — Migration 121: Farmer code ka silsila, ek hi jagah
-- =====================================================================
-- Kisan chaar jagah se ban'ta hai (admin ka safha, public registration,
-- Google/Facebook login, aur ab machinery booking ka quick registration)
-- -- aur code teen alag tareeqon se ban raha tha:
--
--   admin-farmers.ts      count(*) + 1
--   registration.ts       sab se bare code + 1
--   machinery booking     sab se bare code + 1
--
-- count(*) wala tareeqa us din tootta hai jis din ek kisan bhi hataya
-- jaye: ginti ek kam ho jati hai aur agla code kisi purane se takra jata
-- hai -- yani kisan ban hi nahi pata. Aur teen tareeqe chalte rehne ka
-- matlab hai ke do log ek hi lamhe mein kisan banayen to dono ko ek hi
-- number milta hai.
--
-- Ab ye kaam database karta hai. Koi bhi jagah kisan banaye, code wahin
-- se milta hai -- aur silsila kabhi nahi tootta.
-- =====================================================================

create table if not exists farmer_code_counters (
  id boolean primary key default true,
  last_number integer not null default 0,
  constraint chk_farmer_counter_single check (id)
);

-- Counter maujooda sab se bare code se shuru hota hai, sifar se nahi --
-- warna pehla hi naya kisan FRM-000001 maang leta aur us se takra jata.
insert into farmer_code_counters (id, last_number)
values (true, coalesce((
  select max(nullif(regexp_replace(farmer_code, '\D', '', 'g'), '')::integer)
  from farmers where farmer_code like 'FRM-%'
), 0))
on conflict (id) do nothing;

/*
 * Agla farmer code.
 *
 * `update ... returning` qatar ko taala laga deta hai, is liye do log ek
 * hi lamhe mein bulayen to bhi dono ko alag number milta hai -- ek
 * intezar karta hai. Ginti (count) ke sath ye mumkin nahi tha: dono ek
 * hi ginti parhte aur ek hi number banate.
 */
create or replace function fn_next_farmer_code()
returns text
language plpgsql
as $$
declare
  v_next integer;
begin
  update farmer_code_counters
     set last_number = last_number + 1
   where id
  returning last_number into v_next;

  if v_next is null then
    insert into farmer_code_counters (id, last_number) values (true, 1)
    returning last_number into v_next;
  end if;

  return 'FRM-' || lpad(v_next::text, 6, '0');
end;
$$;

/*
 * Code khali chhoR dein, database khud bhar dega.
 *
 * Trigger BEFORE INSERT hai, is liye NOT NULL ki jaanch se pehle chalta
 * hai -- code bhejna ab kisi ke liye zaroori nahi raha.
 *
 * Koi apna code bhej de to wo waisa hi rehta hai (purana data laate waqt
 * ye zaroori hota hai), magar us soorat mein counter ko bhi aage kar
 * diya jata hai -- warna wo code baad mein dobara ban kar takra jata.
 */
create or replace function fn_fill_farmer_code()
returns trigger
language plpgsql
as $$
declare
  v_given integer;
begin
  if new.farmer_code is null or btrim(new.farmer_code) = '' then
    new.farmer_code := fn_next_farmer_code();
    return new;
  end if;

  v_given := nullif(regexp_replace(new.farmer_code, '\D', '', 'g'), '')::integer;
  if v_given is not null then
    update farmer_code_counters set last_number = v_given
      where id and last_number < v_given;
  end if;

  return new;
end;
$$;

-- Khali default is liye ke code bhejna ab kisi ke liye zaroori na rahe.
-- Postgres pehle ye khali qeemat rakhta hai, phir upar wala trigger us
-- ki jagah asal code bhar deta hai. Is ke baghair har jagah ko farmer_code
-- bhejna hi parta -- aur wahin se teen alag tareeqe paida hue the.
alter table farmers alter column farmer_code set default '';

drop trigger if exists trg_fill_farmer_code on farmers;
create trigger trg_fill_farmer_code
  before insert on farmers
  for each row execute function fn_fill_farmer_code();

alter table farmer_code_counters enable row level security;

drop policy if exists farmer_code_counters_read on farmer_code_counters;
create policy farmer_code_counters_read on farmer_code_counters for select
  using (fn_is_any_staff());

comment on table farmer_code_counters is
  'Farmer code ka silsila. Code kabhi haath se na banayein -- farmers mein farmer_code khali chhoR dein, trigger bhar dega.';
