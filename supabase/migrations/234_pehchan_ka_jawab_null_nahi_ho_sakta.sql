-- =====================================================================
-- AgriBridge — Migration 234: Pehchan ka jawab NULL nahi ho sakta
-- =====================================================================
-- 233 mein rok is tarah likhi thi:
--
--     if not fn_hr_can_view_staff(p_profile) then raise exception ...
--
-- Aur fn_hr_can_view_staff ki pehli shart thi: p_target = auth.uid().
-- Jab auth.uid() NULL ho (bina login, ya kisi aise raaste se jahan
-- session nahi), to ye shart TRUE nahi hoti -- NULL hoti hai. NULL ya
-- FALSE ya FALSE bhi NULL hi rehta hai. Aur "if not NULL" par plpgsql
-- shakh mein DAKHIL HI NAHI hota.
--
-- Yani rok chup chaap khul jati thi. Testing par jaanch kar ke pakRa
-- gaya: bina kisi pehchan ke poora calendar mil raha tha.
--
-- Ye wohi qism ki ghalti hai jo is project mein pehle bhi mehngi paRi:
-- "jawab nahi mila" ko "jawab na" samajh lena. Ab har pehchan wala
-- function coalesce(..., false) se guzarta hai -- shak ki soorat mein
-- jawab INKAAR hai, khamoshi nahi.
-- =====================================================================


create or replace function fn_hr_can_view_staff(p_target uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(
    auth.uid() is not null
    and p_target is not null
    and (
      -- Apni hazri har koi dekh sakta hai.
      p_target = auth.uid()
      -- HR/Admin/Owner poori company.
      or exists (select 1 from profiles p
                 where p.id = auth.uid() and p.is_active
                   and p.role::text in ('hr','admin','owner','super_admin'))
      -- Manager sirf apni reporting team.
      or exists (select 1 from fn_hr_team(auth.uid()) t where t.profile_id = p_target)
    ),
    false);
$$;


create or replace function fn_hr_can_decide_for(p_target uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(
    auth.uid() is not null
    and p_target is not null
    -- Apni cheez koi khud manzoor nahi kar sakta -- chahe wo khud HR ho.
    and p_target <> auth.uid()
    and (
      exists (select 1 from profiles p
              where p.id = auth.uid() and p.is_active
                and p.role::text in ('hr','admin','owner','super_admin'))
      or exists (select 1 from fn_hr_team(auth.uid()) t where t.profile_id = p_target)
    ),
    false);
$$;


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
  if not coalesce(fn_hr_can_view_staff(p_profile), false) then
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
  if not coalesce(fn_hr_can_view_staff(p_profile), false) then
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
  if not coalesce(fn_is_any_staff(), false) then
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
    where pr.is_active and coalesce(fn_hr_can_view_staff(pr.id), false)
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
  if not coalesce(fn_is_any_staff(), false) then
    raise exception 'Sirf staff ke liye.';
  end if;

  v_today := (now() at time zone 'Asia/Karachi')::date;

  return query
  select
    (select count(*)::int from attendance_corrections ac
      where ac.status in ('pending', 'sent_back')
        and coalesce(fn_hr_can_decide_for(ac.profile_id), false)),
    (select count(*)::int from leave_requests lr
      where lr.status in ('pending', 'sent_back')
        and coalesce(fn_hr_can_decide_for(lr.profile_id), false)),
    (select count(*)::int from attendance_records ar
      where ar.attendance_date between v_today - 7 and v_today - 1
        and ar.status = 'present'
        and ar.check_in_at is not null
        and ar.check_out_at is null
        and ar.check_out is null
        and coalesce(fn_hr_can_view_staff(ar.profile_id), false)),
    (select count(*)::int
       from (
         select pr.id, coalesce(sd.branch_id, pr.branch_id) as branch_id
         from profiles pr
         join staff_details sd on sd.profile_id = pr.id and sd.is_active
         where pr.is_active and coalesce(fn_hr_can_view_staff(pr.id), false)
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


comment on function fn_hr_can_view_staff(uuid) is
  'Kaun kis ki hazri dekh sakta hai. Jawab kabhi NULL nahi -- NULL ko "not" lagane par rok khul jati thi (234).';
