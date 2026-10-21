-- 691: Bharti ki offer -> tankhwah ka dhancha -> barhotri -> salary slip.
-- Malik ka manzoor shuda design (salary-offer mockups 1-6).
-- Sirf additive: naye columns, naya table, naya view, nayi functions.
-- 689 reserved hai, 690 doosre kaam ke liye chhoda gaya. Live par abhi NAHI.
-- Live se pehle backup:
--   create table backups.job_offers_pre691 as table public.job_offers;
--   create table backups.staff_details_pre691 as table public.staff_details;
--   create table backups.staff_salary_structures_pre691 as table public.staff_salary_structures;
--   create table backups.payroll_lines_pre691 as table public.payroll_lines;

-- ---------------------------------------------------------------------
-- 0. Kaun offer bana / badal sakta hai (HR + Admin + Owner)
-- ---------------------------------------------------------------------
create or replace function public.fn_hr_offer_writer()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select p.role::text in ('hr','admin','owner','super_admin')
                     from public.profiles p where p.id = auth.uid() and p.is_active), false)
$$;
revoke execute on function public.fn_hr_offer_writer() from public, anon;
grant execute on function public.fn_hr_offer_writer() to authenticated;

-- ---------------------------------------------------------------------
-- 1. job_offers: hissay-war offer, naye status, qubool shuda kul
-- ---------------------------------------------------------------------
alter table public.job_offers add column if not exists basic numeric(12,2) check (basic is null or basic >= 0);
alter table public.job_offers add column if not exists house_rent numeric(12,2) check (house_rent is null or house_rent >= 0);
alter table public.job_offers add column if not exists travel numeric(12,2) check (travel is null or travel >= 0);
alter table public.job_offers add column if not exists mobile numeric(12,2) check (mobile is null or mobile >= 0);
alter table public.job_offers add column if not exists bonus text;
alter table public.job_offers add column if not exists incentive_pct numeric(6,3) check (incentive_pct is null or (incentive_pct >= 0 and incentive_pct <= 100));
alter table public.job_offers add column if not exists incentive_rule text;
alter table public.job_offers add column if not exists probation_months int check (probation_months is null or probation_months between 0 and 24);
alter table public.job_offers add column if not exists joining_date date;
alter table public.job_offers add column if not exists accepted_total numeric(12,2);
alter table public.job_offers add column if not exists accepted_at timestamptz;
alter table public.job_offers add column if not exists superseded_by uuid references public.job_offers(id) on delete set null;
alter table public.job_offers add column if not exists created_by uuid default auth.uid() references public.profiles(id) on delete set null;

-- Status mein 'countered' aur 'withdrawn' ka izafa (purane teeno wese hi).
do $$
declare c text;
begin
  for c in select conname from pg_constraint
            where conrelid = 'public.job_offers'::regclass and contype = 'c'
              and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.job_offers drop constraint %I', c);
  end loop;
end $$;
alter table public.job_offers add constraint job_offers_status_check
  check (status in ('pending','accepted','rejected','countered','withdrawn'));

-- Offer ka mahana kul: hissay hon to un ka jor, warna purani proposed_salary.
create or replace function public.fn_job_offer_total(o public.job_offers)
returns numeric language sql immutable set search_path = '' as $$
  select case when coalesce(o.basic,0) + coalesce(o.house_rent,0) + coalesce(o.travel,0) + coalesce(o.mobile,0) > 0
              then coalesce(o.basic,0) + coalesce(o.house_rent,0) + coalesce(o.travel,0) + coalesce(o.mobile,0)
              else o.proposed_salary end
$$;

