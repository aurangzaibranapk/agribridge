-- =====================================================================
-- AgriBridge — Migration 122: Farmer code counter ka haq theek karna
-- =====================================================================
-- 121 mein counter to ban gaya, magar us par sirf PARHNE ki ijazat di
-- gayi thi. Trigger us bande ke apne haq se chalta hai jo kisan bana raha
-- hota hai, aur us bande ko counter BARHANE ka haq tha hi nahi:
--
--   permission denied for table farmer_code_counters
--
-- Seedha hal ye lagta hai ke sab ko counter par likhne ka haq de diya
-- jaye. Wo galat hoga: phir koi bhi counter ko haath laga sakta hai, aur
-- counter peeche kar dene ka matlab hai agla code kisi purane se takra
-- jana -- yani wohi kharabi jis se bachne ke liye ye counter banaya tha.
--
-- Is liye ulta kiya gaya hai: counter par kisi ka bhi seedha haq nahi.
-- Sirf ek function (security definer) us ko chhoo sakta hai, aur wo
-- function sirf agla number deta hai -- kuch aur nahi.
-- =====================================================================

create or replace function fn_next_farmer_code()
returns text
language plpgsql
security definer
set search_path to 'public'
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

-- Apna code bhejne wali soorat (purana data laate waqt) bhi counter ko
-- aage karti hai -- wo bhi isi darwaze se guzre.
create or replace function fn_bump_farmer_code_counter(p_number integer)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  update farmer_code_counters set last_number = p_number
    where id and last_number < p_number;
end;
$$;

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
    perform fn_bump_farmer_code_counter(v_given);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_fill_farmer_code on farmers;
create trigger trg_fill_farmer_code
  before insert on farmers
  for each row execute function fn_fill_farmer_code();

-- Counter tak koi seedha nahi pahunch sakta -- na parh sakta hai, na
-- likh sakta hai. Wo kisi report ka hissa nahi, sirf andar ka purza hai.
drop policy if exists farmer_code_counters_read on farmer_code_counters;
revoke all on table farmer_code_counters from anon, authenticated;

grant execute on function fn_next_farmer_code() to anon, authenticated, service_role;
grant execute on function fn_bump_farmer_code_counter(integer) to anon, authenticated, service_role;
