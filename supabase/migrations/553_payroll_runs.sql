-- 553: Mahana payroll run -- Draft -> Manzoori ke liye -> Manzoor (journal) -> Ada.
-- Ghair-hazri: basic / 30 x (absent + unpaid leave + bina record din + half day x 0.5). Overtime NAHI.
-- Owner ka faisla (16 Oct 2026): jis din hazri darj na ho (missing / missing_punch) wo ghair-hazir ginta hai.
-- 'Hazri adhoori, phir bhi banayein' sirf run banne deta hai -- bina record din phir bhi katte hain.
-- Advance/qist kattauti fn_payroll_advance_due se (556 isay Qist Plan se jorta hai).
-- Additive.

create table if not exists public.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  pay_year int not null check (pay_year between 2020 and 2100),
  pay_month int not null check (pay_month between 1 and 12),
  branch_id uuid,
  status text not null default 'draft' check (status in ('draft','submitted','approved','paid','cancelled')),
  ack_unfinalized boolean not null default false,
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  computed_at timestamptz,
  submitted_by uuid references public.profiles(id), submitted_at timestamptz,
  approved_by uuid references public.profiles(id), approved_at timestamptz,
  approve_journal_id uuid,
  paid_by uuid references public.profiles(id), paid_at timestamptz,
  pay_account_id uuid, pay_txn_id uuid, pay_journal_id uuid,
  cancel_reason text
);
create unique index if not exists uq_payroll_run_month
  on public.payroll_runs(pay_year, pay_month, coalesce(branch_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status <> 'cancelled';

create table if not exists public.payroll_lines (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.payroll_runs(id) on delete cascade,
  profile_id uuid not null references public.profiles(id),
  structure_id uuid references public.staff_salary_structures(id),
  basic numeric(12,2) not null,
  days_basis int not null default 30,
  present_days int not null default 0,
  paid_leave_days int not null default 0,
  absent_days int not null default 0,
  unpaid_leave_days int not null default 0,
  half_days int not null default 0,
  missing_days int not null default 0,
  attendance_finalized boolean not null default false,
  open_items int not null default 0,
  allowances numeric(12,2) not null default 0,
  absent_deduction numeric(12,2) not null default 0,
  other_deductions numeric(12,2) not null default 0,
  advance_deduction numeric(12,2) not null default 0,
  components jsonb not null default '[]'::jsonb,
  gross numeric(12,2) not null,
  net numeric(12,2) not null check (net >= 0),
  created_at timestamptz not null default now(),
  unique (run_id, profile_id)
);
create index if not exists idx_payroll_lines_profile on public.payroll_lines(profile_id);

-- Pure hisaab (test ho sakta hai)
create or replace function public.fn_payroll_absent_deduction(p_basic numeric, p_absent numeric, p_half numeric)
returns numeric language sql immutable as $$
  select least(p_basic, round(p_basic / 30 * (greatest(p_absent,0) + greatest(p_half,0) * 0.5), 0))
$$;

-- 556 isay Qist Plan se badalta hai. Abhi: koi kattauti nahi.
create or replace function public.fn_payroll_advance_due(p_profile uuid, p_year int, p_month int, p_available numeric)
returns numeric language sql stable security definer set search_path = '' as $$ select 0::numeric $$;

-- Run ki halat sirf functions se badle
create or replace function public.fn_guard_payroll_run()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'Payroll run mitaya nahi ja sakta -- cancel karein.'; end if;
  if tg_op = 'INSERT' then new.status := 'draft'; return new; end if;
  if current_setting('agribridge.payroll_fn', true) is distinct from 'on' then
    raise exception 'Payroll ki halat sirf payroll functions se badalti hai.';
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_payroll_run on public.payroll_runs;
create trigger trg_guard_payroll_run before insert or update or delete on public.payroll_runs
  for each row execute function public.fn_guard_payroll_run();

create or replace function public.fn_guard_payroll_lines()
returns trigger language plpgsql as $$
begin
  if current_setting('agribridge.payroll_fn', true) is distinct from 'on' then
    raise exception 'Payroll lines sirf "Hisaab chalayein" se banti hain.';
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists trg_guard_payroll_lines on public.payroll_lines;
create trigger trg_guard_payroll_lines before insert or update or delete on public.payroll_lines
  for each row execute function public.fn_guard_payroll_lines();

create or replace function public.fn_payroll_compute(p_run uuid, p_ack_unfinalized boolean default false)
returns int language plpgsql security definer set search_path = '' as $$
declare
  r public.payroll_runs; st record; s public.staff_salary_structures; m record;
  v_end date; v_allow numeric; v_oded numeric; v_absded numeric; v_adv numeric; v_gross numeric; v_comp jsonb;
  v_n int := 0; v_problems text[] := '{}';
begin
  if not public.fn_payroll_is_writer() then raise exception 'Payroll sirf HR, Finance, Admin ya Owner bana sakta hai.'; end if;
  select * into r from public.payroll_runs where id = p_run for update;
  if not found then raise exception 'Payroll run nahi mila.'; end if;
  if r.status <> 'draft' then raise exception 'Sirf draft run ka hisaab dobara chal sakta hai.'; end if;
  v_end := (make_date(r.pay_year, r.pay_month, 1) + interval '1 month - 1 day')::date;
  perform set_config('agribridge.payroll_fn', 'on', true);
  delete from public.payroll_lines where run_id = p_run;

  for st in
    select sd.profile_id, p.full_name from public.staff_details sd join public.profiles p on p.id = sd.profile_id
     where sd.is_active and p.is_active
       and (r.branch_id is null or sd.branch_id = r.branch_id)
       and (sd.exit_date is null or sd.exit_date >= make_date(r.pay_year, r.pay_month, 1))
  loop
    s := public.fn_salary_structure_as_of(st.profile_id, v_end);
    continue when s.id is null;
    select * into m from public.fn_attendance_month_summary(st.profile_id, r.pay_year, r.pay_month);
    if m is null or not coalesce(m.is_finalized, false) or coalesce(m.open_items, 0) > 0 then
      v_problems := v_problems || coalesce(st.full_name, st.profile_id::text);
    end if;

    select coalesce(jsonb_agg(jsonb_build_object('code', c.code, 'name', c.name, 'kind', c.kind,
             'amount', round(case when c.calc = 'pct_basic' then s.basic * coalesce(i.pct, c.default_pct, 0) / 100
                                  else coalesce(i.amount, c.default_amount) end, 0)) order by c.sort_order), '[]'::jsonb)
      into v_comp
      from public.staff_salary_structure_items i join public.salary_components c on c.id = i.component_id
     where i.structure_id = s.id and c.is_active and not c.is_system;
    select coalesce(sum((x->>'amount')::numeric) filter (where x->>'kind' = 'earning'), 0),
           coalesce(sum((x->>'amount')::numeric) filter (where x->>'kind' = 'deduction'), 0)
      into v_allow, v_oded from jsonb_array_elements(v_comp) x;

    v_absded := public.fn_payroll_absent_deduction(s.basic,
                  coalesce(m.absent_days, 0) + coalesce(m.unpaid_leave_days, 0) + coalesce(m.missing_days, 0), coalesce(m.half_days, 0));
    v_gross := s.basic + v_allow;
    v_adv := least(greatest(public.fn_payroll_advance_due(st.profile_id, r.pay_year, r.pay_month,
                     greatest(v_gross - v_absded - v_oded, 0)), 0), greatest(v_gross - v_absded - v_oded, 0));

    insert into public.payroll_lines (run_id, profile_id, structure_id, basic, present_days, paid_leave_days,
      absent_days, unpaid_leave_days, half_days, missing_days, attendance_finalized, open_items,
      allowances, absent_deduction, other_deductions, advance_deduction, components, gross, net)
    values (p_run, st.profile_id, s.id, s.basic, coalesce(m.present_days,0), coalesce(m.paid_leave_days,0),
      coalesce(m.absent_days,0), coalesce(m.unpaid_leave_days,0), coalesce(m.half_days,0), coalesce(m.missing_days,0),
      coalesce(m.is_finalized,false), coalesce(m.open_items,0),
      v_allow, v_absded, v_oded, v_adv, v_comp, v_gross, greatest(v_gross - v_absded - v_oded - v_adv, 0));
    v_n := v_n + 1;
  end loop;

  if cardinality(v_problems) > 0 and not p_ack_unfinalized then
    raise exception 'Hazri mukammal nahi (%): pehle mahina band karein, ya "hazri adhoori hai, phir bhi banayein" chunein.',
      array_to_string(v_problems, ', ');
  end if;
  update public.payroll_runs set computed_at = now(), ack_unfinalized = p_ack_unfinalized and cardinality(v_problems) > 0 where id = p_run;
  perform set_config('agribridge.payroll_fn', 'off', true);
  return v_n;
end $$;

create or replace function public.fn_payroll_transition(p_run uuid, p_action text, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.payroll_runs;
begin
  select * into r from public.payroll_runs where id = p_run for update;
  if not found then raise exception 'Payroll run nahi mila.'; end if;
  perform set_config('agribridge.payroll_fn', 'on', true);
  if p_action = 'submit' then
    if not public.fn_payroll_is_writer() then raise exception 'Ijazat nahi.'; end if;
    if r.status <> 'draft' or r.computed_at is null then raise exception 'Pehle hisaab chalayein (draft).'; end if;
    if not exists (select 1 from public.payroll_lines where run_id = p_run) then raise exception 'Run mein koi staff nahi.'; end if;
    update public.payroll_runs set status = 'submitted', submitted_by = auth.uid(), submitted_at = now() where id = p_run;
  elsif p_action = 'back_to_draft' then
    if not public.fn_payroll_is_writer() or r.status <> 'submitted' then raise exception 'Sirf bheja hua run wapas draft ho sakta hai.'; end if;
    update public.payroll_runs set status = 'draft', submitted_by = null, submitted_at = null where id = p_run;
  elsif p_action = 'approve' then
    if not public.fn_payroll_is_approver() then raise exception 'Payroll sirf Admin ya Owner manzoor kar sakta hai.'; end if;
    if r.status <> 'submitted' then raise exception 'Sirf bheja hua run manzoor ho sakta hai.'; end if;
    if r.created_by = auth.uid() or r.submitted_by = auth.uid() then raise exception 'Banane/bhejne wala khud manzoor nahi kar sakta.'; end if;
    if exists (select 1 from public.payroll_lines where run_id = p_run and profile_id = auth.uid()) then
      raise exception 'Is run mein aap ki apni tankhwah hai -- koi aur manzoor kare.';
    end if;
    update public.payroll_runs set status = 'approved', approved_by = auth.uid(), approved_at = now() where id = p_run;
    perform public.fn_payroll_on_approved(p_run);
  elsif p_action = 'unapprove' then
    -- Sirf jab journal post na ho saka (TS wapas karta hai)
    if not public.fn_payroll_is_approver() or r.status <> 'approved' or r.approve_journal_id is not null then
      raise exception 'Ye run wapas nahi ho sakta.';
    end if;
    perform public.fn_payroll_on_unapproved(p_run);
    update public.payroll_runs set status = 'submitted', approved_by = null, approved_at = null where id = p_run;
  elsif p_action = 'cancel' then
    if not public.fn_payroll_is_approver() or r.status not in ('draft','submitted') then raise exception 'Sirf draft/bheja hua run cancel ho sakta hai.'; end if;
    if coalesce(btrim(p_reason),'') = '' then raise exception 'Cancel ki wajah likhein.'; end if;
    update public.payroll_runs set status = 'cancelled', cancel_reason = btrim(p_reason) where id = p_run;
  else
    raise exception 'Ghalat action %', p_action;
  end if;
  perform set_config('agribridge.payroll_fn', 'off', true);
end $$;

-- 556 in dono ko Qist se jorta hai
create or replace function public.fn_payroll_on_approved(p_run uuid) returns void language plpgsql security definer set search_path = '' as $$ begin null; end $$;
create or replace function public.fn_payroll_on_unapproved(p_run uuid) returns void language plpgsql security definer set search_path = '' as $$ begin null; end $$;

create or replace function public.fn_payroll_set_journal(p_run uuid, p_kind text, p_journal uuid, p_account uuid default null, p_txn uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.payroll_runs; l record;
begin
  if not public.fn_payroll_is_approver() then raise exception 'Ijazat nahi.'; end if;
  select * into r from public.payroll_runs where id = p_run for update;
  perform set_config('agribridge.payroll_fn', 'on', true);
  if p_kind = 'approve' then
    if r.status <> 'approved' or r.approve_journal_id is not null then raise exception 'Journal pehle se laga hai ya run manzoor nahi.'; end if;
    update public.payroll_runs set approve_journal_id = p_journal where id = p_run;
  elsif p_kind = 'pay' then
    if r.status <> 'approved' or r.approve_journal_id is null then raise exception 'Pehle manzoori aur journal.'; end if;
    if r.created_by = auth.uid() then raise exception 'Banane wala khud ada nahi kar sakta.'; end if;
    update public.payroll_runs set status = 'paid', paid_by = auth.uid(), paid_at = now(),
      pay_account_id = p_account, pay_txn_id = p_txn, pay_journal_id = p_journal where id = p_run;
    -- Purana My HR / salary slip safha bhi chale
    for l in select * from public.payroll_lines where run_id = p_run loop
      insert into public.salary_payments (profile_id, pay_month, pay_year, basic_salary, bonus, deductions,
        advance_deduction, net_salary, status, paid_date, notes)
      values (l.profile_id, r.pay_month, r.pay_year, l.basic, l.allowances, l.absent_deduction + l.other_deductions,
        l.advance_deduction, l.net, 'paid', current_date, 'Payroll run ' || p_run::text)
      on conflict (profile_id, pay_month, pay_year) do nothing;
    end loop;
  else raise exception 'Ghalat kind'; end if;
  perform set_config('agribridge.payroll_fn', 'off', true);
end $$;

alter table public.payroll_runs enable row level security;
alter table public.payroll_lines enable row level security;
drop policy if exists payroll_runs_read on public.payroll_runs;
create policy payroll_runs_read on public.payroll_runs for select to authenticated using (public.fn_payroll_is_writer());
drop policy if exists payroll_runs_insert on public.payroll_runs;
create policy payroll_runs_insert on public.payroll_runs for insert to authenticated
  with check (public.fn_payroll_is_writer() and created_by = auth.uid());
drop policy if exists payroll_lines_read on public.payroll_lines;
create policy payroll_lines_read on public.payroll_lines for select to authenticated
  using (public.fn_payroll_is_writer() or (profile_id = auth.uid()
         and exists (select 1 from public.payroll_runs r where r.id = run_id and r.status in ('approved','paid'))));

revoke execute on function public.fn_payroll_compute(uuid, boolean) from public, anon;
revoke execute on function public.fn_payroll_transition(uuid, text, text) from public, anon;
revoke execute on function public.fn_payroll_set_journal(uuid, text, uuid, uuid, uuid) from public, anon;
revoke execute on function public.fn_payroll_advance_due(uuid, int, int, numeric) from public, anon;
revoke execute on function public.fn_payroll_on_approved(uuid) from public, anon, authenticated;
revoke execute on function public.fn_payroll_on_unapproved(uuid) from public, anon, authenticated;
grant execute on function public.fn_payroll_compute(uuid, boolean) to authenticated;
grant execute on function public.fn_payroll_transition(uuid, text, text) to authenticated;
grant execute on function public.fn_payroll_set_journal(uuid, text, uuid, uuid, uuid) to authenticated;
grant execute on function public.fn_payroll_advance_due(uuid, int, int, numeric) to authenticated;
