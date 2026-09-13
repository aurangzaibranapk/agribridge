-- =====================================================================
-- AgriBridge — Migration 345: Dukan ka code khud bane, 01 se
-- =====================================================================
-- Malik (6 September), "New Shop" ka form bharte hue: *"01 se code khud
-- generate hona chahiye."*
--
-- Pehle wo khana khali chhora ja sakta tha, ya banda apni marzi ka kuch
-- likh deta tha ("MB-KAR", "KKM001"). Nateeja Live par saamne hai: teen
-- dukanein, teen alag tarah ke code.
--
-- =====================================================================
-- GINTI COUNT(*) SE NAHI
-- =====================================================================
--
-- Wohi usool jo 121 mein kisan ke code par laga tha. `count(*) + 1`
-- us din tootta hai jis din ek dukan bhi mitayi jaye: ginti ek kam ho
-- jati hai aur agla code kisi purane se takra jata hai.
--
-- Is liye ginti ka apna khana hai jo sirf BARHTA hai -- kabhi peeche
-- nahi jata.
-- =====================================================================

create table if not exists public.shop_code_counters (
  id          boolean primary key default true,
  last_number integer not null default 0,
  constraint shop_code_counters_ek_hi_qatar check (id)
);

-- ---------------------------------------------------------------------
-- Purani dukanein bhi isi tarteeb par -- 01, 02, 03...
-- ---------------------------------------------------------------------
-- Malik ne "01 se" kaha, aur Live par abhi teen alag tarah ke code hain
-- ("MB-KAR", "MB-AGR", "KKM001"). Naye code un ke sath rakhne se fehrist
-- aadhi ek tarah ki aur aadhi doosri rehti.
--
-- Code sirf ek LIKHAI hai -- us par koi rishta (foreign key) nahi, na
-- koi hisaab. Is liye purani dukanon ko banne ki tarteeb se dobara
-- number dena mehfooz hai aur fehrist saaf kar deta hai.
with tarteeb as (
  select id, row_number() over (order by created_at, name) as n
    from public.shops
)
update public.shops s
   set code = lpad(tarteeb.n::text, 2, '0')
  from tarteeb
 where tarteeb.id = s.id;

-- Ginti wahin se aage chalti hai jahan ye chhoRi.
-- Upar wali qatar ne dukanon ko theek 1..N number diye hain, is liye
-- ginti bhi wahi N hai. `greatest` yahan jaan boojh kar NAHI: agar ye
-- migration dobara chale to renumber bhi dobara hota hai, aur ginti ko
-- us se aage rakhna do adad ke beech khali jagah chhoR deta.
insert into public.shop_code_counters (id, last_number)
select true, coalesce(count(*), 0) from public.shops
on conflict (id) do update set last_number = (select count(*) from public.shops);


create or replace function public.fn_next_shop_code()
returns text
language plpgsql
as $$
declare
  v_next integer;
begin
  update public.shop_code_counters
     set last_number = last_number + 1
   where id
  returning last_number into v_next;

  if v_next is null then
    insert into public.shop_code_counters (id, last_number) values (true, 1)
    on conflict (id) do update set last_number = shop_code_counters.last_number + 1
    returning last_number into v_next;
  end if;

  -- Do hindse: 01, 02 ... 99, phir 100. Malik ne "01 se" kaha, is liye
  -- shuruat mein sifar lagta hai.
  return lpad(v_next::text, 2, '0');
end;
$$;

comment on function public.fn_next_shop_code() is
  'Dukan ka agla code -- 01 se, apni ginti se. count(*) se nahi: wo dukan mitne par purane code se takra jata hai (345).';


create or replace function public.fn_shop_code_bharein()
returns trigger
language plpgsql
as $$
begin
  -- Khana khali ho to khud bhar do. Jo banda apna code likhna chahe, wo
  -- likh sakta hai -- ye rok nahi, sahara hai.
  if new.code is null or btrim(new.code) = '' then
    new.code := public.fn_next_shop_code();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_shop_code on public.shops;
create trigger trg_shop_code
  before insert on public.shops
  for each row execute function public.fn_shop_code_bharein();
