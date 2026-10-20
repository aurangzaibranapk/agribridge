-- 632: Order stage guards, payment verify once, bridge advance in one
-- transaction, shift close cannot double-post, shortage waits for a
-- different manager, year counters increment atomically.
-- NOT APPLIED. No existing rows are updated.

create or replace function public.fn_next_year_counter(p_table text, p_year int)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  if p_table not in (
    'pos_deposit_counters', 'pos_shift_counters', 'agri_order_counters',
    'agri_payment_counters', 'agri_return_counters'
  ) then
    raise exception 'Counter table not allowed.';
  end if;
  if p_year is null or p_year < 0 or p_year > 99 then
    raise exception 'Counter year is wrong.';
  end if;
  execute format(
    'insert into public.%I as c (year, last_number) values ($1, 1)
     on conflict (year) do update set last_number = c.last_number + 1
     returning last_number',
    p_table
  ) into n using p_year;
  return n;
end;
$$;
revoke all on function public.fn_next_year_counter(text, int) from public, anon, authenticated;
grant execute on function public.fn_next_year_counter(text, int) to service_role;

-- Agri order: status can only move forward, and the person who asked
-- cannot verify or approve their own order.
create or replace function public.fn_agri_order_stage_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'UPDATE' or new.status is not distinct from old.status then
    return new;
  end if;
  if old.status = 'rejected' then
    raise exception 'Rejected order dobara approve nahi hota.';
  end if;
  if new.status = 'sales_verified' and old.status <> 'submitted' then
    raise exception 'Sales verify sirf submitted order par hota hai.';
  end if;
  if new.status = 'finance_verified' and old.status <> 'sales_verified' then
    raise exception 'Finance verify sirf sales-verified order par hota hai.';
  end if;
  if new.status = 'approved' and old.status not in ('submitted', 'sales_verified', 'finance_verified') then
    raise exception 'Approve is stage par nahi ho sakta.';
  end if;
  if new.status = 'sales_verified' and new.sales_verified_by is not distinct from new.requested_by then
    raise exception 'Order maangne wala khud sales verify nahi kar sakta.';
  end if;
  if new.status = 'finance_verified' and new.finance_verified_by is not distinct from new.requested_by then
    raise exception 'Order maangne wala khud finance verify nahi kar sakta.';
  end if;
  if new.status = 'approved' and new.approved_by is not distinct from new.requested_by then
    raise exception 'Order maangne wala khud approve nahi kar sakta.';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_agri_order_stage_guard on public.agri_orders;
create trigger trg_agri_order_stage_guard
  before update on public.agri_orders
  for each row execute function public.fn_agri_order_stage_guard();

-- Payment posts once, and only from pending_verification. The person who
-- entered the payment cannot verify it.
create or replace function ledger_internal.post_order_payment() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare bid uuid; source_id uuid; eid uuid;
begin
  if new.verified_by is not null and new.verified_by is not distinct from new.created_by
     and new.status in ('verified', 'partially_verified') then
    raise exception 'Payment darj karne wala khud verify nahi kar sakta.';
  end if;
  select entry_id into eid from journal_entry_sources where source_table = 'agri_order_payments' and source_row_id = new.id;
  if eid is not null then
    if tg_op = 'UPDATE' and old.status is distinct from new.status then
      raise exception 'Payment pehle hi verify ho chuki hai. Dobara post nahi hoti.';
    end if;
    if new.status not in ('verified', 'partially_verified')
       or new.paid_amount is distinct from old.paid_amount
       or new.payment_method is distinct from old.payment_method
       or new.order_id is distinct from old.order_id then
      raise exception 'Posted payment requires a reversal, not direct editing/rejection';
    end if;
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status is distinct from 'pending_verification' then
    raise exception 'Verify sirf pending payment par hota hai.';
  end if;
  if new.status not in ('verified', 'partially_verified') then return new; end if;
  if new.paid_amount <= 0 then raise exception 'Payment amount must be positive'; end if;
  select order_to_branch_id into bid from agri_orders where id = new.order_id;
  if bid is null then raise exception 'Order payment branch missing'; end if;
  insert into branch_credit_transactions(branch_id, transaction_type, amount, order_id, payment_method, notes, created_by)
  values (bid, 'advance_payment', new.paid_amount, new.order_id, new.payment_method, 'Verified order payment ' || new.payment_number, new.verified_by)
  returning id into source_id;
  select entry_id into eid from journal_entry_sources where source_table = 'branch_credit_transactions' and source_row_id = source_id;
  if eid is null then raise exception 'Order payment journal missing'; end if;
  insert into journal_entry_sources values (eid, 'agri_order_payments', new.id);
  return new;
