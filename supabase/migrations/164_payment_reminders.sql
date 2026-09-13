-- 164: Wade ki tareekh par kisan ko yaad dilana -- aur wo yaad dilana
--      nazar bhi aana chahiye
--
-- Kisan kehta hai "5 tareekh ko doonga". Wo tareekh aa jati hai aur
-- kisi ko yaad nahi rehta. Booking qatar mein aa to jati hai, magar
-- qatar dekhna kisi ek bande ka kaam hota hai, aur us din wo chhutti
-- par hota hai.
--
-- So yaad dahani khud jaye. Magar ek shart ke sath: JO GAYA HAI WO
-- LIKHA JAYE. Bin likhe bheji hui yaad dahani se do museebatein aati
-- hain -- ek hi kisan ko din mein teen paighaam chale jate hain, aur
-- jab kisan kehta hai "mujhe kuch nahi aaya" to hamare paas jawab
-- nahi hota.
--
-- Is liye har paighaam ki apni qatar. Nakaam gaya ho to wo bhi likha
-- jata hai: "bhej diya" aur "bhejne ki koshish ki" ek cheez nahi.

create table if not exists public.machinery_payment_reminders (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid not null references public.machinery_bookings(id) on delete cascade,
  farmer_id    uuid references public.farmers(id),
  channel      text not null default 'whatsapp',
  phone        text,
  amount       numeric(14,2),
  promise_date date,
  message      text,
  status       text not null default 'sent' check (status in ('sent','failed')),
  error        text,
  sent_by      uuid references auth.users(id),   -- null = system (cron)
  created_at   timestamptz not null default now()
);

comment on table public.machinery_payment_reminders is
  'Har wo yaad dahani jo kisan ko payment ke liye gayi. Nakaam koshish bhi likhi jati hai -- "bhej diya" aur "bhejne ki koshish ki" ek cheez nahi.';

create index if not exists idx_payment_reminders_booking
  on public.machinery_payment_reminders (booking_id, created_at desc);

alter table public.machinery_payment_reminders enable row level security;

drop policy if exists p_payment_reminders_staff on public.machinery_payment_reminders;
create policy p_payment_reminders_staff on public.machinery_payment_reminders
  for select using (fn_is_any_staff());

revoke all on public.machinery_payment_reminders from anon;
grant select on public.machinery_payment_reminders to authenticated;
grant all on public.machinery_payment_reminders to service_role;

-- ---------------------------------------------------------------
-- Kis ko yaad dilana hai, aur kis ko dilayi ja chuki hai
--
-- Dono baatein ek hi qatar mein hain, jaan boojh kar. Alag alag hon
-- to banda pehli fehrist dekh kar paighaam bhejta hai aur ye nahi
-- dekhta ke wo pehle hi ja chuka hai.
-- ---------------------------------------------------------------
create or replace view public.v_machinery_payment_due as
select
  c.booking_id,
  c.booking_number,
  c.farmer_id,
  c.farmer_name,
  c.farmer_phone,
  c.village,
  c.baqi,
  c.payment_promise_date,
  (c.payment_promise_date is not null and c.payment_promise_date <= current_date) as wada_aa_gaya,
  r.aakhri_reminder,
  r.kitne_reminder,
  r.aakhri_halat
from public.v_machinery_control c
left join lateral (
  select max(x.created_at)                                   as aakhri_reminder,
         count(*)                                            as kitne_reminder,
         (array_agg(x.status order by x.created_at desc))[1]  as aakhri_halat
    from public.machinery_payment_reminders x
   where x.booking_id = c.booking_id
) r on true
where c.baqi > 0 and c.raw_status <> 'cancelled';

revoke all on public.v_machinery_payment_due from anon;
grant select on public.v_machinery_payment_due to authenticated, service_role;

comment on view public.v_machinery_payment_due is
  'Jin par paisa baqi hai: wada kab ka hai, aakhri yaad dahani kab gayi, aur kitni baar. Dono baatein ek hi qatar mein taake koi dobara na bhej de.';
