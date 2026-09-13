-- =====================================================================
-- AgriBridge — Migration 240: Bachi hui chhutti khamoshi se khatam na ho
-- =====================================================================
-- Malik ka faisla: bachi hui saalana chhutti agle saal NAHI jati --
-- 31 December ko khatam ho jati hai. (238 mein carry_forward_days ka
-- default sifar tha; ab wo andaza nahi, tay shuda usool hai.)
--
-- Us usool ka ek saya hai jo apne aap nazar nahi aata: 31 December ko
-- kisi ke 8 din khatam ho jayenge, aur usay pata bhi nahi chalega. Wo
-- wohi khamoshi hai jo aazmaishi muddat mein thi -- koi cheez guzar
-- jati hai aur kisi ne bataya hi nahi.
--
-- Is liye ye function: kis ki kitni chhutti bachi hai aur kitne din
-- mein khatam ho rahi hai. Board par us ka nishan lagta hai, aur bande
-- ko apne safhe par nazar aata hai.
--
-- Agar kabhi carry_forward_days sifar se oopar rakha gaya, to ye
-- function KHALI hota hai -- kyunke phir kuch khatam nahi ho raha aur
-- jhooti warning se bura kuch nahi.
-- =====================================================================

create or replace function fn_hr_expiring_leave()
returns table (
  profile_id uuid,
  full_name text,
  designation text,
  remaining_days numeric,
  days_to_expiry int
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_pol hr_leave_policy%rowtype;
  v_today date := (now() at time zone 'Asia/Karachi')::date;
  v_year int := extract(year from (now() at time zone 'Asia/Karachi'))::int;
  v_end date;
begin
  if not coalesce(fn_is_any_staff(), false) then
    raise exception 'Sirf staff ke liye.';
  end if;

  select * into v_pol from hr_leave_policy where id;

  -- Chhutti aage jati hai to kuch khatam nahi ho raha.
  if v_pol.carry_forward_days > 0 then
    return;
  end if;

  v_end := make_date(v_year, 12, 31);

  return query
  select v.id, v.full_name, v.designation, e.remaining_days, (v_end - v_today)::int
  from (
    select pr.id, pr.full_name, sd.designation
    from profiles pr
    join staff_details sd on sd.profile_id = pr.id and sd.is_active
    where pr.is_active
      and sd.employment_status = 'confirmed'
      and coalesce(fn_hr_can_view_staff(pr.id), false)
  ) v
  cross join lateral fn_leave_entitlement(v.id, v_year) e
  where coalesce(e.remaining_days, 0) > 0
  order by e.remaining_days desc;
end;
$$;

comment on function fn_hr_expiring_leave() is
  'Kis ki bachi hui chhutti 31 December ko khatam ho jayegi. carry_forward_days > 0 ho to khali (240).';

comment on column hr_leave_policy.carry_forward_days is
  'Malik ka usool: sifar -- bachi hui chhutti agle saal nahi jati, khatam ho jati hai (240).';
