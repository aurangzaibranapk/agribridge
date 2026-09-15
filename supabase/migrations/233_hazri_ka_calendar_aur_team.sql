-- =====================================================================
-- AgriBridge — Migration 233: Calendar, team, aur mahine ka hisaab
-- =====================================================================
-- Yahan koi naya table nahi. Sirf wo sawal hain jo har safha poochta
-- hai, aur un ka ek hi jawab -- ek hi jagah se.
--
-- Ye sab SECURITY DEFINER hain, jaan boojh kar. Wajah wohi jo is
-- project mein pehle mehngi paR chuki hai: RLS ke peeche khali jawab
-- ko asal adad samajh lena. Agar manager ko apni team ki hazri RLS ki
-- wajah se aadhi nazar aaye, to "8 din ghair hazir" ki jagah "2 din"
-- likha jayega -- aur us par tankhwah ban jayegi.
--
-- Is liye: hisaab taale ke ANDAR hota hai, aur pehchan DARWAZE par.
-- Jis ko haq nahi, usay khali qatarein nahi -- saaf inkaar milta hai.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Kis bande par kaun sa waqt lagta hai
-- ---------------------------------------------------------------------
create or replace function fn_hr_schedule_for(p_profile uuid)
returns table (
  weekly_off_days smallint[],
  shift_start time,
  shift_end time,
  late_grace_minutes int,
  half_day_max_minutes int
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select s.weekly_off_days, s.shift_start, s.shift_end,
         s.late_grace_minutes, s.half_day_max_minutes
  from hr_work_schedules s
  where s.is_active
    and (s.branch_id is null
         or s.branch_id = (
              select coalesce(sd.branch_id, pr.branch_id)
              from profiles pr
              left join staff_details sd on sd.profile_id = pr.id
              where pr.id = p_profile))
  -- Branch ka apna schedule company ke default par bhaari hai.
  order by (s.branch_id is null)
  limit 1;
$$;

-- ---------------------------------------------------------------------
-- 2) Team -- poori zanjeer, sirf seedhe matehat nahi
-- ---------------------------------------------------------------------
create or replace function fn_hr_team(p_manager uuid)
returns table (profile_id uuid, depth int)
language sql
stable
security definer
set search_path to 'public'
as $$
  with recursive team as (
    select sd.profile_id, 1 as depth
    from staff_details sd
    where sd.reports_to = p_manager and sd.is_active
    union all
    select sd.profile_id, t.depth + 1
    from staff_details sd
    join team t on sd.reports_to = t.profile_id
    where sd.is_active and t.depth < 20
  )
  select profile_id, min(depth)::int from team group by profile_id;
$$;

