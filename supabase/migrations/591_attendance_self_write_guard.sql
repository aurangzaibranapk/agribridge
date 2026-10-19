-- =====================================================================
-- AgriBridge — Migration 591: Apni hazri sirf check-in se (S2, S3)
-- =====================================================================
-- HR audit:
--
-- S2) attendance_insert (235) banday ko APNI qatar kisi bhi tareekh aur
--     kisi bhi darje ke saath daalne deti thi. Rok (232 ka trigger)
--     sirf UPDATE par thi -- aur us mein HR/Manager/Admin ko apni qatar
--     par bhi chhoot thi. Yani HR apni ghair-haziri khud 'present' likh
--     sakta tha, aur koi bhi kal ki 'present' qatar daal sakta tha.
--
--     Ab: apni qatar sirf AAJ ki, 'present', check-in ke waqt ke saath
--     (yani wohi jo check-in button karta hai). Aur apni qatar ka darja /
--     check-in / tareekh koi khud nahi badal sakta -- HR, Admin, Owner
--     bhi nahi. Check-out (jaane ka waqt) pehle ki tarah apna hi lagta hai.
--
-- S3) WhatsApp check-in (service role) upsert karta tha. Us din manzoor
--     chhutti, ghair-haziri ya afsar ki lagayi hazri ho to wo usay chup
--     chaap 'present' bana deta. Ab database ye overwrite rokta hai (app
--     bhi ab pehle dekhti hai -- src/lib/staff-attendance.ts).
--
-- "Aaj" do tarah ginna paRta hai: app UTC tareekh bhejti hai, banda
-- Pakistan mein hai. Dono mein se koi bhi ho to theek.
-- Additive. Rollback: supabase/rollbacks/591_*.sql
-- =====================================================================

create or replace function public.fn_attendance_is_today(p_date date)
returns boolean
language sql
stable
set search_path to 'public'
as $$
  select p_date in ((now() at time zone 'UTC')::date, (now() at time zone 'Asia/Karachi')::date);
$$;

-- ---------------------------------------------------------------------
-- 1) Insert policy: apni qatar sirf aaj ka check-in
-- ---------------------------------------------------------------------
drop policy if exists attendance_insert on public.attendance_records;
create policy attendance_insert on public.attendance_records for insert to authenticated
  with check (
    (
      profile_id = auth.uid()
      and status = 'present'
      and check_in_at is not null
      and public.fn_attendance_is_today(attendance_date)
    )
    or coalesce(public.fn_hr_can_decide_for(profile_id), false)
  );

-- ---------------------------------------------------------------------
-- 2) Insert trigger: wohi rok, saaf wajah ke saath
-- ---------------------------------------------------------------------
create or replace function public.fn_attendance_self_insert_guard()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_actor uuid;
begin
  begin
    v_actor := auth.uid();
  exception when others then
    v_actor := null;
  end;
  if v_actor is null or new.profile_id is distinct from v_actor then
    return new;
  end if;

  if not public.fn_attendance_is_today(new.attendance_date) then
    raise exception 'Apni hazri sirf aaj ki lagti hai (check-in). Kisi aur din ke liye darkhwast dein.';
  end if;
  if new.status is distinct from 'present' or new.check_in_at is null then
    raise exception 'Apni hazri sirf check-in se lagti hai. Darja badalne ke liye darkhwast dein.';
  end if;
  if new.check_in_at < now() - interval '15 minutes' or new.check_in_at > now() + interval '5 minutes' then
    raise exception 'Check-in ka waqt abhi ka hona chahiye.';
  end if;
  if new.source not in ('web', 'pwa', 'whatsapp', 'offline', 'biometric') then
    raise exception 'Apni hazri mein ye source nahi lag sakta.';
  end if;
  if new.check_out_at is not null or new.check_out is not null then
    raise exception 'Check-in ke saath check-out nahi lagta.';
  end if;
  return new;
end;
$$;

revoke execute on function public.fn_attendance_self_insert_guard() from public, anon;
grant execute on function public.fn_attendance_self_insert_guard() to authenticated, service_role;

drop trigger if exists trg_attendance_self_insert_guard on public.attendance_records;
create trigger trg_attendance_self_insert_guard
  before insert on public.attendance_records
  for each row execute function public.fn_attendance_self_insert_guard();

-- ---------------------------------------------------------------------
-- 3) Update guard (232 ka) -- HR ki apni chhoot khatam, aur S3
-- ---------------------------------------------------------------------
create or replace function public.fn_attendance_self_edit_guard()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_actor uuid;
begin
  begin
    v_actor := auth.uid();
  exception when others then
    v_actor := null;
  end;

  -- Server (service role). Sirf ek rok: WhatsApp check-in kisi pehle se
  -- maujood faisle (chhutti, ghair-haziri, afsar ki hazri, pichla
  -- check-in) ko overwrite nahi karta (S3).
  if v_actor is null then
    if new.source = 'whatsapp'
       and (new.status is distinct from old.status or new.check_in_at is distinct from old.check_in_at)
       and (old.source in ('leave', 'correction')
            or old.status::text in ('leave', 'absent')
            or old.check_in_at is not null) then
      raise exception 'Is din ka record pehle se maujood hai (%). WhatsApp check-in usay nahi badalta.', old.status;
    end if;
    return new;
  end if;

  -- Apni qatar: koi bhi ho (HR/Admin/Owner bhi), darja khud nahi badalta.
  if v_actor = new.profile_id or v_actor = old.profile_id then
    if new.profile_id is distinct from old.profile_id
       or new.attendance_date is distinct from old.attendance_date then
      raise exception 'Hazri ki qatar kisi aur din ya kisi aur ke naam nahi ki ja sakti.';
    end if;
    if new.status is distinct from old.status then
      raise exception 'Apni hazri ka darja khud nahi badal sakte. Theek karwane ke liye darkhwast dein.';
    end if;
    if new.check_in_at is distinct from old.check_in_at
       or new.check_in is distinct from old.check_in then
      raise exception 'Check-in ka waqt ek dafa lagta hai. Badalne ke liye darkhwast dein.';
    end if;
    if new.source is distinct from old.source
       or new.last_changed_by is distinct from old.last_changed_by
       or new.last_change_reason is distinct from old.last_change_reason then
      raise exception 'Apni hazri ka record khud nahi badla ja sakta. Darkhwast dein.';
    end if;
  end if;

  return new;
end;
$$;

-- trg_attendance_self_edit_guard (232) isi function ko chalata hai --
-- trigger dobara banana zaroori nahi, magar yaqeeni banane ke liye:
drop trigger if exists trg_attendance_self_edit_guard on public.attendance_records;
create trigger trg_attendance_self_edit_guard
  before update on public.attendance_records
  for each row execute function public.fn_attendance_self_edit_guard();

revoke execute on function public.fn_attendance_self_edit_guard() from public, anon;
grant execute on function public.fn_attendance_self_edit_guard() to authenticated, service_role;

comment on policy attendance_insert on public.attendance_records is
  'Apni qatar sirf aaj ka check-in (present); baqi sirf afsar/HR doosron ki (591).';
