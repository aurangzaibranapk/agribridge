-- 641: Maker-checker columns, GL accounts, race indexes.
-- ADDITIVE. Purani posted adaigi 'posted' mark hoti hai taake dobara
-- manzoori na maange. Koi balance overwrite nahi.
-- Live/Testing par tab tak NAHI jab tak backup verify na ho.

insert into public.gl_accounts (code, name, account_type, normal_side, sort_order)
values
  ('2016', 'Dealer ko dena', 'liability', 'credit', 216),
  ('1180', 'Buyer se lena', 'asset', 'debit', 48),
  ('2018', 'Buyer ko dena', 'liability', 'credit', 218)
on conflict (code) do nothing;

-- Kharche atomic claim.
alter table public.company_expense_requests drop constraint if exists company_expense_requests_status_check;
alter table public.company_expense_requests add constraint company_expense_requests_status_check
  check (status = any (array['pending','verified','approving','approved','rejected']));

-- Cash ginti: farq ki GL entry manzoori ke baad.
alter table public.cash_closings add column if not exists approval_status text;
alter table public.cash_closings add column if not exists approved_by uuid references public.profiles(id);
alter table public.cash_closings add column if not exists approved_at timestamptz;
update public.cash_closings
   set approval_status = case
     when journal_entry_id is not null or difference = 0 then 'approved'
     else 'recorded'
   end
 where approval_status is null;
alter table public.cash_closings alter column approval_status set default 'recorded';
alter table public.cash_closings alter column approval_status set not null;
alter table public.cash_closings drop constraint if exists cash_closings_approval_status_check;
alter table public.cash_closings add constraint cash_closings_approval_status_check
  check (approval_status = any (array['recorded','approving','approved']));

-- Dealer / buyer adaigi: pehle darkhwast, phir doosra banda.
alter table public.dealer_payments add column if not exists status text;
alter table public.dealer_payments add column if not exists approved_by uuid references public.profiles(id);
alter table public.dealer_payments add column if not exists approved_at timestamptz;
alter table public.dealer_payments add column if not exists journal_entry_id uuid references public.journal_entries(id);
alter table public.dealer_payments add column if not exists paid_from_account_id uuid references public.finance_accounts(id);
update public.dealer_payments set status = 'posted' where status is null;
alter table public.dealer_payments alter column status set default 'pending';
alter table public.dealer_payments alter column status set not null;
alter table public.dealer_payments drop constraint if exists dealer_payments_status_check;
alter table public.dealer_payments add constraint dealer_payments_status_check
  check (status = any (array['pending','approving','posted','rejected']));

alter table public.buyer_payments add column if not exists status text;
alter table public.buyer_payments add column if not exists approved_by uuid references public.profiles(id);
alter table public.buyer_payments add column if not exists approved_at timestamptz;
alter table public.buyer_payments add column if not exists journal_entry_id uuid references public.journal_entries(id);
alter table public.buyer_payments add column if not exists paid_from_account_id uuid references public.finance_accounts(id);
update public.buyer_payments set status = 'posted' where status is null;
alter table public.buyer_payments alter column status set default 'pending';
alter table public.buyer_payments alter column status set not null;
alter table public.buyer_payments drop constraint if exists buyer_payments_status_check;
alter table public.buyer_payments add constraint buyer_payments_status_check
  check (status = any (array['pending','approving','posted','rejected']));

-- Journal source row 'reversed'.
alter table public.journal_entries add column if not exists posting_status text;
update public.journal_entries set posting_status = 'posted' where posting_status is null;
alter table public.journal_entries alter column posting_status set default 'posted';
alter table public.journal_entries alter column posting_status set not null;
alter table public.journal_entries drop constraint if exists journal_entries_posting_status_check;
alter table public.journal_entries add constraint journal_entries_posting_status_check
  check (posting_status = any (array['posted','reversed']));

create or replace function public.fn_mark_journal_source_reversed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_reversal is true and new.reversal_of is not null then
    update public.journal_entries
       set posting_status = 'reversed'
     where id = new.reversal_of
       and posting_status is distinct from 'reversed';
  end if;
  return new;
end;
$$;

revoke all on function public.fn_mark_journal_source_reversed() from public, anon, authenticated;
drop trigger if exists trg_mark_journal_source_reversed on public.journal_entries;
create trigger trg_mark_journal_source_reversed
  after insert or update of is_reversal, reversal_of on public.journal_entries
  for each row execute function public.fn_mark_journal_source_reversed();

