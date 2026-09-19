-- =====================================================================
-- AgriBridge — Migration 231: HR ki bunyad
--   (1) Kaun kis ko report karta hai
--   (2) Chhutti ka din aur hafte ki chhutti -- calendar ki bunyad
-- =====================================================================
-- Ab tak HR ke paas hazri to thi, magar do cheezein bilkul nahi thin:
--
-- 1. REPORTING. Kisi bhi mulazim ka koi "afsar" darj hi nahi hota tha.
--    Is liye "manager sirf apni team ki hazri manzoor kare" jaisa usool
--    lagaya hi nahi ja sakta tha -- system ko pata hi nahi tha ke team
--    kis ki hai. department_head_grants ek alag cheez hai: wo IJAZAT
--    deta hai (kaun sa safha khul sakta hai), TEAM nahi banata.
--
-- 2. CHHUTTI KA DIN. Na hafte ki chhutti ka koi tasawwur tha, na Eid
--    jaisi chhutti ka. Nateeja: itwaar ko bhi hazri ka record na hone
--    par banda GHAIR HAZIR ginta tha, aur mahine ke aakhir mein us ki
--    tankhwah us ghair haziri par katti.
--
-- ---------------------------------------------------------------------
-- Faisla: chhutti ka din "hazri ka record" nahi hai
-- ---------------------------------------------------------------------
-- Aasan raasta ye tha ke har itwaar har bande ke liye ek qatar bana di
-- jaye jis par "hafte ki chhutti" likha ho. 40 bande = 2,000 qatarein
-- saal mein, jin mein se ek bhi asli waqia nahi. Aur schedule badalne
-- par purani qatarein jhoot bolne lagtin.
--
-- Is liye: hafte ki chhutti aur Eid ki chhutti QAWAID hain, waqiat
-- nahi. Calendar un qawaid ko parh kar khaana bharta hai. Hazri ke
-- table mein sirf wo din aata hai jis din kuch WAQAI hua.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Kaun kis ko report karta hai
-- ---------------------------------------------------------------------
alter table staff_details
  add column if not exists reports_to uuid references profiles(id),
  add column if not exists department_key text references departments(key),
  add column if not exists branch_id uuid references branches(id),
  add column if not exists employment_type text not null default 'permanent';

alter table staff_details drop constraint if exists chk_staff_employment_type;
alter table staff_details add constraint chk_staff_employment_type
  check (employment_type in ('permanent', 'contract', 'daily_wage', 'intern'));

-- Apna afsar khud nahi ho sakta.
alter table staff_details drop constraint if exists chk_staff_not_own_manager;
alter table staff_details add constraint chk_staff_not_own_manager
  check (reports_to is null or reports_to <> profile_id);

create index if not exists idx_staff_reports_to on staff_details (reports_to)
  where reports_to is not null;
create index if not exists idx_staff_department on staff_details (department_key)
  where department_key is not null;

-- Gol chakkar rokna: A -> B -> A. Aisa ho jaye to team nikalne wali
-- recursive query hamesha ke liye ghoomti rehti hai.
create or replace function fn_hr_no_reporting_cycle()
returns trigger
language plpgsql
as $$
declare
  v_cursor uuid;
  v_hops int := 0;
begin
  if new.reports_to is null then
    return new;
  end if;

  v_cursor := new.reports_to;
  while v_cursor is not null and v_hops < 100 loop
    if v_cursor = new.profile_id then
      raise exception 'Reporting mein gol chakkar ban raha hai: ye banda ghoom kar khud apna afsar ban jata hai.';
    end if;
    select sd.reports_to into v_cursor
      from staff_details sd where sd.profile_id = v_cursor;
    v_hops := v_hops + 1;
  end loop;

  if v_hops >= 100 then
    raise exception 'Reporting ki zanjeer bohot lambi hai (100 se zyada). Pehle usay theek karein.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_hr_no_reporting_cycle on staff_details;
create trigger trg_hr_no_reporting_cycle
  before insert or update of reports_to on staff_details
  for each row execute function fn_hr_no_reporting_cycle();

