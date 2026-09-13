-- =====================================================================
-- AgriBridge — Migration 232: Hazri ka record kabhi chupke se nahi badalta
-- =====================================================================
-- Aaj tak hazri is tarah likhi jati thi:
--
--     .upsert({...}, { onConflict: "profile_id,attendance_date" })
--
-- Yani: agar us din ka record pehle se maujood tha, to naya record
-- purane par LIKH kar guzar jata tha. Purana kya tha, kis ne badla,
-- kyun badla -- teenon sawalon ka jawab kahin nahi bachta tha.
--
-- Aur staff_own_attendance policy "for all" thi: banda apni hazri KHUD
-- badal bhi sakta tha aur MITA bhi sakta tha. Yani hazri ka record us
-- bande ke haath mein tha jis ke khilaf wo saboot tha.
--
-- Ye migration teen taale lagati hai:
--
--   1. HAR tabdeeli attendance_audit mein girti hai -- purani qeemat,
--      nayi qeemat, kis ne, kab, kyun. Trigger se, code se nahi: code
--      bhoolta hai, trigger nahi.
--
--   2. MITANA band. Kisi ke paas delete ki policy nahi. Chhutti wapas
--      lene ka purana raasta (134) ab SECURITY DEFINER se guzarta hai,
--      is liye wo chalta rehta hai -- magar bas wohi.
--
--   3. Banda apni hazri khud NAHI badal sakta. Sirf lagata hai
--      (check-in/out). Badalne ke liye darkhwast deni paRti hai, jo
--      us ke afsar ke paas jati hai.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Naye khaane
-- ---------------------------------------------------------------------
alter table attendance_records
  -- Offline: waqia jab hua (check_in_at) aur server tak jab pahuncha
  -- (synced_at) -- do alag cheezein. Ek hi khaane mein dono rakhna
  -- ye chhupa deta hai ke record ghante baad aaya tha.
  add column if not exists synced_at timestamptz,
  add column if not exists is_offline boolean not null default false,
  add column if not exists late_minutes int,
  add column if not exists work_minutes int,
  add column if not exists last_changed_by uuid references profiles(id),
  add column if not exists last_change_reason text,
  add column if not exists updated_at timestamptz not null default now();

alter table attendance_records drop constraint if exists attendance_records_source_check;
alter table attendance_records add constraint attendance_records_source_check
  check (source in ('web', 'pwa', 'whatsapp', 'biometric', 'correction', 'offline', 'leave'));

-- Haath se badla gaya record bina wajah ke nahi reh sakta.
alter table attendance_records drop constraint if exists chk_attendance_correction_reason;
alter table attendance_records add constraint chk_attendance_correction_reason
  check (source <> 'correction' or length(btrim(coalesce(last_change_reason, ''))) >= 5);

-- ---------------------------------------------------------------------
-- 2) Audit -- har tabdeeli ka nishan
-- ---------------------------------------------------------------------
create table if not exists attendance_audit (
  id bigserial primary key,
  attendance_id uuid,
  profile_id uuid not null,
  attendance_date date not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  old_value jsonb,
  new_value jsonb,
  changed_fields text[],
  reason text,
  changed_by uuid references profiles(id),
  changed_at timestamptz not null default now()
);

create index if not exists idx_att_audit_person
  on attendance_audit (profile_id, attendance_date desc);
create index if not exists idx_att_audit_time
  on attendance_audit (changed_at desc);

create or replace function fn_attendance_audit()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_fields text[];
  v_actor uuid;
