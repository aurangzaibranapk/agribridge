-- =====================================================================
-- AgriBridge — Migration 688: HR KPI Dashboard ka data (additive)
--
-- Malik ki manzoori (21 Oct 2026): HR dashboard reference tasveer jaisa.
-- Bharti chand din mein shuru -- har widget asal data se chale.
--
--   1. staff_details.gender (hire_date / exit_date / exit_reason pehle se hain)
--   2. job_applications: stage ki tareekhen (screened/interview/offer/hired)
--      -- status badalte hi trigger khud bharta hai (purana workflow bhi chale)
--   3. hr_training_records      (Technical / Soft skills / Leadership / Compliance)
--   4. hr_performance_reviews   (rating, period; maker-checker manzoori)
--   5. hr_pulse_responses       (1-5 mahana pulse; sirf ikattha nateeja, gumnaam)
--   6. hr_department_targets    (mahana target; maker-checker manzoori)
--   7. hr_kpi_audit             (har likhai ka hisaab)
--
-- Sab kuch ADDITIVE. Koi column/row delete nahi. Rollback: 688_*.rollback.sql
-- Likhai sirf RLS se: HR / Admin / Owner / super_admin (fn_hr_meetings_full_access).
-- =====================================================================

begin;

-- 1. Gender ------------------------------------------------------------
alter table public.staff_details add column if not exists gender text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'chk_staff_gender') then
    alter table public.staff_details add constraint chk_staff_gender
      check (gender is null or gender in ('male','female','other'));
  end if;
end $$;
create index if not exists idx_staff_details_hire_date on public.staff_details (hire_date);
create index if not exists idx_staff_details_exit_date on public.staff_details (exit_date);

-- 2. Bharti ke marhale ---------------------------------------------------
alter table public.job_applications add column if not exists screened_at timestamptz;
alter table public.job_applications add column if not exists interview_at timestamptz;
alter table public.job_applications add column if not exists offer_at timestamptz;
alter table public.job_applications add column if not exists hired_at timestamptz;
alter table public.job_applications add column if not exists rejected_at timestamptz;
alter table public.job_applications add column if not exists stage_changed_by uuid references public.profiles(id);
create index if not exists idx_job_applications_created on public.job_applications (created_at);
create index if not exists idx_job_applications_hired on public.job_applications (hired_at);

-- Status ka darja: pehle ke saare marhale bhi "guzre" maane jate hain.
create or replace function public.fn_job_app_stage_rank(p_status text) returns int
language sql immutable as $$
  select case p_status
    when 'pending' then 0 when 'under_review' then 0
    when 'eligible' then 1
    when 'interview_scheduled' then 2 when 'scored' then 2
    when 'offered' then 3 when 'accepted' then 3
    when 'joined' then 4
    else -1 end;
$$;

create or replace function public.fn_job_app_stage_stamp() returns trigger
language plpgsql set search_path = public as $$
declare r int := public.fn_job_app_stage_rank(new.status);
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;
  if r >= 1 and new.screened_at is null then new.screened_at := now(); end if;
  if r >= 2 and new.interview_at is null then new.interview_at := coalesce(new.interview_date::timestamptz, now()); end if;
  if r >= 3 and new.offer_at is null then new.offer_at := now(); end if;
  if r >= 4 and new.hired_at is null then new.hired_at := now(); end if;
  if new.status in ('rejected','not_eligible') and new.rejected_at is null then new.rejected_at := now(); end if;
  new.stage_changed_by := coalesce(auth.uid(), new.stage_changed_by);
  return new;
end $$;

drop trigger if exists trg_job_app_stage_stamp on public.job_applications;
create trigger trg_job_app_stage_stamp before insert or update of status on public.job_applications
  for each row execute function public.fn_job_app_stage_stamp();

-- Purani rows: jo marhala guzar chuka, us ki tareekh created_at (best effort).
update public.job_applications set
  screened_at  = coalesce(screened_at,  case when public.fn_job_app_stage_rank(status) >= 1 then created_at end),
  interview_at = coalesce(interview_at, case when public.fn_job_app_stage_rank(status) >= 2 then coalesce(interview_date::timestamptz, created_at) end),
  offer_at     = coalesce(offer_at,     case when public.fn_job_app_stage_rank(status) >= 3 then created_at end),
  hired_at     = coalesce(hired_at,     case when public.fn_job_app_stage_rank(status) >= 4 then created_at end)
where public.fn_job_app_stage_rank(status) >= 1
  and (screened_at is null or (public.fn_job_app_stage_rank(status) >= 4 and hired_at is null));

