-- =====================================================================
-- AgriBridge — Migration 134: Chhutti
-- =====================================================================
-- Ab tak chhutti ka koi nizam nahi tha. Us ka nateeja hazri ke record
-- par nikalta tha: jo banda manzoor shuda chhutti par hota, wo hazri
-- mein GHAIR HAZIR likha jata -- kyunke hazri ko us ki chhutti ka pata
-- hi nahi tha. Mahine ke aakhir mein wo ghair haziri tankhwah kaat deti,
-- aur us ka koi jawab kahin nahi hota.
--
-- ---------------------------------------------------------------------
-- Hazri aur chhutti do alag kitabein nahi
-- ---------------------------------------------------------------------
-- Sab se ahem faisla yahi hai. Chhutti ko alag jagah rakh dena aasan
-- tha, magar phir har report ko YAAD RAKHNA paRta ke chhutti bhi dekhni
-- hai -- aur ek din koi report bhoolti, aur wohi report tankhwah ka
-- hisaab bana rahi hoti.
--
-- Is liye: chhutti MANZOOR hote hi hazri mein us din ki qatar khud ban
-- jati hai, "chhutti" likh kar. Report ko kuch naya seekhna nahi paRta.
--
-- Aur us qatar par nishan lagta hai ke wo CHHUTTI se aayi hai
-- (source = 'leave'). Is liye chhutti wapas lene par sirf wohi qatarein
-- hatti hain -- asli hazri ko koi haath nahi lagata. Bina is nishan ke
-- chhutti mansookh karna kisi ki asli hazri mita sakta tha.
-- =====================================================================

alter table attendance_records drop constraint if exists attendance_records_source_check;
alter table attendance_records add constraint attendance_records_source_check
  check (source in ('web', 'whatsapp', 'leave'));

create table if not exists leave_requests (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references profiles(id) on delete cascade,
  from_date date not null,
  to_date date not null,
  -- Din database ginta hai, form nahi. Form se aaya adad us din ghalat
  -- ho jata hai jis din koi tareekh badal kar adad badalna bhool jaye.
  days integer generated always as ((to_date - from_date) + 1) stored,
  leave_type text not null default 'casual',
  reason text not null,
  status text not null default 'pending',
  decided_by uuid references profiles(id),
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),

  constraint leave_dates_sane check (to_date >= from_date),
  constraint leave_type_check check (leave_type in ('casual', 'sick', 'annual', 'unpaid')),
  constraint leave_status_check check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  -- Wajah lazmi hai. "Chhutti chahiye" likh kar guzar jane se wo record
  -- bemani ho jata hai jis ke liye ye table banaya hai.
  constraint leave_reason_min check (length(btrim(reason)) >= 5),
  -- Manzoor ya na-manzoor karne wala hamesha darj rehta hai.
  constraint leave_decided_by check (
    status in ('pending', 'cancelled') or (decided_by is not null and decided_at is not null)
  )
);

create index if not exists idx_leave_profile on leave_requests (profile_id, from_date desc);
create index if not exists idx_leave_status on leave_requests (status, from_date desc);

-- Ek hi din par do manzoor shuda chhutti nahi ho sakti.
create unique index if not exists leave_no_overlap
  on leave_requests (profile_id, from_date, to_date)
  where status = 'approved';

-- ---------------------------------------------------------------------
-- Manzoori hazri tak pahunchti hai
-- ---------------------------------------------------------------------
create or replace function fn_leave_to_attendance()
returns trigger
language plpgsql
as $$
declare
  d date;
begin
  -- Manzoor hui: har din ki hazri "chhutti" ho jaye.
  if new.status = 'approved' and coalesce(old.status, '') <> 'approved' then
    d := new.from_date;
    while d <= new.to_date loop
      insert into attendance_records (profile_id, attendance_date, status, source, notes)
      values (new.profile_id, d, 'leave', 'leave', 'Chhutti manzoor: ' || new.reason)
      on conflict (profile_id, attendance_date) do update
        -- Us din ki ASLI hazri lagi ho to usay nahi chherte. Banda aaya
        -- tha, ye record us ka saboot hai -- chhutti ki manzoori us se
        -- baad mein aayi to bhi wo aaya to tha.
        set status = case when attendance_records.source = 'leave' then 'leave' else attendance_records.status end,
            notes  = case when attendance_records.source = 'leave' then excluded.notes else attendance_records.notes end;
      d := d + 1;
    end loop;
  end if;

  -- Manzoori wapas li gayi: sirf wo qatarein hatti hain jo CHHUTTI se
  -- aayi thin. Asli hazri wahin rehti hai.
  if coalesce(old.status, '') = 'approved' and new.status <> 'approved' then
    delete from attendance_records
    where profile_id = new.profile_id
      and attendance_date between new.from_date and new.to_date
      and source = 'leave';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_leave_to_attendance on leave_requests;
create trigger trg_leave_to_attendance
  after insert or update on leave_requests
  for each row execute function fn_leave_to_attendance();

-- ---------------------------------------------------------------------
-- Kaun kya dekh sakta hai
-- ---------------------------------------------------------------------
alter table leave_requests enable row level security;

-- Apni chhutti har koi dekh sakta hai aur maang sakta hai.
drop policy if exists leave_own_read on leave_requests;
create policy leave_own_read on leave_requests for select to authenticated
  using (profile_id = auth.uid() or fn_is_any_staff());

drop policy if exists leave_own_insert on leave_requests;
create policy leave_own_insert on leave_requests for insert to authenticated
  with check (profile_id = auth.uid());

-- Faisla sirf HR aur oopar wale karte hain -- aur apni chhutti koi khud
-- manzoor nahi kar sakta.
drop policy if exists leave_decide on leave_requests;
create policy leave_decide on leave_requests for update to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.is_active
        and p.role::text in ('hr', 'manager', 'admin', 'owner', 'super_admin')
        and p.id <> leave_requests.profile_id
    )
  );

comment on table leave_requests is
  'Chhutti ki darkhwast aur us ka faisla. Manzoor hote hi hazri mein khud darj ho jati hai (134).';

-- ---------------------------------------------------------------------
-- Menu mein
-- ---------------------------------------------------------------------
insert into features (key, label, route, icon, label_en, label_ur)
values ('hr.leave', 'Chhutti', '/admin/hr/leave', 'CalendarOff', 'Leave', 'چھٹی')
on conflict (key) do update set label = excluded.label, route = excluded.route,
  icon = excluded.icon, label_en = excluded.label_en, label_ur = excluded.label_ur;

insert into dashboard_features (dashboard_key, feature_key, sort_order)
values ('hr', 'hr.leave', 15) on conflict do nothing;
