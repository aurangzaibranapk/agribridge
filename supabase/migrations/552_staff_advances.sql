-- 552: Staff advance -- sirf 6 mahine (setting) ki mulazmat ke baad, qiston mein.
-- Qiston ka schedule universal Qist Plan (555-557) banata hai; yahan sirf
-- darkhwast, shart ki jaanch aur maker-checker manzoori. Additive.

create table if not exists public.hr_payroll_settings (
  id int primary key default 1 check (id = 1),
  advance_min_service_months int not null default 6 check (advance_min_service_months between 0 and 120),
  -- Qist ki had (basic ka %). NULL = koi had nahi. Admin jo chahe rakhe.
  advance_cap_pct numeric(6,3) check (advance_cap_pct is null or (advance_cap_pct > 0 and advance_cap_pct <= 100)),
  days_basis int not null default 30 check (days_basis = 30),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);
insert into public.hr_payroll_settings (id) values (1) on conflict (id) do nothing;

-- Mulazmat kab se: hire_date; na ho to probation_start_date (report mein nishan).
create or replace function public.fn_staff_service_start(p_profile uuid)
returns date language sql stable security definer set search_path = '' as $$
  select coalesce(hire_date, probation_start_date) from public.staff_details where profile_id = p_profile
$$;

create table if not exists public.staff_advances (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  installments int not null check (installments between 1 and 36),
  installment_amount numeric(12,2) not null check (installment_amount > 0),
  first_year int not null check (first_year between 2020 and 2100),
  first_month int not null check (first_month between 1 and 12),
  reason text not null check (length(btrim(reason)) >= 3),
  status text not null default 'requested' check (status in ('requested','approved','rejected','paid','closed','cancelled')),
  requested_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  reject_reason text,
  paid_at timestamptz,
  paid_by uuid references public.profiles(id),
  paid_account_id uuid,
  paid_txn_id uuid,
  journal_entry_id uuid,
  qist_plan_id uuid
);
create index if not exists idx_staff_advances_profile on public.staff_advances(profile_id, status);

create or replace function public.fn_staff_advance_eligibility(p_profile uuid, p_amount numeric, p_installments int)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_set public.hr_payroll_settings;
  v_start date; v_months int; v_basic numeric; v_open int; v_inst numeric;
  v_reasons text[] := '{}'; v_hire date;
begin
  select * into v_set from public.hr_payroll_settings where id = 1;
  select hire_date into v_hire from public.staff_details where profile_id = p_profile;
  v_start := public.fn_staff_service_start(p_profile);
  v_months := case when v_start is null then null
    else (extract(year from age(current_date, v_start)) * 12 + extract(month from age(current_date, v_start)))::int end;
  select basic into v_basic from public.fn_salary_structure_as_of(p_profile, current_date);
  select count(*) into v_open from public.staff_advances
   where profile_id = p_profile and status in ('requested','approved','paid');
  v_inst := case when coalesce(p_installments,0) > 0 then round(p_amount / p_installments, 0) else null end;

  if v_start is null then v_reasons := v_reasons || 'Joining date system mein nahi -- HR pehle hire date darj kare.'; 
  elsif v_months < v_set.advance_min_service_months then
    v_reasons := v_reasons || format('Advance %s mahine ki mulazmat ke baad milta hai -- abhi %s din baqi.',
      v_set.advance_min_service_months, ((v_start + make_interval(months => v_set.advance_min_service_months))::date - current_date));
  end if;
  if v_open > 0 then v_reasons := v_reasons || 'Pehle wala advance abhi khula hai.'; end if;
  if v_basic is null then v_reasons := v_reasons || 'Manzoor shuda salary structure nahi.'; end if;
  if v_set.advance_cap_pct is not null and v_basic is not null and v_inst is not null
     and v_inst > round(v_basic * v_set.advance_cap_pct / 100, 0) then
    v_reasons := v_reasons || format('Qist Rs %s basic ke %s%% (Rs %s) se zyada hai.', v_inst, v_set.advance_cap_pct, round(v_basic * v_set.advance_cap_pct / 100, 0));
  end if;
  return jsonb_build_object(
    'eligible', cardinality(v_reasons) = 0,
    'service_start', v_start, 'service_start_is_probation', v_hire is null and v_start is not null,
    'service_months', v_months, 'min_months', v_set.advance_min_service_months,
    'open_advances', v_open, 'basic', v_basic, 'installment', v_inst,
    'cap_pct', v_set.advance_cap_pct, 'reasons', to_jsonb(v_reasons));
end $$;