-- ---------------------------------------------------------------------
-- 3) Kaun kis ki hazri dekh sakta hai
-- ---------------------------------------------------------------------
create or replace function fn_hr_can_view_staff(p_target uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    -- Apni hazri har koi dekh sakta hai.
    p_target = auth.uid()
    -- HR/Admin/Owner poori company.
    or exists (select 1 from profiles p
               where p.id = auth.uid() and p.is_active
                 and p.role::text in ('hr','admin','owner','super_admin'))
    -- Manager sirf apni reporting team.
    or exists (select 1 from fn_hr_team(auth.uid()) t where t.profile_id = p_target);
$$;

-- Faisla karne ka haq DEKHNE se tang hai: apni cheez koi khud manzoor
-- nahi kar sakta -- chahe wo khud HR ho.
create or replace function fn_hr_can_decide_for(p_target uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select p_target <> auth.uid()
     and (
       exists (select 1 from profiles p
               where p.id = auth.uid() and p.is_active
                 and p.role::text in ('hr','admin','owner','super_admin'))
       or exists (select 1 from fn_hr_team(auth.uid()) t where t.profile_id = p_target)
     );
$$;

-- ---------------------------------------------------------------------
-- 4) Calendar ka engine -- bina pehchan ke
-- ---------------------------------------------------------------------
-- Ye function ijazat NAHI dekhta, is liye ye seedha kisi ke haath mein
-- nahi diya jata (neeche revoke). Ijazat wale do darwaze is ke oopar
-- hain. Wajah: fn_hr_today_board ko har bande ke liye ye chalana hota
-- hai aur wahan "haq nahi" par exception nahi, us bande ko chhoR dena
-- chahiye.
--
-- Aur ye alag alag cheezein alag alag likhta hai:
--   missing = kaam ka din tha, koi record hi nahi -- dekhna paRega
--   absent  = kisi ne haath se ghair hazir likha -- faisla ho chuka
-- In dono ko ek karna wohi ghalti hai jo is project mein mana hai:
-- "hisaab nahi rakha gaya" aur "sifar" ek cheez nahi.
create or replace function fn_attendance_days(
  p_profile uuid,
  p_from date,
  p_to date
)
returns table (
  the_date date,
  state text,
  raw_status text,
  check_in time,
  check_out time,
  work_minutes int,
  late_minutes int,
  source text,
  notes text,
  is_holiday boolean,
  holiday_name text,
  is_weekly_off boolean,
  pending_correction boolean,
  correction_id uuid,
  leave_pending boolean,
  changes_count int
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_off smallint[];
  v_start time;
  v_grace int;
  v_branch uuid;
  v_today date := (now() at time zone 'Asia/Karachi')::date;
begin
  select s.weekly_off_days, s.shift_start, s.late_grace_minutes
    into v_off, v_start, v_grace
    from fn_hr_schedule_for(p_profile) s;

  v_off := coalesce(v_off, array[0]::smallint[]);
  v_start := coalesce(v_start, '09:00'::time);
  v_grace := coalesce(v_grace, 15);

  select coalesce(sd.branch_id, pr.branch_id) into v_branch
    from profiles pr
    left join staff_details sd on sd.profile_id = pr.id
   where pr.id = p_profile;

  return query
  with days as (
    select d::date as the_date
    from generate_series(p_from, p_to, interval '1 day') d
  ),
  joined as (
    select
      dy.the_date,
      ar.status::text as raw_status,
      coalesce(ar.check_in, (ar.check_in_at at time zone 'Asia/Karachi')::time) as c_in,
      coalesce(ar.check_out, (ar.check_out_at at time zone 'Asia/Karachi')::time) as c_out,
      ar.work_minutes as stored_work,
      ar.late_minutes as stored_late,
      ar.source as src,
      ar.notes as nts,
      h.name as hol_name,
      (extract(dow from dy.the_date)::smallint = any (v_off)) as wk_off,
      cr.id as corr_id,
      lp.id as leave_pending_id
    from days dy
    left join attendance_records ar
      on ar.profile_id = p_profile and ar.attendance_date = dy.the_date
    left join lateral (
      select hh.name from hr_holidays hh
      where hh.holiday_date = dy.the_date
        and (hh.branch_id is null or hh.branch_id = v_branch)
      order by (hh.branch_id is null)
      limit 1
    ) h on true
    left join lateral (
      select ac.id from attendance_corrections ac
      where ac.profile_id = p_profile
        and ac.attendance_date = dy.the_date
        and ac.status in ('pending', 'sent_back')
      limit 1
    ) cr on true
    left join lateral (
      select lr.id from leave_requests lr
      where lr.profile_id = p_profile
        and lr.status in ('pending', 'sent_back')
        and dy.the_date between lr.from_date and lr.to_date
      limit 1
    ) lp on true
  ),
  computed as (
    select
      j.*,
      coalesce(
        j.stored_late,
        case when j.c_in is not null and j.raw_status in ('present', 'half_day')
             then greatest(0, (extract(epoch from (
                    j.c_in - (v_start + make_interval(mins => v_grace))
                  )) / 60)::int)
        end
      ) as late_min,
      coalesce(
        j.stored_work,
        case when j.c_in is not null and j.c_out is not null
             then (extract(epoch from (j.c_out - j.c_in)) / 60)::int
        end
      ) as work_min
    from joined j
  )
  select
    c.the_date,
    case
      when c.raw_status = 'leave' then 'leave'
      when c.raw_status = 'half_day' then 'half_day'
      when c.raw_status = 'absent' then 'absent'
      when c.raw_status = 'present' and c.c_in is not null and c.c_out is null
           and c.the_date < v_today then 'missing_punch'
      when c.raw_status = 'present' and coalesce(c.late_min, 0) > 0 then 'late'
      when c.raw_status = 'present' then 'present'
      when c.hol_name is not null then 'holiday'
      when c.wk_off then 'weekly_off'
      when c.leave_pending_id is not null then 'leave_pending'
      when c.the_date > v_today then 'future'
      when c.the_date = v_today then 'today'
      else 'missing'
    end as state,
    c.raw_status,
    c.c_in,
    c.c_out,
    c.work_min,
    c.late_min,
    c.src,
    c.nts,
    (c.hol_name is not null) as is_holiday,
    c.hol_name,
    c.wk_off,
    (c.corr_id is not null) as pending_correction,
    c.corr_id,
    (c.leave_pending_id is not null) as leave_pending,
    coalesce((select count(*)::int from attendance_audit aa
              where aa.profile_id = p_profile
                and aa.attendance_date = c.the_date
                and aa.action = 'update'), 0) as changes_count
  from computed c
  order by c.the_date;
end;
$$;

revoke all on function fn_attendance_days(uuid, date, date) from public;
revoke all on function fn_attendance_days(uuid, date, date) from anon;
revoke all on function fn_attendance_days(uuid, date, date) from authenticated;

-- ---------------------------------------------------------------------
-- 5) Mahine ka calendar -- ijazat wala darwaza
-- ---------------------------------------------------------------------
create or replace function fn_attendance_calendar(
  p_profile uuid,
  p_year int,
  p_month int
)
returns table (
  the_date date,
  state text,
  raw_status text,
  check_in time,
  check_out time,
  work_minutes int,
  late_minutes int,
  source text,
  notes text,
  is_holiday boolean,
  holiday_name text,
  is_weekly_off boolean,
  pending_correction boolean,
  correction_id uuid,
  leave_pending boolean,
  changes_count int
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_from date;
begin
  if not fn_hr_can_view_staff(p_profile) then
    raise exception 'Ye hazri dekhne ka haq nahi. Sirf apni, ya apni reporting team ki hazri dekhi ja sakti hai.';
  end if;

  if p_month < 1 or p_month > 12 or p_year < 2000 or p_year > 2100 then
    raise exception 'Mahina ya saal theek nahi.';
  end if;

  v_from := make_date(p_year, p_month, 1);

  return query
  select * from fn_attendance_days(p_profile, v_from, (v_from + interval '1 month - 1 day')::date);
end;
$$;

-- ---------------------------------------------------------------------
-- 6) Mahine ka hisaab -- payroll isi se banega
-- ---------------------------------------------------------------------
-- open_items: kitni darkhwastein abhi zer-e-ghaur hain.
-- is_finalized: mahina band hua ya nahi.
--
-- Payroll ko in DONO ka jawab chahiye. Sirf adad de dena wohi ghalti
-- hai: 22 din hazir dikh jayenge, aur ye nahi dikhega ke 3 din ki
-- darkhwast abhi manager ke paas paRi hai.
create or replace function fn_attendance_month_summary(
  p_profile uuid,
  p_year int,
  p_month int
)
returns table (
  working_days int,
  present_days int,
  half_days int,
  paid_leave_days int,
  unpaid_leave_days int,
  absent_days int,
  missing_days int,
  holiday_days int,
  off_days int,
  late_count int,
  late_minutes_total int,
  worked_minutes_total int,
  open_items int,
  is_finalized boolean
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_from date;
  v_to date;
  v_branch uuid;
begin
  if not fn_hr_can_view_staff(p_profile) then
    raise exception 'Is bande ka mahina dekhne ka haq nahi.';
  end if;

  v_from := make_date(p_year, p_month, 1);
  v_to := (v_from + interval '1 month - 1 day')::date;

  select coalesce(sd.branch_id, pr.branch_id) into v_branch
    from profiles pr
    left join staff_details sd on sd.profile_id = pr.id
   where pr.id = p_profile;

  return query
  with cal as (
    select * from fn_attendance_days(p_profile, v_from, v_to)
  ),
  -- Chhutti ka type chhutti ki darkhwast se aata hai. Hazri ka record
  -- sirf itna kehta hai ke "chhutti thi" -- tankhwah wali ya nahi, wo
  -- yahan se pata chalta hai.
  leave_typed as (
    select c.the_date,
           (select lr.leave_type from leave_requests lr
            where lr.profile_id = p_profile and lr.status = 'approved'
              and c.the_date between lr.from_date and lr.to_date
            limit 1) as leave_type
    from cal c
    where c.state in ('leave', 'half_day')
  )
  select
    count(*) filter (where c.state not in ('holiday', 'weekly_off', 'future'))::int,
    count(*) filter (where c.state in ('present', 'late'))::int,
    count(*) filter (where c.state = 'half_day')::int,
    count(*) filter (where c.state = 'leave'
                       and coalesce((select lt.leave_type from leave_typed lt
                                     where lt.the_date = c.the_date), 'casual') <> 'unpaid')::int,
    count(*) filter (where c.state = 'leave'
                       and (select lt.leave_type from leave_typed lt
                            where lt.the_date = c.the_date) = 'unpaid')::int,
    count(*) filter (where c.state = 'absent')::int,
    count(*) filter (where c.state in ('missing', 'missing_punch'))::int,
    count(*) filter (where c.state = 'holiday')::int,
    count(*) filter (where c.state = 'weekly_off')::int,
    count(*) filter (where c.state = 'late')::int,
    coalesce(sum(c.late_minutes), 0)::int,
    coalesce(sum(c.work_minutes), 0)::int,
    (
      (select count(*) from attendance_corrections ac
        where ac.profile_id = p_profile
          and ac.attendance_date between v_from and v_to
          and ac.status in ('pending', 'sent_back'))
      +
      (select count(*) from leave_requests lr
        where lr.profile_id = p_profile
          and lr.status in ('pending', 'sent_back')
          and lr.from_date <= v_to and lr.to_date >= v_from)
    )::int,
    exists (
      select 1 from attendance_month_locks ml
      where ml.lock_year = p_year and ml.lock_month = p_month
        and ml.reopened_at is null
        and (ml.branch_id is null or ml.branch_id = v_branch)
    )
  from cal c;
end;
$$;

-- ---------------------------------------------------------------------
-- 7) Aaj ka board
-- ---------------------------------------------------------------------
-- Pehle ye tay hota hai ke kis kis ko dekhne ka haq hai, phir un ka
-- din nikalta hai. Ulta karne par un logon par bhi engine chalta jin
-- ko dekhna hi nahi tha.
create or replace function fn_hr_today_board(p_date date default null)
returns table (
  profile_id uuid,
  full_name text,
  designation text,
  department_key text,
  state text,
  check_in time,
  check_out time,
  late_minutes int,
  source text,
  pending_correction boolean
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_date date;
begin
  if not fn_is_any_staff() then
    raise exception 'Ye board sirf staff ke liye hai.';
  end if;

  v_date := coalesce(p_date, (now() at time zone 'Asia/Karachi')::date);

  return query
  select v.id, v.full_name, v.designation, v.department_key,
         cal.state, cal.check_in, cal.check_out, cal.late_minutes,
         cal.source, cal.pending_correction
  from (
    select pr.id, pr.full_name, sd.designation, sd.department_key
    from profiles pr
    join staff_details sd on sd.profile_id = pr.id and sd.is_active
    where pr.is_active and fn_hr_can_view_staff(pr.id)
  ) v
  cross join lateral fn_attendance_days(v.id, v_date, v_date) cal
  order by v.full_name;
end;
$$;

-- ---------------------------------------------------------------------
-- 8) "Dhyan chahiye" -- manager ke liye
-- ---------------------------------------------------------------------
create or replace function fn_hr_needs_attention()
returns table (
  pending_corrections int,
  pending_leaves int,
  missing_punch_7d int,
  missing_days_7d int
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_today date;
begin
  if not fn_is_any_staff() then
    raise exception 'Sirf staff ke liye.';
  end if;

  v_today := (now() at time zone 'Asia/Karachi')::date;

  return query
  select
    (select count(*)::int from attendance_corrections ac
      where ac.status in ('pending', 'sent_back')
        and fn_hr_can_decide_for(ac.profile_id)),
    (select count(*)::int from leave_requests lr
      where lr.status in ('pending', 'sent_back')
        and fn_hr_can_decide_for(lr.profile_id)),
    (select count(*)::int from attendance_records ar
      where ar.attendance_date between v_today - 7 and v_today - 1
        and ar.status = 'present'
        and ar.check_in_at is not null
        and ar.check_out_at is null
        and ar.check_out is null
        and fn_hr_can_view_staff(ar.profile_id)),
    (select count(*)::int
       from (
         select pr.id, coalesce(sd.branch_id, pr.branch_id) as branch_id
         from profiles pr
         join staff_details sd on sd.profile_id = pr.id and sd.is_active
         where pr.is_active and fn_hr_can_view_staff(pr.id)
       ) v
       cross join generate_series(v_today - 7, v_today - 1, interval '1 day') d
      where not exists (select 1 from attendance_records ar
                        where ar.profile_id = v.id and ar.attendance_date = d::date)
        and not exists (select 1 from hr_holidays hh
                        where hh.holiday_date = d::date
                          and (hh.branch_id is null or hh.branch_id = v.branch_id))
        and not (extract(dow from d)::smallint = any (
                  coalesce((select s.weekly_off_days from fn_hr_schedule_for(v.id) s),
                           array[0]::smallint[])))
    );
end;
$$;

comment on function fn_attendance_days(uuid, date, date) is
  'Calendar ka engine -- ijazat nahi dekhta, is liye seedha nahi bulaya jata (233).';
comment on function fn_attendance_calendar(uuid, int, int) is
  'Mahine ke har din ka jawab -- record se, aur jahan record nahi wahan qawaid se (233).';
comment on function fn_attendance_month_summary(uuid, int, int) is
  'Payroll ka mahina. open_items aur is_finalized dekhe baghair tankhwah nahi banti (233).';
