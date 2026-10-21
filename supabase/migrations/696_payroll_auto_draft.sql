-- 696: Mahine ke aakhir mein payroll draft khud banta hai (branch "Sab"), owner dekh kar line badal sakta hai.
-- * fn_payroll_auto_draft: sirf service_role (cron). Sab-branch run banata hai; agar is mahine ka koi
--   bhi run (Sab ya branch wala) pehle se hai to kuch nahi karta -- sirf khaali (0 line) Sab draft ka hisaab bharta hai.
-- * Hisaab wahi 553 wala (structure, hazri, absent, half day, chhutti, advance qist). Hazri adhoori ho to
--   run par ack_unfinalized nishan lagta hai (rokta nahi).
-- * Jis staff ki tankhwah (structure) darj nahi wo payroll_run_warnings mein "tankhwah darj nahi" aata hai.
-- * fn_payroll_line_adjust: draft line mein allowance / kattauti / advance badlo -- wajah zaroori, audit mein.
-- * Maker-checker: system run ka created_by NULL; line badalne wala manzoor nahi kar sakta (trigger).
-- Additive: naye tables/functions; created_by se sirf NOT NULL hataya (purane rows wese hi).

alter table public.payroll_runs alter column created_by drop not null;
alter table public.payroll_runs add column if not exists auto_created boolean not null default false;

create table if not exists public.payroll_run_warnings (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.payroll_runs(id) on delete cascade,
  profile_id uuid not null references public.profiles(id),
  kind text not null check (kind in ('no_structure')),
  message text not null,
  created_at timestamptz not null default now(),
  unique (run_id, profile_id, kind)
);

create table if not exists public.payroll_line_adjustments (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.payroll_runs(id) on delete cascade,
  line_id uuid,
  profile_id uuid not null references public.profiles(id),
  field text not null check (field in ('allowances','other_deductions','advance_deduction','absent_deduction')),
  old_value numeric(12,2) not null,
  new_value numeric(12,2) not null,
  reason text not null check (btrim(reason) <> ''),
  adjusted_by uuid references public.profiles(id),
  adjusted_at timestamptz not null default now()
);
create index if not exists idx_payroll_adj_run on public.payroll_line_adjustments(run_id);

alter table public.payroll_run_warnings enable row level security;
alter table public.payroll_line_adjustments enable row level security;
drop policy if exists payroll_run_warnings_read on public.payroll_run_warnings;
create policy payroll_run_warnings_read on public.payroll_run_warnings for select to authenticated using (public.fn_payroll_is_writer());
drop policy if exists payroll_line_adj_read on public.payroll_line_adjustments;
create policy payroll_line_adj_read on public.payroll_line_adjustments for select to authenticated using (public.fn_payroll_is_writer());

-- Advance/qist kattauti (556 fn_qist_preview jaisa, bina login check) -- sirf system draft ke liye.
create or replace function public.fn_payroll_advance_due_system(p_profile uuid, p_year int, p_month int, p_available numeric)
returns numeric language plpgsql stable security definer set search_path = '' as $$
declare p record; v_left numeric := greatest(coalesce(p_available,0),0); v_due numeric; v_cap numeric; v_take numeric; v_total numeric := 0;
  v_as_of date := (make_date(p_year, p_month, 1) + interval '1 month - 1 day')::date;
begin
  if to_regclass('public.qist_plans') is null then return 0; end if;
  for p in select * from public.qist_plans where party_type = 'staff' and party_id = p_profile
              and deduct_source = 'salary' and status = 'active' order by approved_at, created_at loop
    select coalesce(sum(amount_due - amount_deducted - carried_out),0) into v_due
      from public.qist_installments where plan_id = p.id and status = 'due' and due_date <= v_as_of;
    continue when v_due <= 0;
    v_cap := v_due;
    if p.cap_pct is not null then v_cap := least(v_cap, round(coalesce(p_available,0) * p.cap_pct / 100, 0)); end if;
    if p.cap_amount is not null then v_cap := least(v_cap, p.cap_amount); end if;
    v_take := greatest(least(v_cap, v_left), 0);
    v_left := v_left - v_take; v_total := v_total + v_take;
  end loop;
  return v_total;