-- Posted adaigi: journal lazmi, aur banane wala khud manzoor nahi.
create or replace function public.fn_guard_party_payment_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'posted' and (tg_op = 'INSERT' or old.status is distinct from 'posted') then
    if new.journal_entry_id is null then
      raise exception 'Adaigi tab tak posted nahi jab tak kitab ki entry na ho.';
    end if;
    if new.approved_by is null or new.approved_by = new.created_by then
      raise exception 'Apni darj ki hui adaigi khud manzoor nahi kar sakte.';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.fn_guard_party_payment_post() from public, anon, authenticated;
drop trigger if exists trg_guard_dealer_payment_post on public.dealer_payments;
create trigger trg_guard_dealer_payment_post
  before insert or update on public.dealer_payments
  for each row execute function public.fn_guard_party_payment_post();
drop trigger if exists trg_guard_buyer_payment_post on public.buyer_payments;
create trigger trg_guard_buyer_payment_post
  before insert or update on public.buyer_payments
  for each row execute function public.fn_guard_party_payment_post();

create or replace function public.fn_guard_cash_close_approve()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.journal_entry_id is not null
     and (tg_op = 'INSERT' or old.journal_entry_id is null)
     and new.difference <> 0
     and (new.approved_by is null or new.approved_by = new.counted_by) then
    raise exception 'Cash farq ki entry jis ne ginti ki us se manzoor nahi hoti.';
  end if;
  return new;
end;
$$;

revoke all on function public.fn_guard_cash_close_approve() from public, anon, authenticated;
drop trigger if exists trg_guard_cash_close_approve on public.cash_closings;
create trigger trg_guard_cash_close_approve
  before insert or update on public.cash_closings
  for each row execute function public.fn_guard_cash_close_approve();

-- dealers.current_payable seedha staff na likhe.
create or replace function public.fn_guard_dealer_payable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_role text;
  session_role text;
begin
  if tg_op = 'UPDATE' and new.current_payable is distinct from old.current_payable then
    jwt_role := coalesce(auth.role(), '');
    session_role := coalesce(nullif(current_setting('role', true), ''), 'none');
    if session_role = 'none' then
      session_role := session_user;
    end if;
    if jwt_role = 'service_role' or session_role in ('service_role', 'postgres', 'supabase_admin') then
      return new;
    end if;
    if exists (
      select 1 from public.profiles
      where id = auth.uid() and is_active is true
        and role::text in ('owner', 'super_admin', 'admin')
    ) then
      return new;
    end if;
    raise exception 'dealers.current_payable sirf Owner, Super Admin ya Admin likh sakte hain.';
  end if;
  return new;
end;
$$;

revoke all on function public.fn_guard_dealer_payable() from public, anon, authenticated;
drop trigger if exists trg_guard_dealer_payable on public.dealers;
create trigger trg_guard_dealer_payable
  before update on public.dealers
  for each row execute function public.fn_guard_dealer_payable();

-- RLS: staff sirf pending darkhwast. Posted update sirf money writer.
do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename in ('dealer_payments', 'buyer_payments')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

create policy dealer_payments_staff_read on public.dealer_payments
  for select using (public.fn_is_any_staff());
create policy dealer_payments_staff_request on public.dealer_payments
  for insert with check (
    public.fn_is_any_staff()
    and status = 'pending'
    and created_by = auth.uid()
  );
create policy dealer_payments_money_update on public.dealer_payments
  for update using (public.fn_is_money_writer())
  with check (public.fn_is_money_writer());

create policy buyer_payments_staff_read on public.buyer_payments
  for select using (public.fn_is_any_staff());
create policy buyer_payments_staff_request on public.buyer_payments
  for insert with check (
    public.fn_is_any_staff()
    and status = 'pending'
    and created_by = auth.uid()
  );
create policy buyer_payments_money_update on public.buyer_payments
  for update using (public.fn_is_money_writer())
  with check (public.fn_is_money_writer());

-- Race indexes. Do dafa click / do dafa approve yahin rukta hai.
create unique index if not exists uq_cash_closing_original
  on public.cash_closings (branch_id, close_date)
  where corrects_id is null;

create unique index if not exists uq_finance_opening_once
  on public.finance_transactions (account_id)
  where category = 'Shuruati balance' and transaction_type::text = 'income';

create unique index if not exists uq_finance_transfer_leg
  on public.finance_transactions (related_transfer_id, transaction_type)
  where related_transfer_id is not null;

create unique index if not exists uq_dealer_payment_pending
  on public.dealer_payments (dealer_id, payment_date, amount, created_by)
  where status = 'pending';

create unique index if not exists uq_buyer_payment_pending
  on public.buyer_payments (buyer_id, payment_date, amount, direction, created_by)
  where status = 'pending';
