-- =====================================================================
-- 521: Aadhi chhutti poora din nahi kat-ti
-- =====================================================================
-- requestLeave is_half_day bhejta hai, magar 134 ka trigger har din
-- status = leave likhta tha. Tankhwah ka hisaab is din ko poora kaat
-- deta tha. Ab aadha din half_day likhta hai.

alter table public.leave_requests
  add column if not exists is_half_day boolean not null default false;

create or replace function fn_leave_to_attendance()
returns trigger
language plpgsql
as $$
declare
  d date;
  v_status text;
begin
  if new.status = 'approved' and coalesce(old.status, '') <> 'approved' then
    v_status := case when coalesce(new.is_half_day, false) then 'half_day' else 'leave' end;
    d := new.from_date;
    while d <= new.to_date loop
      insert into attendance_records (profile_id, attendance_date, status, source, notes)
      values (
        new.profile_id,
        d,
        v_status::attendance_status,
        'leave',
        case when v_status = 'half_day' then 'Aadhi chhutti manzoor: ' else 'Chhutti manzoor: ' end || new.reason
      )
      on conflict (profile_id, attendance_date) do update
        set status = case when attendance_records.source = 'leave' then excluded.status else attendance_records.status end,
            notes  = case when attendance_records.source = 'leave' then excluded.notes else attendance_records.notes end;
      d := d + 1;
    end loop;
  end if;

  if coalesce(old.status, '') = 'approved' and new.status <> 'approved' then
    delete from attendance_records
    where profile_id = new.profile_id
      and attendance_date between new.from_date and new.to_date
      and source = 'leave';
  end if;

  return new;
end;
$$;