-- ---------------------------------------------------------------------
-- 2. job_offer_events: mol-tol ki tareekh (sirf izafa, kabhi mitti nahi)
-- ---------------------------------------------------------------------
create table if not exists public.job_offer_events (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.job_offers(id) on delete cascade,
  application_id uuid not null references public.job_applications(id) on delete cascade,
  kind text not null check (kind in ('sent','countered','revised','accepted','rejected','withdrawn')),
  basic numeric(12,2), house_rent numeric(12,2), travel numeric(12,2), mobile numeric(12,2),
  bonus text, incentive_pct numeric(6,3), incentive_rule text,
  total numeric(12,2),
  note text,
  via text not null default 'admin' check (via in ('admin','public_link','system')),
  actor uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_job_offer_events_app on public.job_offer_events(application_id, created_at);

create or replace function public.fn_guard_job_offer_events()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Offer ki tareekh badli ya mitaayi nahi ja sakti.';
end $$;
drop trigger if exists trg_guard_job_offer_events on public.job_offer_events;
create trigger trg_guard_job_offer_events before update or delete on public.job_offer_events
  for each row when (pg_trigger_depth() = 0) execute function public.fn_guard_job_offer_events();

-- Qubool / rad / wapas: kul aur tareekh khud lagti hai, event khud darj hota hai
-- (admin se ho ya public link se).
create or replace function public.fn_job_offer_status_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = old.status then return new; end if;
  if new.status = 'accepted' then
    new.accepted_total := coalesce(new.accepted_total, public.fn_job_offer_total(new));
    new.accepted_at := coalesce(new.accepted_at, now());
  end if;
  if new.status in ('accepted','rejected','withdrawn') then
    insert into public.job_offer_events (offer_id, application_id, kind, basic, house_rent, travel, mobile,
                                         bonus, incentive_pct, incentive_rule, total, via, actor)
    values (new.id, new.application_id, new.status, new.basic, new.house_rent, new.travel, new.mobile,
            new.bonus, new.incentive_pct, new.incentive_rule,
            case when new.status = 'accepted' then new.accepted_total else public.fn_job_offer_total(new) end,
            case when auth.uid() is null then 'public_link' else 'admin' end, auth.uid());
  end if;
  return new;
end $$;
drop trigger if exists trg_job_offer_status_event on public.job_offers;
create trigger trg_job_offer_status_event before update of status on public.job_offers
  for each row execute function public.fn_job_offer_status_event();

alter table public.job_offer_events enable row level security;
drop policy if exists job_offer_events_read on public.job_offer_events;
create policy job_offer_events_read on public.job_offer_events for select to authenticated
  using (public.fn_hr_offer_writer());
drop policy if exists job_offer_events_insert on public.job_offer_events;
create policy job_offer_events_insert on public.job_offer_events for insert to authenticated
  with check (public.fn_hr_offer_writer() and actor = auth.uid() and via = 'admin');

-- HR bhi offer bana/badal sake (pehle sirf Admin/Owner). Mitana phir bhi Admin ka.
drop policy if exists job_offers_hr_read on public.job_offers;
create policy job_offers_hr_read on public.job_offers for select to authenticated using (public.fn_hr_offer_writer());
drop policy if exists job_offers_hr_insert on public.job_offers;
create policy job_offers_hr_insert on public.job_offers for insert to authenticated with check (public.fn_hr_offer_writer());
drop policy if exists job_offers_hr_update on public.job_offers;
create policy job_offers_hr_update on public.job_offers for update to authenticated
  using (public.fn_hr_offer_writer()) with check (public.fn_hr_offer_writer());

-- ---------------------------------------------------------------------
-- 3. staff_details: offer se rishta + slip ki maloomat
-- ---------------------------------------------------------------------
alter table public.staff_details add column if not exists offer_id uuid references public.job_offers(id) on delete set null;
alter table public.staff_details add column if not exists application_id uuid references public.job_applications(id) on delete set null;
alter table public.staff_details add column if not exists father_name text;
alter table public.staff_details add column if not exists bank_name text;
alter table public.staff_details add column if not exists department text;
alter table public.staff_details add column if not exists next_increment_due date;

-- Apni offer, apni barhotri ki tareekh ya bank khud nahi badalte.
create or replace function public.fn_staff_details_offer_self_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or new.profile_id <> auth.uid() then return new; end if;
  if tg_op = 'INSERT' then
    if new.offer_id is not null or new.application_id is not null or new.next_increment_due is not null then
      raise exception 'Apni offer ya barhotri ki tareekh khud nahi likhi ja sakti.';
    end if;
    return new;
  end if;
  if new.offer_id is distinct from old.offer_id or new.application_id is distinct from old.application_id
     or new.next_increment_due is distinct from old.next_increment_due
     or new.bank_name is distinct from old.bank_name or new.bank_account is distinct from old.bank_account then
    raise exception 'Apni offer, barhotri ki tareekh ya bank khata khud nahi badla ja sakta -- HR se kahein.';
  end if;
  return new;
end $$;
drop trigger if exists trg_staff_details_offer_self_guard on public.staff_details;
create trigger trg_staff_details_offer_self_guard before insert or update on public.staff_details
  for each row execute function public.fn_staff_details_offer_self_guard();

-- ---------------------------------------------------------------------
-- 4. staff_salary_structures: offer se, barhotri ka hisaab
-- ---------------------------------------------------------------------
alter table public.staff_salary_structures add column if not exists source_offer_id uuid references public.job_offers(id) on delete set null;
alter table public.staff_salary_structures add column if not exists change_reason text
  check (change_reason is null or change_reason in ('joining','annual','performance','promotion','inflation','correction'));
alter table public.staff_salary_structures add column if not exists prev_structure_id uuid references public.staff_salary_structures(id) on delete set null;
alter table public.staff_salary_structures add column if not exists increment_amount numeric(12,2);
alter table public.staff_salary_structures add column if not exists increment_pct numeric(7,3);

-- Naye draft par pichla manzoor structure aur farq khud bharta hai.
create or replace function public.fn_salary_structure_increment_fill()
returns trigger language plpgsql security definer set search_path = '' as $$
declare prev public.staff_salary_structures;
begin
  if new.prev_structure_id is null then
    select * into prev from public.staff_salary_structures
     where profile_id = new.profile_id and status = 'approved' and effective_from <= new.effective_from
     order by effective_from desc, approved_at desc limit 1;
    new.prev_structure_id := prev.id;
  else
    select * into prev from public.staff_salary_structures where id = new.prev_structure_id;
    if prev.profile_id is distinct from new.profile_id then
      raise exception 'Pichla structure isi staff ka hona chahiye.';
    end if;
  end if;
  if prev.id is not null then
    new.increment_amount := new.basic - prev.basic;
    new.increment_pct := case when prev.basic > 0 then round((new.basic - prev.basic) / prev.basic * 100, 3) end;
    new.change_reason := coalesce(new.change_reason, 'annual');
  else
    new.increment_amount := null; new.increment_pct := null;
    new.change_reason := coalesce(new.change_reason, 'joining');
  end if;
  if new.source_offer_id is not null and not exists (
       select 1 from public.job_offers o where o.id = new.source_offer_id and o.status = 'accepted') then
    raise exception 'Sirf qubool shuda offer se structure banta hai.';
  end if;
  return new;
end $$;
drop trigger if exists trg_salary_structure_increment_fill on public.staff_salary_structures;
create trigger trg_salary_structure_increment_fill before insert on public.staff_salary_structures
  for each row execute function public.fn_salary_structure_increment_fill();

-- Manzoori par agli barhotri ki tareekh: joining/saalana se ek saal baad.
create or replace function public.fn_salary_structure_next_due()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'approved' and old.status = 'draft' then
    update public.staff_details
       set next_increment_due = case
             when new.change_reason in ('joining','annual','performance','promotion')
               then (new.effective_from + interval '1 year')::date
             else next_increment_due end,
           offer_id = coalesce(offer_id, new.source_offer_id),
           application_id = coalesce(application_id, (select o.application_id from public.job_offers o where o.id = new.source_offer_id))
     where profile_id = new.profile_id;
  end if;
  return new;
end $$;
drop trigger if exists trg_salary_structure_next_due on public.staff_salary_structures;
create trigger trg_salary_structure_next_due after update of status on public.staff_salary_structures
  for each row execute function public.fn_salary_structure_next_due();

-- Qubool offer se DRAFT structure. Maker-checker wahi: banane wala manzoor
-- nahi kar sakta (fn_salary_structure_decide), apna khud nahi banta (682).
create or replace function public.fn_salary_structure_from_offer(p_profile uuid, p_offer uuid, p_effective date default null)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare o public.job_offers; v_id uuid; c record;
begin
  if not public.fn_payroll_is_writer() then raise exception 'Sirf HR, Finance, Admin ya Owner.'; end if;
  if p_profile = auth.uid() then raise exception 'Apni tankhwah ka structure khud nahi banaya ja sakta.'; end if;
  select * into o from public.job_offers where id = p_offer;
  if not found or o.status <> 'accepted' then raise exception 'Qubool shuda offer nahi mili.'; end if;
  if coalesce(o.basic, 0) <= 0 then raise exception 'Offer mein basic nahi -- pehle hissay darj karein.'; end if;
  insert into public.staff_salary_structures (profile_id, basic, effective_from, notes, created_by, source_offer_id, change_reason)
  values (p_profile, o.basic, coalesce(p_effective, o.joining_date, current_date),
          'Offer #' || upper(left(o.id::text, 8)) || ' se', auth.uid(), o.id, 'joining')
  returning id into v_id;
  for c in select sc.id, sc.code from public.salary_components sc where sc.code in ('HOUSE_RENT','TRAVEL','MOBILE') loop
    insert into public.staff_salary_structure_items (structure_id, component_id, amount)
    select v_id, c.id, case c.code when 'HOUSE_RENT' then o.house_rent when 'TRAVEL' then o.travel else o.mobile end
    where coalesce(case c.code when 'HOUSE_RENT' then o.house_rent when 'TRAVEL' then o.travel else o.mobile end, 0) > 0;
  end loop;
  return v_id;
end $$;
revoke execute on function public.fn_salary_structure_from_offer(uuid, uuid, date) from public, anon;
grant execute on function public.fn_salary_structure_from_offer(uuid, uuid, date) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Aane wali barhotriyan
-- ---------------------------------------------------------------------
create or replace view public.v_upcoming_increments with (security_invoker = true) as
with base as (
  select sd.profile_id, p.full_name, sd.designation, sd.department, sd.hire_date, sd.next_increment_due,
         coalesce((select s.basic from public.staff_salary_structures s
                    where s.profile_id = sd.profile_id and s.status = 'approved' and s.effective_from <= current_date
                    order by s.effective_from desc, s.approved_at desc limit 1), sd.basic_salary) as current_basic,
         (select count(*) from public.staff_salary_structures s
           where s.profile_id = sd.profile_id and s.status = 'draft') as drafts_pending,
         case when sd.hire_date is null then null
              else (sd.hire_date + make_interval(years => greatest(1,
                     extract(year from age(current_date, sd.hire_date))::int + 1)))::date end as next_anniversary
    from public.staff_details sd
    join public.profiles p on p.id = sd.profile_id and p.is_active
   where sd.is_active
)
select b.profile_id, b.full_name, b.designation, b.department, b.hire_date, b.current_basic, b.drafts_pending,
       coalesce(b.next_increment_due, b.next_anniversary) as due_date,
       coalesce(b.next_increment_due, b.next_anniversary) - current_date as days_left,
       case
         when coalesce(b.next_increment_due, b.next_anniversary) is null then 'unknown'
         when coalesce(b.next_increment_due, b.next_anniversary) < current_date then 'late'
         when date_trunc('month', coalesce(b.next_increment_due, b.next_anniversary)) = date_trunc('month', current_date) then 'this_month'
         when date_trunc('month', coalesce(b.next_increment_due, b.next_anniversary)) = date_trunc('month', current_date + interval '1 month') then 'next_month'
         else 'later'
       end as bucket
  from base b;
revoke all on public.v_upcoming_increments from public, anon;
grant select on public.v_upcoming_increments to authenticated;

-- ---------------------------------------------------------------------
-- 6. Salary slip: number, tasdeeqi code, adaigi
-- ---------------------------------------------------------------------
create or replace function public.fn_new_verify_code()
returns text language sql volatile set search_path = '' as $$
  select 'VRF-' || upper(substr(md5(gen_random_uuid()::text), 1, 4)) || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 4))