create or replace function public.fn_guard_staff_advance()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v jsonb;
begin
  if tg_op = 'DELETE' then raise exception 'Advance ka record mitaya nahi ja sakta -- cancel karein.'; end if;
  if tg_op = 'INSERT' then
    new.status := 'requested'; new.approved_by := null; new.approved_at := null;
    v := public.fn_staff_advance_eligibility(new.profile_id, new.amount, new.installments);
    if not (v->>'eligible')::boolean then
      raise exception '%', (select string_agg(x, ' ') from jsonb_array_elements_text(v->'reasons') x);
    end if;
    if new.installment_amount <> round(new.amount / new.installments, 0)
       and abs(new.installment_amount * new.installments - new.amount) > new.installments then
      raise exception 'Qist x tadaad kul raqam ke barabar nahi.';
    end if;
    return new;
  end if;
  if current_setting('agribridge.advance_decide', true) is distinct from 'on' then
    raise exception 'Advance ki halat sirf manzoori/adaigi ke functions se badalti hai.';
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_staff_advance on public.staff_advances;
create trigger trg_guard_staff_advance before insert or update or delete on public.staff_advances
  for each row execute function public.fn_guard_staff_advance();

create or replace function public.fn_staff_advance_decide(p_id uuid, p_approve boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare a public.staff_advances;
begin
  if not public.fn_payroll_is_approver() then raise exception 'Advance sirf Admin ya Owner manzoor kar sakta hai.'; end if;
  select * into a from public.staff_advances where id = p_id for update;
  if not found then raise exception 'Advance nahi mila.'; end if;
  if a.status <> 'requested' then raise exception 'Ye advance pehle hi % hai.', a.status; end if;
  if a.requested_by = auth.uid() or a.profile_id = auth.uid() then raise exception 'Darkhwast dene wala / staff khud manzoor nahi kar sakta.'; end if;
  if not p_approve and coalesce(btrim(p_reason),'') = '' then raise exception 'Rad karne ki wajah likhein.'; end if;
  perform set_config('agribridge.advance_decide', 'on', true);
  update public.staff_advances set status = case when p_approve then 'approved' else 'rejected' end,
    approved_by = auth.uid(), approved_at = now(), reject_reason = case when p_approve then null else btrim(p_reason) end
   where id = p_id;
  perform set_config('agribridge.advance_decide', 'off', true);
end $$;

-- Adaigi: journal TS (postStaffAdvance) mein; yahan sirf nishan. 557 is par Qist Plan banata hai.
create or replace function public.fn_staff_advance_mark_paid(p_id uuid, p_account uuid, p_txn uuid, p_journal uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare a public.staff_advances;
begin
  if not public.fn_payroll_is_approver() then raise exception 'Advance sirf Admin ya Owner ada kar sakta hai.'; end if;
  select * into a from public.staff_advances where id = p_id for update;
  if a.status <> 'approved' then raise exception 'Pehle manzoori zaroori hai.'; end if;
  if a.profile_id = auth.uid() then raise exception 'Apna advance khud ada nahi kiya ja sakta.'; end if;
  perform set_config('agribridge.advance_decide', 'on', true);
  update public.staff_advances set status = 'paid', paid_at = now(), paid_by = auth.uid(),
    paid_account_id = p_account, paid_txn_id = p_txn, journal_entry_id = p_journal where id = p_id;
  perform set_config('agribridge.advance_decide', 'off', true);
end $$;

alter table public.hr_payroll_settings enable row level security;
alter table public.staff_advances enable row level security;
drop policy if exists hr_payroll_settings_read on public.hr_payroll_settings;
create policy hr_payroll_settings_read on public.hr_payroll_settings for select to authenticated using (public.fn_is_any_staff());
drop policy if exists hr_payroll_settings_write on public.hr_payroll_settings;
create policy hr_payroll_settings_write on public.hr_payroll_settings for update to authenticated
  using (public.fn_payroll_is_approver()) with check (public.fn_payroll_is_approver());
drop policy if exists staff_advances_read on public.staff_advances;
create policy staff_advances_read on public.staff_advances for select to authenticated
  using (public.fn_payroll_is_writer() or profile_id = auth.uid());
drop policy if exists staff_advances_insert on public.staff_advances;
create policy staff_advances_insert on public.staff_advances for insert to authenticated
  with check (requested_by = auth.uid() and (public.fn_payroll_is_writer() or profile_id = auth.uid()));

revoke execute on function public.fn_staff_advance_eligibility(uuid, numeric, int) from public, anon;
revoke execute on function public.fn_staff_advance_decide(uuid, boolean, text) from public, anon;
revoke execute on function public.fn_staff_advance_mark_paid(uuid, uuid, uuid, uuid) from public, anon;
revoke execute on function public.fn_staff_service_start(uuid) from public, anon;
grant execute on function public.fn_staff_advance_eligibility(uuid, numeric, int) to authenticated;
grant execute on function public.fn_staff_advance_decide(uuid, boolean, text) to authenticated;
grant execute on function public.fn_staff_advance_mark_paid(uuid, uuid, uuid, uuid) to authenticated;
grant execute on function public.fn_staff_service_start(uuid) to authenticated;
