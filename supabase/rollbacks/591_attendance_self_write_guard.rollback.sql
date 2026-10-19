-- Rollback 591: 235 ki insert policy aur 232 ka update guard wapas.
drop trigger if exists trg_attendance_self_insert_guard on public.attendance_records;
drop function if exists public.fn_attendance_self_insert_guard();

drop policy if exists attendance_insert on public.attendance_records;
create policy attendance_insert on public.attendance_records for insert to authenticated
  with check (
    profile_id = auth.uid()
    or coalesce(public.fn_hr_can_decide_for(profile_id), false)
  );

create or replace function public.fn_attendance_self_edit_guard()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_actor uuid;
  v_is_hr boolean;
begin
  begin
    v_actor := auth.uid();
  exception when others then
    v_actor := null;
  end;
  if v_actor is null then
    return new;
  end if;
  select exists (
    select 1 from profiles p
    where p.id = v_actor and p.is_active
      and p.role::text in ('hr','manager','admin','owner','super_admin')
  ) into v_is_hr;
  if v_is_hr then
    return new;
  end if;
  if v_actor = new.profile_id then
    if new.status is distinct from old.status then
      raise exception 'Apni hazri ka darja khud nahi badal sakte. Theek karwane ke liye darkhwast dein.';
    end if;
    if new.check_in_at is distinct from old.check_in_at
       or new.check_in is distinct from old.check_in then
      raise exception 'Check-in ka waqt ek dafa lagta hai. Badalne ke liye darkhwast dein.';
    end if;
  end if;
  return new;
end;
$$;

drop function if exists public.fn_attendance_is_today(date);
