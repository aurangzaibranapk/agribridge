-- AgriBridge merchant finance phase 2
-- Additive only: no existing business row is deleted or rewritten.

create sequence if not exists public.merchant_settlement_code_seq;

alter table public.suppliers
  add column if not exists user_id uuid references auth.users(id) on delete set null;
create unique index if not exists ux_suppliers_user_id
  on public.suppliers(user_id) where user_id is not null;

create table if not exists public.merchant_commission_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.fn_default_organization_id(),
  merchant_role text not null check (merchant_role in ('dealer','supplier')),
  merchant_id uuid,
  category text,
  mode text not null check (mode in ('percent','fixed')),
  value numeric(14,4) not null check (value >= 0),
  minimum_amount numeric(14,2) check (minimum_amount is null or minimum_amount >= 0),
  priority int not null default 100,
  starts_on date not null default current_date,
  ends_on date,
  is_active boolean not null default true,
  notes text,
  created_by uuid default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on),
  check (mode <> 'percent' or value <= 100)
);
create index if not exists idx_merchant_commission_rule_pick
  on public.merchant_commission_rules
  (organization_id, merchant_role, merchant_id, is_active, priority, starts_on, ends_on);

alter table public.bridge_orders
  add column if not exists commission_rule_id uuid references public.merchant_commission_rules(id),
  add column if not exists commission_mode text check (commission_mode is null or commission_mode in ('percent','fixed')),
  add column if not exists commission_value numeric(14,4),
  add column if not exists commission_minimum numeric(14,2),
  add column if not exists commission_snapshot_at timestamptz,
  add column if not exists guarantee_status text not null default 'not_guaranteed'
    check (guarantee_status in ('not_guaranteed','pending','approved','active','settled','rejected','cancelled')),
  add column if not exists guarantee_terms jsonb not null default '{}'::jsonb,
  add column if not exists guarantee_requested_at timestamptz,
  add column if not exists guarantee_approved_by uuid references public.profiles(id),
  add column if not exists guarantee_approved_at timestamptz,
  add column if not exists guarantee_note text;

create unique index if not exists ux_dealer_payouts_order
  on public.dealer_payouts(order_id);

create table if not exists public.merchant_settlements (
  id uuid primary key default gen_random_uuid(),
  settlement_number text not null unique default
    ('MS-' || lpad(nextval('public.merchant_settlement_code_seq')::text, 7, '0')),
  organization_id uuid not null default public.fn_default_organization_id(),
  merchant_role text not null check (merchant_role in ('dealer','supplier')),
  merchant_id uuid not null,
  source_type text not null check (source_type in ('guaranteed_order','supplier_bill','subscription','manual_adjustment')),
  source_id uuid not null,
  gross_amount numeric(14,2) not null check (gross_amount >= 0),
  commission_amount numeric(14,2) not null default 0 check (commission_amount >= 0),
  net_amount numeric(14,2) generated always as (gross_amount - commission_amount) stored,
  due_date date,
  status text not null default 'pending' check (status in ('pending','approved','paid','held','cancelled')),
  bank_reference text,
  proof_url text,
  paid_at timestamptz,
  created_by uuid default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_role, merchant_id, source_type, source_id),
  check (commission_amount <= gross_amount)
);
create index if not exists idx_merchant_settlements_party
  on public.merchant_settlements(merchant_role, merchant_id, status, due_date);

alter table public.milk_payments
  add column if not exists gross_amount numeric(14,2),
  add column if not exists qist_deduction numeric(14,2) not null default 0,
  add column if not exists net_bank_amount numeric(14,2);

create table if not exists public.milk_qist_adjustments (
  id uuid primary key default gen_random_uuid(),
  milk_payment_id uuid not null unique references public.milk_payments(id) on delete restrict,
  farmer_id uuid not null references public.farmers(id) on delete restrict,
  gross_milk_amount numeric(14,2) not null check (gross_milk_amount >= 0),
  installment_applied numeric(14,2) not null default 0 check (installment_applied >= 0),
  farmer_bank_amount numeric(14,2) not null check (farmer_bank_amount >= 0),
  created_by uuid default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  check (abs(gross_milk_amount - installment_applied - farmer_bank_amount) < 0.01)
);
create index if not exists idx_milk_qist_adjustments_farmer
  on public.milk_qist_adjustments(farmer_id, created_at desc);

