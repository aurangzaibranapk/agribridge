-- 158: Baqi kaam ki agli booking -- magar khata wohi
--
-- Maidan ki soorat: booking 15 acre ki thi, machine gayi, 7 acre kat
-- gaye aur baqi 8 abhi nahi ho sake -- fasal kachi thi, ya machine
-- kisi aur khet chali gayi, ya kisan ne kaha baad mein.
--
-- Ab tak sirf do raaste the aur dono kharab the. Ya to booking khuli
-- chhoR di jati (aur wo mahinon "kaam darj karna" ki qatar mein pari
-- rehti, jabke us par kaam ho chuka tha aur paisa bhi banta tha), ya
-- staff nayi booking haath se bana deta -- naya number, naya rate,
-- naya sab kuch, aur kisan ka ek hi kaam do jagah likha jata.
--
-- Ab kaam ko 7 acre par mukammal kar diya jata hai (bill usi ka banta
-- hai, aur usi din bana hai), aur baqi ka poochha jata hai: "8 acre ka
-- kaam karwana hai? kab?" Sirf tareekh likhne se agli booking khud ban
-- jati hai.
--
-- Kisan wohi, khet wohi, rate wohi. Ye "duplicate" nahi -- ye do alag
-- kaam hain jin ke do alag bill banenge. Duplicate wo hota jab ek hi
-- kaam do jagah likha jaye.

alter table public.machinery_bookings
  add column if not exists parent_booking_id uuid references public.machinery_bookings(id);

comment on column public.machinery_bookings.parent_booking_id is
  'Ye booking kis adhoore kaam se nikli. Kisan aur khet wohi rehte hain -- sirf baqi raqba naya hai.';

create index if not exists idx_bookings_parent on public.machinery_bookings(parent_booking_id)
  where parent_booking_id is not null;

-- ---------------------------------------------------------------
-- Guard: agli booking usi kisan ki, aur apni hi aulaad nahi
-- ---------------------------------------------------------------
create or replace function public.fn_guard_follow_up_booking()
returns trigger
language plpgsql
as $$
declare
  p record;
begin
  if new.parent_booking_id is null then
    return new;
  end if;

  if new.parent_booking_id = new.id then
    raise exception 'Booking apni hi agli kari nahi ho sakti.';
  end if;

  select farmer_id, farm_id, booking_number into p
    from public.machinery_bookings where id = new.parent_booking_id;
  if not found then
    raise exception 'Pichli booking nahi mili.';
  end if;

  -- Kisan ka na milna sab se khamosh kharabi hoti: ek kisan ka kaam
  -- doosre ke khate mein chala jata aur bill ghalat bande ka banta.
  if p.farmer_id <> new.farmer_id then
    raise exception 'Agli booking usi kisan ki honi chahiye jis ki pichli thi (%).', p.booking_number;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_follow_up_booking on public.machinery_bookings;
create trigger trg_guard_follow_up_booking
  before insert or update on public.machinery_bookings
  for each row execute function public.fn_guard_follow_up_booking();

-- ---------------------------------------------------------------
-- Adhoora kaam: kis booking par raqba bacha aur agli bani ya nahi
--
-- Ye qatar us shak ka jawab hai jo bill banne ke baad reh jata hai:
-- "15 acre ki booking thi, bill 7 ka bana -- baqi 8 ka kya hua?"
-- ---------------------------------------------------------------
create or replace view public.v_machinery_unfinished as
select
  b.id                as booking_id,
  b.booking_number,
  b.status,
  f.full_name         as farmer_name,
  f.phone_number      as farmer_phone,
  b.harvest_area      as booking_ka_raqba,
  coalesce(w.hua, 0)  as kaam_hua,
  round(coalesce(b.harvest_area, 0) - coalesce(w.hua, 0), 4) as raqba_bacha,
  (select count(*) from public.machinery_bookings c where c.parent_booking_id = b.id) as agli_bookings
from public.machinery_bookings b
left join public.farmers f on f.id = b.farmer_id
left join lateral (
  select sum(w2.actual_area) as hua
    from public.machinery_work_records w2
   where w2.booking_id = b.id
     and w2.verification_status = 'verified'
) w on true
where coalesce(w.hua, 0) > 0
  and coalesce(b.harvest_area, 0) - coalesce(w.hua, 0) > 0.01
  and fn_is_any_staff();

revoke all on public.v_machinery_unfinished from anon;
grant select on public.v_machinery_unfinished to authenticated, service_role;

comment on view public.v_machinery_unfinished is
  'Jin bookings par kaam hua magar booking ka poora raqba nahi kata -- aur agli booking bani ya nahi.';
