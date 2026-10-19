-- 555: Universal Qist Plan -- kisi bhi khata member (staff, kisan/doodh, customer,
-- dealer, supplier) ka advance ya udhaar qiston mein. Additive; farmer
-- loan_installments (199) alag hi rehta hai.

create sequence if not exists public.qist_plan_code_seq;

create or replace function public.fn_qist_is_maker()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.fn_payroll_my_role() in ('hr','finance','manager','admin','owner','super_admin'), false)
$$;
create or replace function public.fn_qist_is_approver()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.fn_payroll_my_role() in ('admin','owner','super_admin'), false)
$$;

create table if not exists public.qist_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('QP-' || lpad(nextval('public.qist_plan_code_seq')::text, 4, '0')),
  party_type text not null check (party_type in ('staff','farmer','customer','dealer','supplier')),
  party_id uuid not null,
  party_name text,
  origin text not null default 'advance' check (origin in ('advance','goods_credit','loan','opening','other')),
  origin_ref_table text,
  origin_ref_id uuid,
  total numeric(14,2) not null check (total > 0),
  installments_count int not null check (installments_count between 1 and 520),
  mode text not null default 'equal' check (mode in ('equal','custom')),
  frequency text not null check (frequency in ('monthly','milk_weekly','custom')),
  deduct_source text not null check (deduct_source in ('milk','salary','grain','supplier_bill','cash')),
  -- Had: Admin jo chahe rakhe; dono NULL = koi had nahi.
  cap_pct numeric(6,3) check (cap_pct is null or (cap_pct > 0 and cap_pct <= 100)),
  cap_amount numeric(14,2) check (cap_amount is null or cap_amount > 0),
  start_date date not null,
  status text not null default 'draft' check (status in ('draft','submitted','active','paused','completed','written_off','cancelled')),
  notes text,
  branch_id uuid,
  promise_id uuid,
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  version int not null default 1,
  written_off_amount numeric(14,2) not null default 0,
  updated_at timestamptz not null default now()
);
create index if not exists idx_qist_plans_party on public.qist_plans(party_type, party_id, status);
create index if not exists idx_qist_plans_status on public.qist_plans(status, deduct_source);

create table if not exists public.qist_installments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.qist_plans(id) on delete cascade,
  seq int not null,
  due_date date not null,
  period_start date,
  period_end date,
  amount_due numeric(14,2) not null check (amount_due >= 0),
  amount_deducted numeric(14,2) not null default 0 check (amount_deducted >= 0),
  -- Kami (shortfall) akhir mein EK jama qist mein jaati hai
  is_carry boolean not null default false,
  carried_out numeric(14,2) not null default 0,
  status text not null default 'due' check (status in ('due','partial','paid','written_off','cancelled')),
  updated_at timestamptz not null default now(),
  unique (plan_id, seq),
  check (amount_deducted + carried_out <= amount_due + 0.01)
);
create index if not exists idx_qist_installments_due on public.qist_installments(due_date) where status = 'due';
create unique index if not exists uq_qist_one_carry on public.qist_installments(plan_id) where is_carry and status = 'due';

create table if not exists public.qist_deductions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.qist_plans(id),
  installment_id uuid not null references public.qist_installments(id),
  source_type text not null check (source_type in ('milk','salary','grain','supplier_bill','cash')),
  source_table text not null,
  source_id uuid not null,
  amount numeric(14,2) not null check (amount > 0),
  carry_installment_id uuid references public.qist_installments(id),
  carry_added numeric(14,2) not null default 0,
  journal_entry_id uuid,
  created_by uuid default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (installment_id, source_table, source_id)
);
create index if not exists idx_qist_deductions_source on public.qist_deductions(source_table, source_id);

create table if not exists public.qist_plan_events (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.qist_plans(id),
  action text not null check (action in ('created','submitted','approved','rejected','paused','resumed','rescheduled','edited','written_off','completed','cancelled','deducted','reversed')),
  reason text,
  amount numeric(14,2),
  before_state jsonb,
  after_state jsonb,
  journal_entry_id uuid,
  by_profile uuid default auth.uid() references public.profiles(id),
  at timestamptz not null default now()
);
create index if not exists idx_qist_events_plan on public.qist_plan_events(plan_id, at desc);