end $$;
revoke all on function ledger_internal.post_order_payment() from public, anon, authenticated;

-- Bridge advance: one locked update, cash book and journal. Status must still be open.
alter table public.bridge_orders add column if not exists advance_required numeric(14,2) not null default 0;
alter table public.bridge_orders add column if not exists advance_paid numeric(14,2) not null default 0;
alter table public.bridge_orders add column if not exists last_payment_method text;

create or replace function public.fn_record_bridge_advance(
  p_order_id uuid, p_amount numeric, p_account_id uuid, p_method text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.bridge_orders%rowtype;
  v_gl text;
  v_txn uuid;
  v_entry jsonb;
begin
  if auth.uid() is null then raise exception 'Login zaroori hai.'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Amount sahi likhein.'; end if;
  if p_account_id is null then raise exception 'Account select karein.'; end if;
  if coalesce(btrim(p_method), '') = '' then raise exception 'Payment method select karein.'; end if;
  select * into v_order from public.bridge_orders where id = p_order_id for update;
  if not found then raise exception 'Order nahi mili.'; end if;
  if v_order.status not in ('placed', 'assigned', 'dealer_accepted', 'dealer_dispatched', 'staff_verified') then
    raise exception 'Is halat (%) mein advance nahi likh sakte.', v_order.status;
  end if;
  if coalesce(v_order.advance_paid, 0) + p_amount > coalesce(v_order.advance_required, 0) then
    raise exception 'Sirf Rs % baaqi hai.', greatest(0, coalesce(v_order.advance_required, 0) - coalesce(v_order.advance_paid, 0));
  end if;
  update public.bridge_orders
     set advance_paid = coalesce(advance_paid, 0) + p_amount,
         last_payment_method = p_method
   where id = p_order_id;
  select gl_code into v_gl from public.finance_accounts where id = p_account_id;
  v_gl := coalesce(v_gl, '1000');
  insert into public.finance_transactions (account_id, transaction_type, category, amount, transaction_date, notes, created_by, source_table, source_row_id)
  values (p_account_id, 'income', 'Marketplace - Advance Payment', p_amount, (now() at time zone 'Asia/Karachi')::date,
          'Order ' || v_order.order_number || ' - Advance payment (' || p_method || ')', auth.uid(), 'bridge_orders', p_order_id)
  returning id into v_txn;
  v_entry := public.post_journal_atomic(jsonb_build_object(
    'description', 'Bridge advance ' || v_order.order_number,
    'sourceModule', 'bridge_advance',
    'createdBy', auth.uid(),
    'lines', jsonb_build_array(
      jsonb_build_object('account', v_gl, 'debit', p_amount),
      jsonb_build_object('account', '2030', 'credit', p_amount, 'memo', 'Customer advance')
    ),
    'claims', jsonb_build_array(jsonb_build_object('table', 'finance_transactions', 'rowId', v_txn))
  ));
  return jsonb_build_object('ok', true, 'advance_paid', coalesce(v_order.advance_paid, 0) + p_amount, 'entry_id', v_entry->>'id');
end;
$$;
revoke all on function public.fn_record_bridge_advance(uuid, numeric, uuid, text) from public, anon;
grant execute on function public.fn_record_bridge_advance(uuid, numeric, uuid, text) to authenticated, service_role;

-- Shift shortage waits for a different person. Direct salary debit is blocked.
create table if not exists public.pos_shift_shortage_reviews (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null unique references public.pos_shifts(id),
  staff_id uuid not null references public.profiles(id),
  amount numeric(14,2) not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  note text,
  created_by uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  constraint chk_shortage_not_self check (reviewed_by is null or reviewed_by is distinct from created_by)
);
alter table public.pos_shift_shortage_reviews enable row level security;
drop policy if exists pos_shift_shortage_read on public.pos_shift_shortage_reviews;
create policy pos_shift_shortage_read on public.pos_shift_shortage_reviews
  for select to authenticated using (public.fn_is_any_staff());
revoke insert, update, delete on public.pos_shift_shortage_reviews from anon, authenticated;

create or replace function private.fn_block_unapproved_shortage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.source_type = 'shift_shortage'
     and current_setting('agribridge.shortage_approved', true) is distinct from '1' then
    raise exception 'Shift ki kami manager ki manzoori ke baghair salary se nahi katti.';
  end if;
  return new;
end;
$$;
revoke all on function private.fn_block_unapproved_shortage() from public, anon, authenticated;
drop trigger if exists trg_block_unapproved_shortage on public.staff_credit_ledger;
create trigger trg_block_unapproved_shortage
  before insert on public.staff_credit_ledger
  for each row execute function private.fn_block_unapproved_shortage();

create or replace function public.fn_review_shift_shortage(p_shift_id uuid, p_decision text, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.pos_shift_shortage_reviews%rowtype;
  v_role text;
  v_ledger uuid;
begin
  if auth.uid() is null then raise exception 'Login zaroori hai.'; end if;
  if p_decision not in ('approved', 'rejected') then raise exception 'Faisla approved ya rejected hona chahiye.'; end if;
  select role::text into v_role from public.profiles where id = auth.uid() and is_active;
  if v_role not in ('owner', 'super_admin', 'admin', 'manager', 'finance') then
    raise exception 'Shortage ka faisla Manager, Finance ya Admin kare.';
  end if;
  select * into v_row from public.pos_shift_shortage_reviews where shift_id = p_shift_id for update;
  if not found then raise exception 'Is shift ki kami darkhwast nahi mili.'; end if;
  if v_row.status <> 'pending' then raise exception 'Is kami ka faisla pehle ho chuka hai.'; end if;
  if v_row.created_by is not distinct from auth.uid() or v_row.staff_id is not distinct from auth.uid() then
    raise exception 'Apni shift ki kami khud manzoor nahi kar sakte.';
  end if;
  update public.pos_shift_shortage_reviews
     set status = p_decision, reviewed_by = auth.uid(), reviewed_at = now(), review_note = nullif(btrim(p_note), '')
   where id = v_row.id and status = 'pending';
  if p_decision = 'approved' then
    perform set_config('agribridge.shortage_approved', '1', true);
    insert into public.staff_credit_ledger (profile_id, ledger_type, source_type, amount, notes, created_by)
    values (v_row.staff_id, 'debit', 'shift_shortage', v_row.amount, coalesce(v_row.note, 'Shift shortage'), auth.uid())
    returning id into v_ledger;
  end if;
  return jsonb_build_object('ok', true, 'status', p_decision, 'ledger_id', v_ledger);
end;
$$;
revoke all on function public.fn_review_shift_shortage(uuid, text, text) from public, anon;
grant execute on function public.fn_review_shift_shortage(uuid, text, text) to authenticated, service_role;

create unique index if not exists uq_journal_pos_shift_close
  on public.journal_entries (source_module, source_id)
  where source_module = 'pos_shift_close' and source_id is not null;

notify pgrst, 'reload schema';