-- ---------------------------------------------------------------------
-- 2) Kaam ka waqt aur hafte ki chhutti
-- ---------------------------------------------------------------------
-- branch_id NULL = poori company ka default. Kisi branch ka apna alag
-- waqt ho to us branch ki qatar us default par bhaari rehti hai.
create table if not exists hr_work_schedules (
  id uuid primary key default uuid_generate_v4(),
  branch_id uuid references branches(id) on delete cascade,
  -- 0 = Itwaar ... 6 = Hafta (postgres ke extract(dow) ke mutabiq)
  weekly_off_days smallint[] not null default array[0]::smallint[],
  shift_start time not null default '09:00',
  shift_end time not null default '17:00',
  -- Itni der tak "late" nahi ginte.
  late_grace_minutes int not null default 15,
  -- Is se kam kaam = aadha din.
  half_day_max_minutes int not null default 300,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ek branch ka ek hi chalta hua schedule; company ka bhi ek hi.
create unique index if not exists idx_work_schedule_branch
  on hr_work_schedules (coalesce(branch_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where is_active;

alter table hr_work_schedules drop constraint if exists chk_schedule_dow;
alter table hr_work_schedules add constraint chk_schedule_dow
  check (weekly_off_days <@ array[0,1,2,3,4,5,6]::smallint[]);

alter table hr_work_schedules drop constraint if exists chk_schedule_times;
alter table hr_work_schedules add constraint chk_schedule_times
  check (shift_end > shift_start
     and late_grace_minutes between 0 and 240
     and half_day_max_minutes between 0 and 1440);

-- Company ka default: itwaar chhutti, 9 se 5.
insert into hr_work_schedules (branch_id, weekly_off_days, shift_start, shift_end, notes)
select null, array[0]::smallint[], '09:00', '17:00',
       'Company ka default -- kisi branch ka apna schedule na ho to yehi lagta hai.'
where not exists (select 1 from hr_work_schedules where branch_id is null and is_active);

-- ---------------------------------------------------------------------
-- 3) Chhutti ke din (Eid, 14 August, waghera)
-- ---------------------------------------------------------------------
create table if not exists hr_holidays (
  id uuid primary key default uuid_generate_v4(),
  holiday_date date not null,
  name text not null,
  -- NULL = poori company. Kisi branch ki apni chhutti bhi ho sakti hai.
  branch_id uuid references branches(id) on delete cascade,
  is_paid boolean not null default true,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create unique index if not exists idx_holiday_unique
  on hr_holidays (holiday_date, coalesce(branch_id, '00000000-0000-0000-0000-000000000000'::uuid));

create index if not exists idx_holiday_date on hr_holidays (holiday_date);

alter table hr_holidays drop constraint if exists chk_holiday_name;
alter table hr_holidays add constraint chk_holiday_name
  check (length(btrim(name)) >= 2);

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
-- Parhna har staff ke liye khula: apna calendar dekhne ke liye bande ko
-- ye jaanna hi paRta hai ke us din chhutti thi. Badalna sirf HR/Admin.
alter table hr_work_schedules enable row level security;
alter table hr_holidays enable row level security;

do $$
declare t text;
begin
  foreach t in array array['hr_work_schedules', 'hr_holidays'] loop
    execute format('drop policy if exists staff_read_%s on public.%I', t, t);
    execute format(
      'create policy staff_read_%s on public.%I for select to authenticated using (public.fn_is_any_staff())', t, t);

    execute format('drop policy if exists hr_write_%s on public.%I', t, t);
    execute format($p$
      create policy hr_write_%s on public.%I for all to authenticated
      using (exists (select 1 from public.profiles p
                     where p.id = auth.uid() and p.is_active
                       and p.role::text in ('hr','admin','owner','super_admin')))
      with check (exists (select 1 from public.profiles p
                     where p.id = auth.uid() and p.is_active
                       and p.role::text in ('hr','admin','owner','super_admin')))
    $p$, t, t);
  end loop;
end;
$$;

comment on table hr_work_schedules is
  'Kaam ka waqt aur hafte ki chhutti. branch_id NULL = company ka default (231).';
comment on table hr_holidays is
  'Elaan shuda chhutti ke din. branch_id NULL = poori company (231).';
comment on column staff_details.reports_to is
  'Is bande ka afsar. Manager sirf apni is team ki hazri/chhutti manzoor kar sakta hai (231).';