-- 3. Training ---------------------------------------------------------------
create table if not exists public.hr_training_records (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  training_type text not null check (training_type in ('technical','soft_skills','leadership','compliance')),
  title text not null check (length(trim(title)) between 2 and 200),
  training_date date not null,
  hours numeric(6,2) not null check (hours > 0 and hours <= 500),
  cost numeric(12,2) not null default 0 check (cost >= 0),
  notes text,
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_hr_training_date on public.hr_training_records (training_date);
create index if not exists idx_hr_training_profile on public.hr_training_records (profile_id);

-- 4. Performance reviews (maker-checker) -----------------------------------
create table if not exists public.hr_performance_reviews (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  period_month date not null check (extract(day from period_month) = 1),
  rating text not null check (rating in ('excellent','good','satisfactory','needs_improvement','poor')),
  comment text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid not null default auth.uid() references public.profiles(id),
  decided_by uuid references public.profiles(id),
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  unique (profile_id, period_month),
  constraint chk_perf_not_self check (reviewed_by <> profile_id),
  constraint chk_perf_checker check (decided_by is null or (decided_by <> reviewed_by and decided_by <> profile_id))
);
create index if not exists idx_hr_perf_period on public.hr_performance_reviews (period_month);

-- 5. Pulse survey (gumnaam ikattha) ------------------------------------------
create table if not exists public.hr_pulse_responses (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  period_month date not null check (extract(day from period_month) = 1),
  score smallint not null check (score between 1 and 5),
  created_at timestamptz not null default now(),
  unique (profile_id, period_month)
);
create index if not exists idx_hr_pulse_period on public.hr_pulse_responses (period_month);

-- 6. Department targets (maker-checker) -------------------------------------
create table if not exists public.hr_department_targets (
  id uuid primary key default gen_random_uuid(),
  department_key text not null,
  period_month date not null check (extract(day from period_month) = 1),
  target_amount numeric(14,2) not null check (target_amount > 0),
  actual_manual numeric(14,2) check (actual_manual is null or actual_manual >= 0),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_by uuid not null default auth.uid() references public.profiles(id),
  decided_by uuid references public.profiles(id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (department_key, period_month),
  constraint chk_target_checker check (decided_by is null or decided_by <> created_by)
);

-- 7. Audit ------------------------------------------------------------------
create table if not exists public.hr_kpi_audit (
  id bigserial primary key,
  table_name text not null,
  row_id uuid,
  action text not null,
  actor uuid,
  old_row jsonb,
  new_row jsonb,
  at timestamptz not null default now()
);
create or replace function public.fn_hr_kpi_audit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into hr_kpi_audit(table_name, row_id, action, actor, old_row, new_row)
  values (tg_table_name,
          case when tg_table_name = 'hr_pulse_responses' then null when tg_op = 'DELETE' then old.id else new.id end,
          tg_op, auth.uid(),
          case when tg_op <> 'INSERT' and tg_table_name <> 'hr_pulse_responses' then to_jsonb(old) end,
          -- Pulse: score audit mein nahi -- gumnaami.
          case when tg_op <> 'DELETE' then
            case when tg_table_name = 'hr_pulse_responses' then to_jsonb(new) - 'score' - 'profile_id' else to_jsonb(new) end
          end);
  return coalesce(new, old);
end $$;
do $$ declare t text; begin
  foreach t in array array['hr_training_records','hr_performance_reviews','hr_department_targets','hr_pulse_responses'] loop
    execute format('drop trigger if exists trg_%1$s_audit on public.%1$s', t);
    execute format('create trigger trg_%1$s_audit after insert or update or delete on public.%1$s for each row execute function public.fn_hr_kpi_audit()', t);
  end loop;
end $$;

-- Gender / joining / exit badalne ka audit (staff_details)
create or replace function public.fn_staff_hr_fields_audit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.gender, new.hire_date, new.exit_date, new.exit_reason) is distinct from (old.gender, old.hire_date, old.exit_date, old.exit_reason) then
    insert into hr_kpi_audit(table_name, row_id, action, actor, old_row, new_row)
    values ('staff_details', new.id, 'UPDATE', auth.uid(),
      jsonb_build_object('gender', old.gender, 'hire_date', old.hire_date, 'exit_date', old.exit_date, 'exit_reason', old.exit_reason),
      jsonb_build_object('gender', new.gender, 'hire_date', new.hire_date, 'exit_date', new.exit_date, 'exit_reason', new.exit_reason));
  end if;
  return new;
end $$;
drop trigger if exists trg_staff_hr_fields_audit on public.staff_details;
create trigger trg_staff_hr_fields_audit after update on public.staff_details
  for each row execute function public.fn_staff_hr_fields_audit();

-- Maker-checker: manzoori sirf HR/Admin/Owner, aur khud ki entry nahi.
-- Manzoori ke baad sirf decision_note aur (target ka) actual_manual badal sakta hai -- audit mein darj.
create or replace function public.fn_hr_kpi_decide_guard() returns trigger
language plpgsql set search_path = public as $$
declare maker uuid;
begin
  if new.status is distinct from old.status then
    if old.status <> 'pending' then raise exception 'Faisla ho chuka -- dobara nahi badla ja sakta'; end if;
    maker := coalesce(to_jsonb(old)->>'reviewed_by', to_jsonb(old)->>'created_by')::uuid;
    if auth.uid() is not null and auth.uid() = maker then raise exception 'Apni entry khud manzoor nahi kar sakte (maker-checker)'; end if;
    new.decided_by := coalesce(auth.uid(), new.decided_by);
    new.decided_at := now();
  elsif old.status <> 'pending' and (to_jsonb(new) - 'decision_note' - 'actual_manual') is distinct from (to_jsonb(old) - 'decision_note' - 'actual_manual') then
    raise exception 'Manzoor/rad shuda entry badli nahi ja sakti';
  end if;
  return new;
end $$;
drop trigger if exists trg_hr_perf_decide on public.hr_performance_reviews;
create trigger trg_hr_perf_decide before update on public.hr_performance_reviews
  for each row execute function public.fn_hr_kpi_decide_guard();
drop trigger if exists trg_hr_target_decide on public.hr_department_targets;
create trigger trg_hr_target_decide before update on public.hr_department_targets
  for each row execute function public.fn_hr_kpi_decide_guard();

-- 8. Tankhwah ki due date (On-time payment %) --------------------------------
-- Mahina M ki tankhwah agle mahine ki is tareekh tak deni hai. Default 10.
alter table public.hr_payroll_settings add column if not exists salary_due_day int not null default 10;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'chk_salary_due_day') then
    alter table public.hr_payroll_settings add constraint chk_salary_due_day check (salary_due_day between 1 and 28);
  end if;