$$;
create sequence if not exists public.payroll_slip_seq;
alter table public.payroll_lines add column if not exists slip_no text;
alter table public.payroll_lines add column if not exists verify_code text not null default public.fn_new_verify_code();
alter table public.payroll_lines add column if not exists paid_at timestamptz;
alter table public.payroll_lines add column if not exists pay_method text check (pay_method is null or pay_method in ('cash','bank_transfer','cheque','wallet'));
alter table public.payroll_lines add column if not exists pay_ref text;
create unique index if not exists uq_payroll_lines_verify_code on public.payroll_lines(verify_code);
create unique index if not exists uq_payroll_lines_slip_no on public.payroll_lines(slip_no) where slip_no is not null;

create or replace function public.fn_payroll_line_slip_no()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r public.payroll_runs;
begin
  if new.slip_no is null then
    select * into r from public.payroll_runs where id = new.run_id;
    new.slip_no := 'ART-' || r.pay_year || '-' || lpad(r.pay_month::text, 2, '0') || '-' || lpad(nextval('public.payroll_slip_seq')::text, 4, '0');
  end if;
  return new;
end $$;
drop trigger if exists trg_payroll_line_slip_no on public.payroll_lines;
create trigger trg_payroll_line_slip_no before insert on public.payroll_lines
  for each row execute function public.fn_payroll_line_slip_no();