end $$;

-- Lines ka hisaab (553 fn_payroll_compute jaisa), bina login check -- sirf andar se bulaya jata hai.
create or replace function public.fn_payroll_fill_lines_system(p_run uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare
  r public.payroll_runs; st record; s public.staff_salary_structures; m record;
  v_end date; v_allow numeric; v_oded numeric; v_absded numeric; v_adv numeric; v_gross numeric; v_comp jsonb;
  v_n int := 0; v_incomplete boolean := false;
begin
  select * into r from public.payroll_runs where id = p_run for update;
  if not found or r.status <> 'draft' then raise exception 'Sirf draft run.'; end if;
  v_end := (make_date(r.pay_year, r.pay_month, 1) + interval '1 month - 1 day')::date;
  perform set_config('agribridge.payroll_fn', 'on', true);
  delete from public.payroll_lines where run_id = p_run;
  delete from public.payroll_run_warnings where run_id = p_run;
  for st in
    select sd.profile_id, p.full_name from public.staff_details sd join public.profiles p on p.id = sd.profile_id
     where sd.is_active and p.is_active
       and (r.branch_id is null or sd.branch_id = r.branch_id)
       and (sd.exit_date is null or sd.exit_date >= make_date(r.pay_year, r.pay_month, 1))
  loop
    s := public.fn_salary_structure_as_of(st.profile_id, v_end);
    if s.id is null then
      insert into public.payroll_run_warnings (run_id, profile_id, kind, message)
      values (p_run, st.profile_id, 'no_structure', coalesce(st.full_name, 'Staff') || ': tankhwah darj nahi -- salary structure banayein, phir "Hisaab chalayein".')
      on conflict do nothing;
      continue;
    end if;
    select * into m from public.fn_attendance_month_summary(st.profile_id, r.pay_year, r.pay_month);
    if m is null or not coalesce(m.is_finalized, false) or coalesce(m.open_items, 0) > 0 then v_incomplete := true; end if;
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
    v_adv := least(greatest(public.fn_payroll_advance_due_system(st.profile_id, r.pay_year, r.pay_month,
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
  update public.payroll_runs set computed_at = now(), ack_unfinalized = v_incomplete where id = p_run;
  perform set_config('agribridge.payroll_fn', 'off', true);
  return v_n;
end $$;

-- Cron: { action: created|filled|skipped, run_id, lines, warnings, incomplete }
create or replace function public.fn_payroll_auto_draft(p_year int, p_month int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_run public.payroll_runs; v_n int; v_action text;
begin
  perform pg_advisory_xact_lock(hashtext('payroll_auto_draft'), p_year * 100 + p_month);
  select * into v_run from public.payroll_runs
   where pay_year = p_year and pay_month = p_month and status <> 'cancelled' and branch_id is null;
  if found then
    if v_run.status <> 'draft' or exists (select 1 from public.payroll_lines where run_id = v_run.id)
       or exists (select 1 from public.payroll_line_adjustments where run_id = v_run.id) then
      return jsonb_build_object('action', 'skipped', 'run_id', v_run.id, 'reason', 'Is mahine ka run pehle se hai.');
    end if;
    v_action := 'filled';
  else
    if exists (select 1 from public.payroll_runs where pay_year = p_year and pay_month = p_month
                and status <> 'cancelled' and branch_id is not null) then
      return jsonb_build_object('action', 'skipped', 'reason', 'Branch wala run pehle se hai -- Sab run se staff dobara ginta.');
    end if;
    insert into public.payroll_runs (pay_year, pay_month, branch_id, created_by, auto_created)
    values (p_year, p_month, null, null, true) returning * into v_run;
    v_action := 'created';
  end if;
  v_n := public.fn_payroll_fill_lines_system(v_run.id);
  select * into v_run from public.payroll_runs where id = v_run.id;
  return jsonb_build_object('action', v_action, 'run_id', v_run.id, 'lines', v_n,
    'warnings', (select count(*) from public.payroll_run_warnings where run_id = v_run.id),
    'incomplete', v_run.ack_unfinalized);
end $$;

-- Draft line badlo (wajah ke sath). Gross/net dobara.
create or replace function public.fn_payroll_line_adjust(p_line uuid, p_field text, p_value numeric, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare l public.payroll_lines; r public.payroll_runs; v_old numeric; v_gross numeric; v_net numeric;
begin
  if not public.fn_payroll_is_writer() then raise exception 'Ijazat nahi.'; end if;
  if p_field not in ('allowances','other_deductions','advance_deduction','absent_deduction') then raise exception 'Ye cheez nahi badal sakti.'; end if;
  if p_value is null or p_value < 0 then raise exception 'Raqam 0 ya zyada ho.'; end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'Badalne ki wajah likhein.'; end if;
  select * into l from public.payroll_lines where id = p_line for update;
  if not found then raise exception 'Line nahi mili.'; end if;
  select * into r from public.payroll_runs where id = l.run_id for update;
  if r.status <> 'draft' then raise exception 'Sirf draft mein badlao ho sakta hai.'; end if;
  if l.profile_id = auth.uid() then raise exception 'Apni tankhwah khud nahi badal sakte.'; end if;
  v_old := case p_field when 'allowances' then l.allowances when 'other_deductions' then l.other_deductions
                        when 'advance_deduction' then l.advance_deduction else l.absent_deduction end;
  if p_field = 'allowances' then l.allowances := p_value;
  elsif p_field = 'other_deductions' then l.other_deductions := p_value;
  elsif p_field = 'advance_deduction' then l.advance_deduction := p_value;
  else l.absent_deduction := p_value; end if;
  v_gross := l.basic + l.allowances;
  v_net := v_gross - l.absent_deduction - l.other_deductions - l.advance_deduction;
  if v_net < 0 then raise exception 'Net manfi ho jayega.'; end if;
  perform set_config('agribridge.payroll_fn', 'on', true);
  update public.payroll_lines set allowances = l.allowances, other_deductions = l.other_deductions,
    advance_deduction = l.advance_deduction, absent_deduction = l.absent_deduction, gross = v_gross, net = v_net
   where id = p_line;
  perform set_config('agribridge.payroll_fn', 'off', true);
  insert into public.payroll_line_adjustments (run_id, line_id, profile_id, field, old_value, new_value, reason, adjusted_by)
  values (l.run_id, l.id, l.profile_id, p_field, v_old, p_value, btrim(p_reason), auth.uid());
end $$;

-- Maker-checker: jis ne line badli wo manzoor nahi karta.
create or replace function public.fn_guard_payroll_adjuster_approve()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' and new.approved_by is not null
     and exists (select 1 from public.payroll_line_adjustments where run_id = new.id and adjusted_by = new.approved_by) then
    raise exception 'Aap ne is run ki line badli hai -- koi aur manzoor kare.';
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_payroll_adjuster_approve on public.payroll_runs;
create trigger trg_guard_payroll_adjuster_approve before update on public.payroll_runs
  for each row execute function public.fn_guard_payroll_adjuster_approve();

revoke execute on function public.fn_payroll_fill_lines_system(uuid) from public, anon, authenticated;
revoke execute on function public.fn_payroll_advance_due_system(uuid, int, int, numeric) from public, anon, authenticated;
revoke execute on function public.fn_payroll_auto_draft(int, int) from public, anon, authenticated;
revoke execute on function public.fn_payroll_line_adjust(uuid, text, numeric, text) from public, anon;
revoke execute on function public.fn_guard_payroll_adjuster_approve() from public, anon, authenticated;
grant execute on function public.fn_payroll_auto_draft(int, int) to service_role;
grant execute on function public.fn_payroll_line_adjust(uuid, text, numeric, text) to authenticated;
grant select on public.payroll_run_warnings, public.payroll_line_adjustments to authenticated;
