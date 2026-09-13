-- 159: Ek machine, ek din, pandrah acre
--
-- Ab tak ek hi machine ko ek hi din par jitni marzi bookings di ja
-- sakti thin. Kaghaz par sab theek lagta tha; maidan mein machine teen
-- khaiton mein se ek par pohanchti thi aur baqi do kisan din bhar
-- intezar karte the. Un se koi ye nahi keh sakta tha ke "aap ki bari
-- kal hai" -- kyunke kisi ko pata hi nahi tha ke us din kitna kaam pehle
-- se bandha hua hai.
--
-- Hadd 15 acre hai, magar likhi hui setting mein -- code mein nahi.
-- Machine badalti hai, fasal badalti hai, din chhota bara hota hai. Jo
-- adad kabhi badalna paRe wo hamesha aisi jagah hona chahiye jahan se
-- badla ja sake bina kisi ko bulaye.
--
-- Hadd HAR MACHINE par alag lagti hai. Do machinein hon to us din 30
-- acre ho sakte hain -- kyunke hadd machine ki taqat hai, daftar ki
-- marzi nahi.

insert into platform_settings (key, value)
values ('machinery_daily_acres_per_machine', to_jsonb(15::numeric))
on conflict (key) do nothing;

-- ---------------------------------------------------------------
-- Kis machine par kis din kitna kaam bandha hua hai
--
-- Sirf wo bookings jo abhi zinda hain: band aur mansookh bookings us
-- din ki taqat nahi ghairti.
-- ---------------------------------------------------------------
create or replace view public.v_machine_day_load as
select
  b.machine_id,
  b.preferred_date            as din,
  count(*)                    as kitni_bookings,
  sum(b.harvest_area)         as bandha_hua_raqba
from public.machinery_bookings b
where b.machine_id is not null
  and b.preferred_date is not null
  and b.status not in ('closed', 'cancelled')
group by b.machine_id, b.preferred_date;

revoke all on public.v_machine_day_load from anon;
grant select on public.v_machine_day_load to authenticated, service_role;

comment on view public.v_machine_day_load is
  'Har machine ka har din: kitni bookings aur kitna raqba bandha hua hai.';

-- ---------------------------------------------------------------
-- Guard: hadd se zyada nahi
--
-- Ye rok us par hai JO likha ja raha hai -- chahe booking banate waqt
-- machine di jaye, ya baad mein tareekh badli jaye, ya machine badli
-- jaye. Teenon ek hi sawal hain: "us machine par us din kitna ho
-- sakta hai?"
-- ---------------------------------------------------------------
create or replace function public.fn_guard_machine_day_capacity()
returns trigger
language plpgsql
as $$
declare
  v_cap numeric;
  v_used numeric;
  v_new numeric;
begin
  if new.machine_id is null or new.preferred_date is null then
    return new;
  end if;
  if new.status in ('closed', 'cancelled') then
    return new;
  end if;

  -- harvest_area ek generated column hai, aur generated columns BEFORE
  -- trigger ke BAAD bharte hain -- yani yahan wo hamesha khali hota
  -- hai. Jo adad guard ko chahiye wo wohi hai jo ABHI likha ja raha
  -- hai: acre aur kanal.
  v_new := coalesce(new.harvest_area_acres, 0) + coalesce(new.harvest_area_kanal, 0) / 8;
  if v_new <= 0 then
    return new;
  end if;

  select coalesce((value #>> '{}')::numeric, 15) into v_cap
    from platform_settings where key = 'machinery_daily_acres_per_machine';
  v_cap := coalesce(v_cap, 15);

  -- Apne aap ko nahi ginta: tareekh badalte waqt purani qatar bhi
  -- isi mein hoti hai, aur wo apni hi rah mein khari ho jati.
  select coalesce(sum(b.harvest_area), 0) into v_used
    from public.machinery_bookings b
   where b.machine_id = new.machine_id
     and b.preferred_date = new.preferred_date
     and b.status not in ('closed', 'cancelled')
     and b.id <> new.id;

  if v_used + v_new > v_cap + 0.001 then
    raise exception
      'Is machine par % ko pehle se % acre bandhe hue hain. Ek din ki hadd % acre hai, is liye % acre aur nahi aa sakte. Doosri tareekh chunein ya doosri machine.',
      new.preferred_date, round(v_used, 2), v_cap, round(v_new, 2);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_machine_day_capacity on public.machinery_bookings;
create trigger trg_guard_machine_day_capacity
  before insert or update on public.machinery_bookings
  for each row execute function public.fn_guard_machine_day_capacity();

-- ---------------------------------------------------------------
-- Agli khali tareekh dhoondhne wala
--
-- Staff ko ye nahi kehna chahiye ke "jagah nahi hai, khud dhoondho".
-- Jo system jaanta hai wo bata bhi de.
-- ---------------------------------------------------------------
create or replace function public.fn_next_free_date(
  p_machine_id uuid,
  p_acres numeric,
  p_from date default current_date
)
returns date
language plpgsql
stable
as $$
declare
  v_cap numeric;
  v_day date;
  v_used numeric;
begin
  select coalesce((value #>> '{}')::numeric, 15) into v_cap
    from platform_settings where key = 'machinery_daily_acres_per_machine';
  v_cap := coalesce(v_cap, 15);

  -- Ek acre bhi hadd se bara ho to koi din khali nahi milega. Aisi
  -- soorat mein null dena sach hai; kisi din ka naam de dena jhoot.
  if coalesce(p_acres, 0) > v_cap then
    return null;
  end if;

  -- Saath hafte tak dekha jata hai. Us se aage ka jawab waise bhi kaam
  -- ka nahi -- fasal itna intezar nahi karti.
  for i in 0..48 loop
    v_day := p_from + i;
    select coalesce(sum(b.harvest_area), 0) into v_used
      from public.machinery_bookings b
     where b.machine_id = p_machine_id
       and b.preferred_date = v_day
       and b.status not in ('closed', 'cancelled');
    if v_used + coalesce(p_acres, 0) <= v_cap + 0.001 then
      return v_day;
    end if;
  end loop;

  return null;
end;
$$;

comment on function public.fn_next_free_date is
  'Is machine par itne acre ke liye agli khali tareekh. Null ka matlab: saat hafton mein jagah nahi, ya raqba khud hadd se bara hai.';