-- Purani lines ko number (guard ko isi transaction ke liye ijazat).
select set_config('agribridge.payroll_fn', 'on', true);
update public.payroll_lines l
   set slip_no = 'ART-' || r.pay_year || '-' || lpad(r.pay_month::text, 2, '0') || '-' || lpad(nextval('public.payroll_slip_seq')::text, 4, '0')
  from public.payroll_runs r
 where r.id = l.run_id and l.slip_no is null;
select set_config('agribridge.payroll_fn', 'off', true);

-- Har line ka adaigi ka tareeqa/hawala (Admin/Owner, banane wala nahi).
create or replace function public.fn_payroll_line_set_payment(p_line uuid, p_method text, p_ref text default null, p_paid_at timestamptz default null)
returns void language plpgsql security definer set search_path = '' as $$
declare l public.payroll_lines; r public.payroll_runs;
begin
  if not public.fn_payroll_is_approver() then raise exception 'Sirf Admin ya Owner.'; end if;
  select * into l from public.payroll_lines where id = p_line;
  if not found then raise exception 'Line nahi mili.'; end if;
  select * into r from public.payroll_runs where id = l.run_id;
  if r.status not in ('approved','paid') then raise exception 'Pehle run manzoor ho.'; end if;
  if l.profile_id = auth.uid() then raise exception 'Apni tankhwah ki adaigi khud darj nahi hoti.'; end if;
  perform set_config('agribridge.payroll_fn', 'on', true);
  update public.payroll_lines set pay_method = p_method, pay_ref = nullif(btrim(p_ref), ''),
         paid_at = coalesce(p_paid_at, r.paid_at, now()) where id = p_line;
  perform set_config('agribridge.payroll_fn', 'off', true);