begin
  begin
    v_actor := auth.uid();
  exception when others then
    v_actor := null;
  end;

  if tg_op = 'DELETE' then
    v_old := to_jsonb(old);
    insert into attendance_audit (attendance_id, profile_id, attendance_date, action,
                                  old_value, new_value, changed_fields, reason, changed_by)
    values (old.id, old.profile_id, old.attendance_date, 'delete',
            v_old, null, null, old.last_change_reason, v_actor);
    return old;
  end if;

  v_new := to_jsonb(new);

  if tg_op = 'INSERT' then
    insert into attendance_audit (attendance_id, profile_id, attendance_date, action,
                                  old_value, new_value, changed_fields, reason, changed_by)
    values (new.id, new.profile_id, new.attendance_date, 'insert',
            null, v_new, null, new.last_change_reason, coalesce(new.last_changed_by, v_actor));
    return new;
  end if;

  v_old := to_jsonb(old);

  -- Sirf wo khaane jinhen waqai badla gaya. Bina is ke har chhoti si
  -- update poora record dobara likhwa deti hai aur audit padhne layak
  -- nahi rehta.
  select array_agg(k order by k) into v_fields
  from jsonb_object_keys(v_new) k
  where k not in ('updated_at')
    and (v_old -> k) is distinct from (v_new -> k);

  if v_fields is null then
    return new;
  end if;

  insert into attendance_audit (attendance_id, profile_id, attendance_date, action,
                                old_value, new_value, changed_fields, reason, changed_by)
  values (new.id, new.profile_id, new.attendance_date, 'update',
          v_old, v_new, v_fields, new.last_change_reason,
          coalesce(new.last_changed_by, v_actor));

  return new;
end;
$$;

drop trigger if exists trg_attendance_audit on attendance_records;
create trigger trg_attendance_audit
  after insert or update or delete on attendance_records
  for each row execute function fn_attendance_audit();

-- updated_at khud chalta rahe.
create or replace function fn_attendance_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_attendance_touch on attendance_records;
create trigger trg_attendance_touch
  before update on attendance_records
  for each row execute function fn_attendance_touch();

-- ---------------------------------------------------------------------
-- 3) Darkhwast: hazri theek karwana
-- ---------------------------------------------------------------------
-- Spec ka raasta:
--   Missing -> Staff Request -> Direct Manager -> Comment (lazmi)
--   -> Approve / Reject / Send Back -> Hazri update -> Audit Log
create table if not exists attendance_corrections (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references profiles(id) on delete cascade,
  attendance_date date not null,

  -- Banda kya maang raha hai
  requested_status attendance_status not null,
  requested_check_in time,
  requested_check_out time,
  reason text not null,

  -- Us waqt record kya tha (darkhwast ke waqt ka aks). Baad mein record
  -- badal jaye to bhi ye sach rehta hai.
  original_snapshot jsonb,

  status text not null default 'pending',
  -- Kis afsar ke paas gayi. Darkhwast ke waqt ka reports_to -- baad
  -- mein afsar badal jaye to purani darkhwast ka rasta nahi badalta.
  manager_id uuid references profiles(id),
  manager_comment text,
  decided_by uuid references profiles(id),
  decided_at timestamptz,

  applied_at timestamptz,
  created_at timestamptz not null default now(),

  constraint chk_corr_status
    check (status in ('pending', 'approved', 'rejected', 'sent_back', 'cancelled')),
  -- Wajah lazmi. "Theek kar dein" likh kar guzar jana is table ko
  -- bemani kar deta hai.
  constraint chk_corr_reason check (length(btrim(reason)) >= 5),
  -- Faisla karne wale ka comment bhi LAZMI hai -- spec ka saaf hukm.
  constraint chk_corr_decision check (
    status in ('pending', 'cancelled')
    or (decided_by is not null
        and decided_at is not null
        and length(btrim(coalesce(manager_comment, ''))) >= 5)
  ),
  constraint chk_corr_times check (
    requested_check_out is null
    or requested_check_in is null
    or requested_check_out > requested_check_in
  )
);

-- Ek din par ek hi zinda darkhwast.
create unique index if not exists idx_corr_one_open
  on attendance_corrections (profile_id, attendance_date)
  where status in ('pending', 'sent_back');

create index if not exists idx_corr_manager
  on attendance_corrections (manager_id, status, attendance_date desc);
create index if not exists idx_corr_person
  on attendance_corrections (profile_id, attendance_date desc);

-- ---------------------------------------------------------------------
-- 4) Mahine ka taala (payroll ke liye)
-- ---------------------------------------------------------------------
-- Payroll sirf BAND mahine ki hazri par bane. Khula mahina matlab
-- darkhwastein abhi zer-e-ghaur hain -- us par tankhwah banana wohi
-- ghalti hai jo pehle ho chuki hai.
create table if not exists attendance_month_locks (
  id uuid primary key default uuid_generate_v4(),
  branch_id uuid references branches(id) on delete cascade,
  lock_year int not null,
  lock_month int not null check (lock_month between 1 and 12),
  locked_at timestamptz not null default now(),
  locked_by uuid references profiles(id),
  note text,
  reopened_at timestamptz,
  reopened_by uuid references profiles(id),
  reopen_reason text,

  -- Kholne ki wajah lazmi hai. Band mahina bila wajah khulna hi wo
  -- darwaza hai jis se hisaab badla jata hai.
  constraint chk_lock_reopen check (
    reopened_at is null or length(btrim(coalesce(reopen_reason, ''))) >= 5
  )
);