create or replace function public.fn_merchant_finance_admin()
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active
      and p.role::text in ('owner','super_admin','admin','finance')
  )
$$;

create or replace function public.fn_merchant_is_self(p_role text, p_id uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select case p_role
    when 'dealer' then exists (
      select 1 from public.dealers d where d.id = p_id and d.user_id = auth.uid()
    )
    when 'supplier' then exists (
      select 1 from public.suppliers s where s.id = p_id and s.user_id = auth.uid()
    )
    else false
  end
$$;

create or replace function public.fn_qist_party_is_self(p_type text, p_id uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select case p_type
    when 'staff' then p_id = auth.uid()
    when 'farmer' then exists (
      select 1 from public.farmers f where f.id = p_id and f.user_id = auth.uid()
    )
    when 'customer' then exists (
      select 1 from public.customers c where c.id = p_id and c.user_id = auth.uid()
    )
    when 'dealer' then exists (
      select 1 from public.dealers d where d.id = p_id and d.user_id = auth.uid()
    )
    when 'supplier' then exists (
      select 1 from public.suppliers s where s.id = p_id and s.user_id = auth.uid()
    )
    else false
  end
$$;

-- Freeze the exact rule on the order. Later rule edits never alter old orders.
create or replace function public.fn_apply_bridge_order_commission()
returns trigger
language plpgsql
security definer
set search_path = '' as $$
declare
  v_rule public.merchant_commission_rules%rowtype;
  v_commission numeric(14,2) := 0;
begin
  if tg_op = 'UPDATE'
     and old.commission_snapshot_at is not null
     and (old.guarantee_status in ('approved','active','settled') or old.status::text <> 'placed') then
    new.commission_rule_id := old.commission_rule_id;
    new.commission_mode := old.commission_mode;
    new.commission_value := old.commission_value;
    new.commission_minimum := old.commission_minimum;
    new.commission_rate_applied := old.commission_rate_applied;
    new.commission_amount := old.commission_amount;
    new.dealer_payout_amount := old.dealer_payout_amount;
    new.commission_snapshot_at := old.commission_snapshot_at;
    return new;
  end if;

  select r.* into v_rule
  from public.merchant_commission_rules r
  where r.organization_id = new.organization_id
    and r.merchant_role = 'dealer'
    and (r.merchant_id = new.assigned_dealer_id or r.merchant_id is null)
    and r.category is null
    and r.is_active
    and r.starts_on <= current_date
    and (r.ends_on is null or r.ends_on >= current_date)
  order by (r.merchant_id is not null) desc, r.priority desc, r.created_at desc
  limit 1;

  if v_rule.id is null then
    new.commission_rule_id := null;
    new.commission_mode := 'percent';
    new.commission_value := 0;
    new.commission_minimum := 0;
    new.commission_rate_applied := 0;
    v_commission := 0;
  elsif v_rule.mode = 'fixed' then
    new.commission_rule_id := v_rule.id;
    new.commission_mode := v_rule.mode;
    new.commission_value := v_rule.value;
    new.commission_minimum := coalesce(v_rule.minimum_amount, 0);
    new.commission_rate_applied := null;
    v_commission := greatest(v_rule.value, coalesce(v_rule.minimum_amount, 0));
  else
    new.commission_rule_id := v_rule.id;
    new.commission_mode := v_rule.mode;
    new.commission_value := v_rule.value;
    new.commission_minimum := coalesce(v_rule.minimum_amount, 0);
    new.commission_rate_applied := v_rule.value / 100;
    v_commission := greatest(round(new.subtotal * v_rule.value / 100, 2), coalesce(v_rule.minimum_amount, 0));
  end if;

  new.commission_amount := least(greatest(coalesce(new.subtotal, 0), 0), greatest(v_commission, 0));
  new.dealer_payout_amount := greatest(coalesce(new.subtotal, 0) - new.commission_amount, 0);
  new.commission_snapshot_at := now();
  return new;
end
$$;

drop trigger if exists trg_bridge_order_commission on public.bridge_orders;
create trigger trg_bridge_order_commission
  before insert or update of subtotal, assigned_dealer_id on public.bridge_orders
  for each row execute function public.fn_apply_bridge_order_commission();

create or replace function public.fn_guard_bridge_finance_fields()
returns trigger
language plpgsql
security invoker
set search_path = '' as $$
begin
  if current_setting('agribridge.merchant_fn', true) = 'on'
     or public.fn_merchant_finance_admin() then return new; end if;
  if new.commission_rule_id is distinct from old.commission_rule_id
     or new.commission_mode is distinct from old.commission_mode
     or new.commission_value is distinct from old.commission_value
     or new.commission_minimum is distinct from old.commission_minimum
     or new.commission_amount is distinct from old.commission_amount
     or new.dealer_payout_amount is distinct from old.dealer_payout_amount
     or new.guarantee_status is distinct from old.guarantee_status
     or new.guarantee_terms is distinct from old.guarantee_terms
     or new.guarantee_approved_by is distinct from old.guarantee_approved_by
     or new.guarantee_approved_at is distinct from old.guarantee_approved_at then
    raise exception 'Commission aur guarantee fields sirf Admin/Finance badal sakte hain.';
  end if;
  return new;
end
$$;

drop trigger if exists trg_guard_bridge_finance_fields on public.bridge_orders;
create trigger trg_guard_bridge_finance_fields
  before update on public.bridge_orders
  for each row execute function public.fn_guard_bridge_finance_fields();

create or replace function public.fn_activate_guaranteed_dealer_payout(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = '' as $$
declare v_order public.bridge_orders%rowtype;
begin
  select * into v_order from public.bridge_orders where id = p_order_id for update;
  if v_order.id is null or v_order.assigned_dealer_id is null then return; end if;
  if v_order.status::text <> 'delivered' or v_order.guarantee_status not in ('approved','active') then return; end if;

  perform set_config('agribridge.merchant_fn', 'on', true);
  update public.bridge_orders
  set guarantee_status = 'active'
  where id = v_order.id and guarantee_status = 'approved';

  insert into public.dealer_payouts(dealer_id, order_id, amount, status)
  values (v_order.assigned_dealer_id, v_order.id, v_order.dealer_payout_amount, 'pending')
  on conflict (order_id) do nothing;

  insert into public.merchant_settlements(
    organization_id, merchant_role, merchant_id, source_type, source_id,
    gross_amount, commission_amount, due_date, status
  ) values (
    v_order.organization_id, 'dealer', v_order.assigned_dealer_id,
    'guaranteed_order', v_order.id, v_order.subtotal, v_order.commission_amount,
    current_date + 7, 'pending'
  ) on conflict (merchant_role, merchant_id, source_type, source_id) do nothing;
end
$$;

create or replace function public.fn_request_order_guarantee(
  p_order_id uuid,
  p_terms jsonb default '{}'::jsonb,
  p_note text default null
)
returns public.bridge_orders
language plpgsql
security definer
set search_path = '' as $$
declare v_row public.bridge_orders%rowtype;
begin
  select o.* into v_row
  from public.bridge_orders o
  where o.id = p_order_id
    and (
      exists (select 1 from public.farmers f where f.id = o.farmer_id and f.user_id = auth.uid())
      or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active
        and p.role::text in ('owner','super_admin','admin','manager','sales_staff'))
    )
  for update;
  if v_row.id is null then raise exception 'Order nahi mila ya ijazat nahi.'; end if;
  if v_row.guarantee_status in ('approved','active','settled') then
    raise exception 'Approved guarantee dobara request nahi ho sakti.';
  end if;
  perform set_config('agribridge.merchant_fn', 'on', true);
  update public.bridge_orders
  set guarantee_status = 'pending', guarantee_terms = coalesce(p_terms, '{}'::jsonb),
      guarantee_note = nullif(btrim(p_note), ''), guarantee_requested_at = now(),
      guarantee_approved_by = null, guarantee_approved_at = null
  where id = p_order_id returning * into v_row;
  return v_row;
end
$$;

create or replace function public.fn_admin_approve_order_guarantee(
  p_order_id uuid,
  p_approve boolean,
  p_note text default null,
  p_terms jsonb default '{}'::jsonb
)
returns public.bridge_orders
language plpgsql
security definer
set search_path = '' as $$
declare v_row public.bridge_orders%rowtype;
begin
  if not exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_active
      and p.role::text in ('owner','super_admin','admin')
  ) then raise exception 'Sirf Admin guarantee approve/reject kar sakta hai.'; end if;

  perform set_config('agribridge.merchant_fn', 'on', true);
  update public.bridge_orders
  set guarantee_status = case when p_approve then 'approved' else 'rejected' end,
      guarantee_terms = coalesce(p_terms, '{}'::jsonb),
      guarantee_note = nullif(btrim(p_note), ''),
      guarantee_approved_by = auth.uid(),
      guarantee_approved_at = now(),
      guarantee_requested_at = coalesce(guarantee_requested_at, now())
  where id = p_order_id
  returning * into v_row;
  if v_row.id is null then raise exception 'Order nahi mila.'; end if;
  if p_approve then perform public.fn_activate_guaranteed_dealer_payout(v_row.id); end if;
  select * into v_row from public.bridge_orders where id = p_order_id;
  return v_row;
end
$$;

-- Verification no longer creates a guaranteed payout. Delivery + Admin approval does.
create or replace function public.fn_create_payout_on_verification()
returns trigger
language plpgsql
security definer
set search_path = '' as $$
begin
  if new.status::text = 'staff_verified' and old.status::text is distinct from 'staff_verified' then
    new.verified_at := now();
  end if;
  if new.status::text = 'delivered' and old.status::text is distinct from 'delivered' then
    new.delivered_at := now();
  end if;
  return new;
end
$$;

create or replace function public.fn_after_bridge_order_delivery()
returns trigger
language plpgsql
security definer
set search_path = '' as $$
begin
  if new.status::text = 'delivered' and old.status::text is distinct from 'delivered' then
    perform public.fn_activate_guaranteed_dealer_payout(new.id);
  end if;
  return new;
end
$$;
drop trigger if exists trg_after_bridge_order_delivery on public.bridge_orders;
create trigger trg_after_bridge_order_delivery
  after update of status on public.bridge_orders
  for each row execute function public.fn_after_bridge_order_delivery();

create or replace function public.fn_apply_milk_qist_payment(p_milk_payment_id uuid)
returns public.milk_qist_adjustments
language plpgsql
security definer
set search_path = '' as $$
declare
  v_payment public.milk_payments%rowtype;
  v_existing public.milk_qist_adjustments%rowtype;
  v_plan public.qist_plans%rowtype;
  v_inst public.qist_installments%rowtype;
  v_gross numeric(14,2);
  v_budget numeric(14,2);
  v_apply numeric(14,2);
  v_total numeric(14,2) := 0;
  v_left numeric(14,2);
  v_role text;
begin
  select p.role::text into v_role from public.profiles p where p.id = auth.uid() and p.is_active;
  if coalesce(v_role, '') not in ('owner','super_admin','admin','finance','manager') then
    raise exception 'Milk qist posting ki ijazat nahi.';
  end if;

  select * into v_existing from public.milk_qist_adjustments where milk_payment_id = p_milk_payment_id;
  if v_existing.id is not null then return v_existing; end if;

  select * into v_payment from public.milk_payments where id = p_milk_payment_id for update;
  if v_payment.id is null then raise exception 'Milk payment nahi mili.'; end if;
  select * into v_existing from public.milk_qist_adjustments where milk_payment_id = p_milk_payment_id;
  if v_existing.id is not null then return v_existing; end if;
  v_gross := round(greatest(coalesce(v_payment.gross_amount, v_payment.amount), 0), 2);
  v_left := v_gross;

  for v_plan in
    select p.* from public.qist_plans p
    where p.party_type = 'farmer' and p.party_id = v_payment.farmer_id
      and p.status = 'active' and p.deduct_source = 'milk'
    order by p.start_date, p.created_at
    for update
  loop
    v_budget := v_left;
    if v_plan.cap_pct is not null then v_budget := least(v_budget, round(v_gross * v_plan.cap_pct / 100, 2)); end if;
    if v_plan.cap_amount is not null then v_budget := least(v_budget, v_plan.cap_amount); end if;

    for v_inst in
      select i.* from public.qist_installments i
      where i.plan_id = v_plan.id and i.status in ('due','partial')
        and i.due_date <= v_payment.payment_date
      order by i.due_date, i.seq
      for update
    loop
      exit when v_budget <= 0 or v_left <= 0;
      v_apply := least(v_budget, v_left, greatest(v_inst.amount_due - v_inst.amount_deducted - v_inst.carried_out, 0));
      if v_apply <= 0 then continue; end if;
      perform set_config('agribridge.qist_fn', 'on', true);
      update public.qist_installments
      set amount_deducted = amount_deducted + v_apply,
          status = case when amount_deducted + v_apply + carried_out >= amount_due - 0.01 then 'paid' else 'partial' end
      where id = v_inst.id;
      insert into public.qist_deductions(
        plan_id, installment_id, source_type, source_table, source_id, amount, created_by
      ) values (v_plan.id, v_inst.id, 'milk', 'milk_payments', v_payment.id, v_apply, auth.uid())
      on conflict (installment_id, source_table, source_id) do nothing;
      insert into public.qist_plan_events(plan_id, action, amount, reason, by_profile)
      values (v_plan.id, 'deducted', v_apply, 'Weekly milk payment adjustment', auth.uid());
      v_budget := v_budget - v_apply;
      v_left := v_left - v_apply;
      v_total := v_total + v_apply;
    end loop;

    if not exists (
      select 1 from public.qist_installments i
      where i.plan_id = v_plan.id and i.status in ('due','partial')
        and i.amount_deducted + i.carried_out < i.amount_due - 0.01
    ) then
      perform set_config('agribridge.qist_fn', 'on', true);
      update public.qist_plans set status = 'completed', updated_at = now() where id = v_plan.id;
      insert into public.qist_plan_events(plan_id, action, reason, by_profile)
      values (v_plan.id, 'completed', 'All installments paid', auth.uid());
    end if;
  end loop;

  update public.milk_payments
  set gross_amount = v_gross, qist_deduction = v_total, net_bank_amount = v_gross - v_total
  where id = v_payment.id;

  insert into public.milk_qist_adjustments(
    milk_payment_id, farmer_id, gross_milk_amount, installment_applied,
    farmer_bank_amount, created_by
  ) values (
    v_payment.id, v_payment.farmer_id, v_gross, v_total, v_gross - v_total, auth.uid()
  ) returning * into v_existing;
  return v_existing;
end
$$;

alter table public.merchant_commission_rules enable row level security;
alter table public.merchant_settlements enable row level security;
alter table public.milk_qist_adjustments enable row level security;

drop policy if exists merchant_commission_admin_all on public.merchant_commission_rules;
create policy merchant_commission_admin_all on public.merchant_commission_rules
  for all to authenticated using (public.fn_merchant_finance_admin())
  with check (public.fn_merchant_finance_admin());

drop policy if exists merchant_settlement_admin_all on public.merchant_settlements;
create policy merchant_settlement_admin_all on public.merchant_settlements
  for all to authenticated using (public.fn_merchant_finance_admin())
  with check (public.fn_merchant_finance_admin());
drop policy if exists merchant_settlement_own_read on public.merchant_settlements;
create policy merchant_settlement_own_read on public.merchant_settlements
  for select to authenticated using (public.fn_merchant_is_self(merchant_role, merchant_id));

drop policy if exists milk_qist_admin_all on public.milk_qist_adjustments;
create policy milk_qist_admin_all on public.milk_qist_adjustments
  for all to authenticated using (public.fn_merchant_finance_admin())
  with check (public.fn_merchant_finance_admin());
drop policy if exists milk_qist_farmer_read on public.milk_qist_adjustments;
create policy milk_qist_farmer_read on public.milk_qist_adjustments
  for select to authenticated using (
    exists (select 1 from public.farmers f where f.id = farmer_id and f.user_id = auth.uid())
  );

drop policy if exists supplier_own_profile on public.suppliers;
create policy supplier_own_profile on public.suppliers
  for select to authenticated using (user_id = auth.uid());
drop policy if exists supplier_update_own_profile on public.suppliers;
create policy supplier_update_own_profile on public.suppliers
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists qist_plans_read on public.qist_plans;
create policy qist_plans_read on public.qist_plans for select to authenticated
  using (public.fn_qist_is_maker() or public.fn_qist_party_is_self(party_type, party_id));
drop policy if exists qist_installments_read on public.qist_installments;
create policy qist_installments_read on public.qist_installments for select to authenticated
  using (exists (
    select 1 from public.qist_plans p where p.id = plan_id
      and (public.fn_qist_is_maker() or public.fn_qist_party_is_self(p.party_type, p.party_id))
  ));
drop policy if exists qist_deductions_read on public.qist_deductions;
create policy qist_deductions_read on public.qist_deductions for select to authenticated
  using (exists (
    select 1 from public.qist_plans p where p.id = plan_id
      and (public.fn_qist_is_maker() or public.fn_qist_party_is_self(p.party_type, p.party_id))
  ));

grant select, insert, update, delete on public.merchant_commission_rules to authenticated;
grant select, insert, update, delete on public.merchant_settlements to authenticated;
grant select, insert, update, delete on public.milk_qist_adjustments to authenticated;
grant usage, select on sequence public.merchant_settlement_code_seq to authenticated;

revoke execute on function public.fn_merchant_finance_admin() from public, anon;
revoke execute on function public.fn_merchant_is_self(text, uuid) from public, anon;
revoke execute on function public.fn_qist_party_is_self(text, uuid) from public, anon;
revoke execute on function public.fn_apply_bridge_order_commission() from public, anon, authenticated;
revoke execute on function public.fn_activate_guaranteed_dealer_payout(uuid) from public, anon, authenticated;
revoke execute on function public.fn_request_order_guarantee(uuid, jsonb, text) from public, anon;
revoke execute on function public.fn_admin_approve_order_guarantee(uuid, boolean, text, jsonb) from public, anon;
revoke execute on function public.fn_apply_milk_qist_payment(uuid) from public, anon;
grant execute on function public.fn_merchant_finance_admin() to authenticated;
grant execute on function public.fn_merchant_is_self(text, uuid) to authenticated;
grant execute on function public.fn_qist_party_is_self(text, uuid) to authenticated;
grant execute on function public.fn_request_order_guarantee(uuid, jsonb, text) to authenticated;
grant execute on function public.fn_admin_approve_order_guarantee(uuid, boolean, text, jsonb) to authenticated;
grant execute on function public.fn_apply_milk_qist_payment(uuid) to authenticated;

comment on table public.merchant_commission_rules is
  'Flexible dealer/supplier commission rules. Orders retain a snapshot of the selected rule.';
comment on table public.merchant_settlements is
  'Idempotent merchant payable lines; subscription and transaction commission stay separate.';
comment on table public.milk_qist_adjustments is
  'One immutable weekly milk-to-qist allocation per milk payment.';