end $$;
revoke execute on function public.fn_payroll_line_set_payment(uuid, text, text, timestamptz) from public, anon;
grant execute on function public.fn_payroll_line_set_payment(uuid, text, text, timestamptz) to authenticated;

create or replace function public.fn_mask_account(p text)
returns text language sql immutable set search_path = '' as $$
  select case when p is null or length(regexp_replace(p, '\s', '', 'g')) < 5 then p
              else left(regexp_replace(p, '\s', '', 'g'), 4) || ' **** **** ' || right(regexp_replace(p, '\s', '', 'g'), 4) end
$$;

-- Poori slip: payroll writer, ya khud staff (run manzoor/ada hone ke baad).
create or replace function public.fn_salary_slip(p_line uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare l public.payroll_lines; r public.payroll_runs; sd public.staff_details; pr public.profiles; acc text;
begin
  select * into l from public.payroll_lines where id = p_line;
  if not found then return null; end if;
  select * into r from public.payroll_runs where id = l.run_id;
  if not (public.fn_payroll_is_writer()
          or (l.profile_id = auth.uid() and r.status in ('approved','paid'))) then
    return null;
  end if;
  select * into sd from public.staff_details where profile_id = l.profile_id;
  select * into pr from public.profiles where id = l.profile_id;
  select a.name into acc from public.finance_accounts a where a.id = r.pay_account_id;
  return jsonb_build_object(
    'line', to_jsonb(l),
    'run', jsonb_build_object('id', r.id, 'pay_year', r.pay_year, 'pay_month', r.pay_month, 'status', r.status,
                              'paid_at', r.paid_at, 'pay_account', acc, 'pay_txn_id', r.pay_txn_id,
                              'created_by', (select full_name from public.profiles where id = r.created_by),
                              'approved_by', (select full_name from public.profiles where id = r.approved_by)),
    'staff', jsonb_build_object('full_name', pr.full_name, 'father_name', sd.father_name, 'cnic', sd.cnic,
                                'designation', coalesce(sd.designation, pr.role::text), 'department', sd.department,
                                'hire_date', coalesce(sd.hire_date, sd.probation_start_date),
                                'bank_name', sd.bank_name, 'bank_account', public.fn_mask_account(sd.bank_account),
                                'employee_code', sd.employee_code));
end $$;
revoke execute on function public.fn_salary_slip(uuid) from public, anon;
grant execute on function public.fn_salary_slip(uuid) to authenticated;

-- Public tasdeeq: QR se. Sirf mehdood maloomat -- CNIC, bank, kattautiyan nahi.
create or replace function public.fn_verify_salary_slip(p_code text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
           'slip_no', l.slip_no,
           'name', p.full_name,
           'designation', sd.designation,
           'pay_year', r.pay_year, 'pay_month', r.pay_month,
           'net', l.net,
           'status', r.status,
           'paid', coalesce(l.paid_at, r.paid_at) is not null)
    from public.payroll_lines l
    join public.payroll_runs r on r.id = l.run_id and r.status in ('approved','paid')
    join public.profiles p on p.id = l.profile_id
    left join public.staff_details sd on sd.profile_id = l.profile_id
   where l.verify_code = upper(btrim(p_code))
$$;
revoke execute on function public.fn_verify_salary_slip(text) from public;
grant execute on function public.fn_verify_salary_slip(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 7. Menu: Aane wali barhotriyan (HR dashboard)
-- ---------------------------------------------------------------------
insert into public.features (key, label, label_en, label_ur, route, icon, description) values
  ('hr.increments', 'Aane wali barhotriyan', 'Upcoming Increments', 'آنے والی بڑھوتریاں', '/admin/hr/increments', 'TrendingUp',
   'Joining ki saalgirah ke hisaab se is maah aur agle maah ki barhotriyan; Barhotri tay karein se draft structure.')
on conflict (key) do nothing;
insert into public.dashboard_features (dashboard_key, feature_key, sort_order, section, section_order) values
  ('hr', 'hr.increments', 63, null, 0)
on conflict (dashboard_key, feature_key) do nothing;
