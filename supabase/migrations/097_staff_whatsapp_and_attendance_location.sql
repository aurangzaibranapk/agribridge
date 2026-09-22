-- =====================================================================
-- Migration 097: Staff ki WhatsApp pehchan + hazri ki location tasdeeq
-- =====================================================================

-- 1) Staff ka WhatsApp number. whatsapp_verified_at bhara hua hona hi
--    "taala laga hua" ka matlab hai. HR phone badle to tasdeeq khud
--    khatam ho jati hai (neeche trigger), warna purana number chalta
--    rehta aur naya malik pehchana na jata.
alter table staff_details add column if not exists whatsapp_number text;
alter table staff_details add column if not exists whatsapp_verified_at timestamptz;

create unique index if not exists idx_staff_details_whatsapp_number
  on staff_details(whatsapp_number) where whatsapp_number is not null;

create or replace function public.fn_reset_whatsapp_verification()
returns trigger language plpgsql as $$
begin
  if new.phone is distinct from old.phone then
    new.whatsapp_number := null;
    new.whatsapp_verified_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reset_whatsapp_verification on staff_details;
create trigger trg_reset_whatsapp_verification
  before update on staff_details
  for each row execute function public.fn_reset_whatsapp_verification();

-- 2) Tasdeeq ke darmiyan ki haalat. Zyada koshishon par band, taake koi
--    andaze laga kar CNIC na khol le.
create table if not exists staff_whatsapp_pending (
  whatsapp_number text primary key,
  profile_id uuid not null references profiles(id) on delete cascade,
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '15 minutes'
);

-- 3) Branch ki jagah aur hazri ka daira.
alter table branches add column if not exists latitude numeric(10,7);
alter table branches add column if not exists longitude numeric(10,7);
alter table branches add column if not exists attendance_radius_meters int not null default 200;

-- 4) Hazri ke sath faasla bhi mahfooz. Hazri ROKTE nahi — sirf sach
--    likh dete hain, faisla manager karta hai.
alter table attendance_records add column if not exists check_in_distance_meters numeric(10,1);
alter table attendance_records add column if not exists check_in_location_ok boolean;
alter table attendance_records add column if not exists check_out_distance_meters numeric(10,1);
alter table attendance_records add column if not exists check_out_location_ok boolean;
alter table attendance_records add column if not exists source text not null default 'web'
  check (source in ('web','whatsapp'));

alter table staff_whatsapp_pending enable row level security;
drop policy if exists staff_manage_whatsapp_pending on staff_whatsapp_pending;
create policy staff_manage_whatsapp_pending on staff_whatsapp_pending
  for all using (public.fn_is_any_staff()) with check (public.fn_is_any_staff());