create unique index if not exists idx_month_lock_open
  on attendance_month_locks (
    coalesce(branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lock_year, lock_month
  )
  where reopened_at is null;

-- ---------------------------------------------------------------------
-- 5) Chhutti ki darkhwast -- spec ke mutabiq
-- ---------------------------------------------------------------------
alter table leave_requests
  add column if not exists is_half_day boolean not null default false,
  add column if not exists manager_comment text,
  add column if not exists manager_id uuid references profiles(id);

alter table leave_requests drop constraint if exists leave_status_check;
alter table leave_requests add constraint leave_status_check
  check (status in ('pending', 'approved', 'rejected', 'sent_back', 'cancelled'));

alter table leave_requests drop constraint if exists leave_decided_by;
alter table leave_requests add constraint leave_decided_by
  check (
    status in ('pending', 'cancelled', 'sent_back')
    or (decided_by is not null and decided_at is not null)
  );

-- Aadha din sirf ek hi din ka ho sakta hai.
alter table leave_requests drop constraint if exists chk_leave_half_day_single;
alter table leave_requests add constraint chk_leave_half_day_single
  check (not is_half_day or from_date = to_date);

-- ---------------------------------------------------------------------
-- 6) Chhutti wala purana raasta ab taale ke peeche se guzarta hai
-- ---------------------------------------------------------------------
-- Neeche hum attendance_records par delete ki policy khatam kar rahe
-- hain. 134 ka trigger chhutti wapas lene par qatarein hatata hai --
-- wo kaam jaari rehna chahiye. Is liye us function ko SECURITY DEFINER
-- bana rahe hain: raasta ek hi rehta hai, aur wo hamare qaboo mein hai.
create or replace function fn_leave_to_attendance()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  d date;
begin
  if new.status = 'approved' and coalesce(old.status, '') <> 'approved' then
    d := new.from_date;
    while d <= new.to_date loop
      insert into attendance_records (profile_id, attendance_date, status, source, notes)
      values (new.profile_id, d,
              case when new.is_half_day then 'half_day'::attendance_status
                   else 'leave'::attendance_status end,
              'leave', 'Chhutti manzoor: ' || new.reason)
      on conflict (profile_id, attendance_date) do update
        set status = case when attendance_records.source = 'leave'
                          then excluded.status else attendance_records.status end,
            notes  = case when attendance_records.source = 'leave'
                          then excluded.notes else attendance_records.notes end;
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

-- ---------------------------------------------------------------------
-- 7) RLS -- ab "for all" nahi
-- ---------------------------------------------------------------------
drop policy if exists staff_own_attendance on attendance_records;
drop policy if exists admin_manage_attendance on attendance_records;

-- Parhna: apni hazri, apni team ki hazri, ya HR/Admin ho to sab ki.
drop policy if exists attendance_read on attendance_records;
create policy attendance_read on attendance_records for select to authenticated
using (
  profile_id = auth.uid()
  or exists (select 1 from staff_details sd
             where sd.profile_id = attendance_records.profile_id
               and sd.reports_to = auth.uid())
  or exists (select 1 from profiles p
             where p.id = auth.uid() and p.is_active
               and p.role::text in ('hr','manager','admin','owner','super_admin'))
);

-- Lagana: apni hazri khud lagayi ja sakti hai (check-in), ya HR/Admin
-- kisi ki bhi.
drop policy if exists attendance_insert on attendance_records;
create policy attendance_insert on attendance_records for insert to authenticated
with check (
  profile_id = auth.uid()
  or exists (select 1 from profiles p
             where p.id = auth.uid() and p.is_active
               and p.role::text in ('hr','manager','admin','owner','super_admin'))
);