-- Halat sirf engine functions se. Draft mein maker installments bana/badal sakta hai.
create or replace function public.fn_guard_qist_plan()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then raise exception 'Qist plan mitaya nahi ja sakta -- cancel karein.'; end if;
    return old;
  end if;
  if tg_op = 'INSERT' then
    if current_setting('agribridge.qist_fn', true) is distinct from 'on' then
      new.status := 'draft'; new.approved_by := null; new.approved_at := null;
    end if;
    return new;
  end if;
  if current_setting('agribridge.qist_fn', true) is distinct from 'on' then
    if old.status <> 'draft' or new.status <> 'draft' then raise exception 'Qist plan ki halat sirf manzoori/engine se badalti hai.'; end if;
    if new.created_by <> old.created_by then raise exception 'Banane wala badla nahi ja sakta.'; end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists trg_guard_qist_plan on public.qist_plans;
create trigger trg_guard_qist_plan before insert or update or delete on public.qist_plans
  for each row execute function public.fn_guard_qist_plan();

create or replace function public.fn_guard_qist_installment()
returns trigger language plpgsql as $$
declare v_status text;
begin
  if current_setting('agribridge.qist_fn', true) = 'on' then
    if tg_op <> 'DELETE' then new.updated_at := now(); end if;
    return coalesce(new, old);
  end if;
  select status into v_status from public.qist_plans where id = coalesce(new.plan_id, old.plan_id);
  if v_status <> 'draft' then raise exception 'Chalu plan ki qistein sirf "Dobara schedule" se badalti hain.'; end if;
  if tg_op <> 'DELETE' and (new.amount_deducted <> 0 or new.status <> 'due' or new.is_carry) then
    raise exception 'Draft qist mein kattauti/halat nahi likhi ja sakti.';
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists trg_guard_qist_installment on public.qist_installments;
create trigger trg_guard_qist_installment before insert or update or delete on public.qist_installments
  for each row execute function public.fn_guard_qist_installment();

create or replace function public.fn_guard_qist_engine_only()
returns trigger language plpgsql as $$
begin
  if current_setting('agribridge.qist_fn', true) is distinct from 'on' then
    raise exception 'Ye record sirf Qist engine likhta hai.';
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists trg_guard_qist_deductions on public.qist_deductions;
create trigger trg_guard_qist_deductions before insert or update or delete on public.qist_deductions
  for each row execute function public.fn_guard_qist_engine_only();
drop trigger if exists trg_guard_qist_events on public.qist_plan_events;
create trigger trg_guard_qist_events before update or delete on public.qist_plan_events
  for each row execute function public.fn_guard_qist_engine_only();

alter table public.qist_plans enable row level security;
alter table public.qist_installments enable row level security;
alter table public.qist_deductions enable row level security;
alter table public.qist_plan_events enable row level security;

drop policy if exists qist_plans_read on public.qist_plans;
create policy qist_plans_read on public.qist_plans for select to authenticated
  using (public.fn_qist_is_maker() or (party_type = 'staff' and party_id = auth.uid()));
drop policy if exists qist_plans_insert on public.qist_plans;
create policy qist_plans_insert on public.qist_plans for insert to authenticated
  with check (public.fn_qist_is_maker() and created_by = auth.uid() and not (party_type = 'staff' and party_id = auth.uid()));
drop policy if exists qist_plans_update on public.qist_plans;
create policy qist_plans_update on public.qist_plans for update to authenticated
  using (public.fn_qist_is_maker() and status = 'draft') with check (public.fn_qist_is_maker());
drop policy if exists qist_plans_delete on public.qist_plans;
create policy qist_plans_delete on public.qist_plans for delete to authenticated
  using (public.fn_qist_is_maker() and status = 'draft' and created_by = auth.uid());

drop policy if exists qist_installments_read on public.qist_installments;
create policy qist_installments_read on public.qist_installments for select to authenticated
  using (exists (select 1 from public.qist_plans p where p.id = plan_id and (public.fn_qist_is_maker() or (p.party_type = 'staff' and p.party_id = auth.uid()))));
drop policy if exists qist_installments_write on public.qist_installments;
create policy qist_installments_write on public.qist_installments for all to authenticated
  using (public.fn_qist_is_maker()) with check (public.fn_qist_is_maker());

drop policy if exists qist_deductions_read on public.qist_deductions;
create policy qist_deductions_read on public.qist_deductions for select to authenticated using (public.fn_qist_is_maker());
drop policy if exists qist_events_read on public.qist_plan_events;
create policy qist_events_read on public.qist_plan_events for select to authenticated using (public.fn_qist_is_maker());

revoke execute on function public.fn_qist_is_maker() from public, anon;
revoke execute on function public.fn_qist_is_approver() from public, anon;
grant execute on function public.fn_qist_is_maker() to authenticated;
grant execute on function public.fn_qist_is_approver() to authenticated;