end $$;

-- RLS ----------------------------------------------------------------------
alter table public.hr_training_records enable row level security;
alter table public.hr_performance_reviews enable row level security;
alter table public.hr_pulse_responses enable row level security;
alter table public.hr_department_targets enable row level security;
alter table public.hr_kpi_audit enable row level security;

drop policy if exists hr_training_all on public.hr_training_records;
create policy hr_training_all on public.hr_training_records for all to authenticated
  using (public.fn_hr_meetings_full_access()) with check (public.fn_hr_meetings_full_access());
drop policy if exists hr_training_own on public.hr_training_records;
create policy hr_training_own on public.hr_training_records for select to authenticated
  using (profile_id = auth.uid());

drop policy if exists hr_perf_select on public.hr_performance_reviews;
create policy hr_perf_select on public.hr_performance_reviews for select to authenticated
  using (public.fn_hr_meetings_full_access() or (profile_id = auth.uid() and status = 'approved'));
drop policy if exists hr_perf_insert on public.hr_performance_reviews;
create policy hr_perf_insert on public.hr_performance_reviews for insert to authenticated
  with check (public.fn_hr_meetings_full_access() and reviewed_by = auth.uid() and status = 'pending');
drop policy if exists hr_perf_update on public.hr_performance_reviews;
create policy hr_perf_update on public.hr_performance_reviews for update to authenticated
  using (public.fn_hr_meetings_full_access()) with check (public.fn_hr_meetings_full_access());

drop policy if exists hr_target_select on public.hr_department_targets;
create policy hr_target_select on public.hr_department_targets for select to authenticated
  using (public.fn_hr_meetings_full_access());
drop policy if exists hr_target_insert on public.hr_department_targets;
create policy hr_target_insert on public.hr_department_targets for insert to authenticated
  with check (public.fn_hr_meetings_full_access() and created_by = auth.uid() and status = 'pending');
drop policy if exists hr_target_update on public.hr_department_targets;
create policy hr_target_update on public.hr_department_targets for update to authenticated
  using (public.fn_hr_meetings_full_access()) with check (public.fn_hr_meetings_full_access());

-- Pulse: har staff sirf apna jawab daal sake; parhna KISI ko nahi (sirf ikattha function).
drop policy if exists hr_pulse_insert on public.hr_pulse_responses;
create policy hr_pulse_insert on public.hr_pulse_responses for insert to authenticated
  with check (profile_id = auth.uid() and public.fn_is_any_staff());
drop policy if exists hr_pulse_own on public.hr_pulse_responses;
create policy hr_pulse_own on public.hr_pulse_responses for select to authenticated
  using (profile_id = auth.uid());

drop policy if exists hr_kpi_audit_select on public.hr_kpi_audit;
create policy hr_kpi_audit_select on public.hr_kpi_audit for select to authenticated
  using (public.fn_hr_meetings_full_access());

-- Ikattha pulse: kam se kam 3 jawab ho to hi nateeja (gumnaami).
create or replace function public.fn_hr_pulse_summary(p_from date, p_to date)
returns table (period_month date, responses int, avg_score numeric, engaged int)
language sql stable security definer set search_path = public as $$
  select r.period_month, count(*)::int, round(avg(r.score)::numeric, 2), count(*) filter (where r.score >= 4)::int
  from hr_pulse_responses r
  where public.fn_hr_meetings_full_access()
    and r.period_month between date_trunc('month', p_from)::date and date_trunc('month', p_to)::date
  group by r.period_month
  having count(*) >= 3
  order by r.period_month;
$$;
revoke all on function public.fn_hr_pulse_summary(date, date) from public, anon;
grant execute on function public.fn_hr_pulse_summary(date, date) to authenticated;

revoke all on public.hr_training_records, public.hr_performance_reviews, public.hr_pulse_responses,
  public.hr_department_targets, public.hr_kpi_audit from anon;

commit;