-- Badalna: apna sirf check-out ka waqt (jo neeche wale trigger se
-- mehdood hai), warna sirf HR/Admin/Manager.
drop policy if exists attendance_update on attendance_records;
create policy attendance_update on attendance_records for update to authenticated
using (
  profile_id = auth.uid()
  or exists (select 1 from profiles p
             where p.id = auth.uid() and p.is_active
               and p.role::text in ('hr','manager','admin','owner','super_admin'))
)
with check (
  profile_id = auth.uid()
  or exists (select 1 from profiles p
             where p.id = auth.uid() and p.is_active
               and p.role::text in ('hr','manager','admin','owner','super_admin'))
);

-- MITANE ki koi policy nahi -- yani koi mita nahi sakta. Chhutti wala
-- raasta oopar SECURITY DEFINER se guzarta hai, is liye wo chalta hai.

-- Banda apni hazri ka DARJA khud nahi badal sakta. Sirf check-out ka
-- waqt aur location. Is ke baghair upar wali update policy us ko apni
-- ghair-haziri ko "hazir" likhne ki ijazat de deti.
create or replace function fn_attendance_self_edit_guard()
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

  -- Server ki taraf se (service role) ya trigger ke andar se aaya --
  -- us par ye rok nahi.
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

drop trigger if exists trg_attendance_self_edit_guard on attendance_records;
create trigger trg_attendance_self_edit_guard
  before update on attendance_records
  for each row execute function fn_attendance_self_edit_guard();

-- ---------------------------------------------------------------------
-- 8) Naye tables ki RLS
-- ---------------------------------------------------------------------
alter table attendance_audit enable row level security;
alter table attendance_corrections enable row level security;
alter table attendance_month_locks enable row level security;

-- Audit: parha ja sakta hai, likha nahi. Likhna sirf trigger karta hai
-- (SECURITY DEFINER), is liye kisi ko insert/update/delete ki policy
-- dene ki zaroorat hi nahi.
drop policy if exists audit_read on attendance_audit;
create policy audit_read on attendance_audit for select to authenticated
using (
  profile_id = auth.uid()
  or exists (select 1 from profiles p
             where p.id = auth.uid() and p.is_active
               and p.role::text in ('hr','manager','admin','owner','super_admin'))
);

drop policy if exists corr_read on attendance_corrections;
create policy corr_read on attendance_corrections for select to authenticated
using (
  profile_id = auth.uid()
  or manager_id = auth.uid()
  or exists (select 1 from profiles p
             where p.id = auth.uid() and p.is_active
               and p.role::text in ('hr','admin','owner','super_admin'))
);

drop policy if exists corr_insert on attendance_corrections;
create policy corr_insert on attendance_corrections for insert to authenticated
with check (
  profile_id = auth.uid()
  or exists (select 1 from profiles p
             where p.id = auth.uid() and p.is_active
               and p.role::text in ('hr','admin','owner','super_admin'))
);

-- Faisla: sirf wo afsar jis ke paas darkhwast aayi, ya HR/Admin. Aur
-- apni darkhwast koi khud manzoor nahi kar sakta -- chahe wo khud HR ho.
drop policy if exists corr_decide on attendance_corrections;
create policy corr_decide on attendance_corrections for update to authenticated
using (
  attendance_corrections.profile_id <> auth.uid()
  and (
    manager_id = auth.uid()
    or exists (select 1 from profiles p
               where p.id = auth.uid() and p.is_active
                 and p.role::text in ('hr','admin','owner','super_admin'))
  )
);

drop policy if exists lock_read on attendance_month_locks;
create policy lock_read on attendance_month_locks for select to authenticated
using (public.fn_is_any_staff());

drop policy if exists lock_write on attendance_month_locks;
create policy lock_write on attendance_month_locks for all to authenticated
using (exists (select 1 from profiles p
               where p.id = auth.uid() and p.is_active
                 and p.role::text in ('hr','admin','owner','super_admin')))
with check (exists (select 1 from profiles p
               where p.id = auth.uid() and p.is_active
                 and p.role::text in ('hr','admin','owner','super_admin')));

comment on table attendance_audit is
  'Hazri ki har tabdeeli -- purani qeemat, nayi qeemat, kis ne, kyun. Trigger se bharta hai (232).';
comment on table attendance_corrections is
  'Hazri theek karwane ki darkhwast. Afsar ka comment lazmi hai (232).';
comment on table attendance_month_locks is
  'Band mahina. Payroll sirf band mahine par banta hai; kholne ki wajah lazmi (232).';
