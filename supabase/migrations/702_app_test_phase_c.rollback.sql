-- 702 rollback. Hazri guard se 'app' hata kar purani fehrist. TEST order insert policy hatao.

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

drop policy if exists agri_orders_test_insert on public.agri_orders;
