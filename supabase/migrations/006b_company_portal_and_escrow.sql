-- =====================================================================
-- AgriBridge — Migration 006b: Company Portal + Full Escrow Flow
-- Run after 006a_company_role.sql.
-- =====================================================================

-- ---------------------------------------------------------------------
-- COMPANY PORTAL — links an auth user to an existing `companies` row.
-- Unlike farmers/dealers/investors, a company isn't self-registered from
-- scratch — the company itself is added by staff under Companies &
-- Brands first, then a rep registers and attaches to it.
-- ---------------------------------------------------------------------
create table company_reps (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  phone_number text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, user_id)
);

-- Needed so the /register/company page can list companies for a rep to
-- pick from before they've signed up — same precedent as the existing
-- public read policies on categories/brands/products in schema.sql.
create policy public_read_companies on companies for select using (true);

alter table company_reps enable row level security;

create policy staff_all_access on company_reps for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin','manager','sales_staff'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin','manager','sales_staff'))
);

create policy company_rep_own_row on company_reps for select using (user_id = auth.uid());

-- A company rep can see their OWN company's row and its products —
-- read-only. They never see other companies' data, farmers, dealers, or
-- anything about the bridge/order engine — their view is scoped strictly
-- to "how are my products doing".
create policy company_rep_own_company on companies for select using (
  exists (select 1 from company_reps cr where cr.company_id = companies.id and cr.user_id = auth.uid())
);
create policy company_rep_own_products on products for select using (
  exists (select 1 from company_reps cr where cr.company_id = products.company_id and cr.user_id = auth.uid())
);

-- Read-only performance visibility: a company rep can see sale_items and
-- inventory rows for THEIR OWN company's products only — never the
-- farmer/customer identity behind a sale, never another company's data.
create policy company_rep_own_product_sales on sale_items for select using (
  exists (
    select 1 from products p join company_reps cr on cr.company_id = p.company_id
    where p.id = sale_items.product_id and cr.user_id = auth.uid()
  )
);
create policy company_rep_own_product_inventory on inventory for select using (
  exists (
    select 1 from products p join company_reps cr on cr.company_id = p.company_id
    where p.id = inventory.product_id and cr.user_id = auth.uid()
  )
);

-- Extend the signup trigger to recognize company_rep as a valid
-- self-selected role — same fix pattern as Migration 002c for
-- dealer/investor.
create or replace function fn_handle_new_user() returns trigger as $$
declare
  v_is_first boolean;
  v_requested_role text;
begin
  select count(*) = 0 into v_is_first from public.profiles;
  v_requested_role := new.raw_user_meta_data->>'role';

  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    case
      when v_is_first then 'super_admin'::user_role
      when v_requested_role in ('farmer', 'customer', 'dealer', 'investor', 'company_rep') then v_requested_role::user_role
      else 'sales_staff'::user_role
    end
  );
  return new;
end;
$$ language plpgsql security definer;

-- ---------------------------------------------------------------------
-- FULL ESCROW FLOW — a real hold-between-two-wallets primitive, built on
-- top of the wallet system from Migration 003. That migration only had a
-- single-wallet escrow_hold/escrow_refund; this adds the missing piece —
-- releasing held funds to a DIFFERENT wallet (the payee), which is what
-- "escrow" actually means. Example use: an investor's funds held against
-- a deal until a milestone is confirmed, then released to the platform
-- or a dealer.
-- ---------------------------------------------------------------------
create type escrow_status as enum ('held', 'released', 'refunded');

create table escrow_transactions (
  id uuid primary key default uuid_generate_v4(),
  payer_wallet_id uuid not null references wallets(id) on delete restrict,
  payee_wallet_id uuid not null references wallets(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  status escrow_status not null default 'held',
  reference_type text,
  reference_id uuid,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  released_at timestamptz,
  refunded_at timestamptz,
  check (payer_wallet_id <> payee_wallet_id)
);
create index idx_escrow_payer on escrow_transactions(payer_wallet_id);
create index idx_escrow_payee on escrow_transactions(payee_wallet_id);

-- Creating an escrow_transactions row with status='held' does NOT by
-- itself move any money — the caller (see src/actions/escrow.ts) inserts
-- the escrow_hold wallet_transaction on the payer's wallet first (which
-- moves balance -> held_balance via the existing trigger from Migration
-- 003), then creates this row to track the hold. This trigger only
-- handles the two SETTLEMENT transitions: held -> released and
-- held -> refunded.
create or replace function fn_settle_escrow() returns trigger as $$
begin
  if old.status <> 'held' then
    raise exception 'This escrow transaction is already settled (%).', old.status;
  end if;

  if new.status = 'released' then
    -- Money leaves escrow permanently and lands with the payee. The
    -- payer's held_balance clears (it was never part of their spendable
    -- balance anyway); the payee's balance is credited through the
    -- normal wallet_transactions trigger for full audit-trail parity
    -- with every other wallet movement.
    update wallets set held_balance = held_balance - new.amount where id = new.payer_wallet_id;
    insert into wallet_transactions (wallet_id, type, direction, amount, reference_type, reference_id, created_by)
      values (new.payee_wallet_id, 'escrow_release', 'credit', new.amount, 'escrow_transaction', new.id, new.created_by);
    new.released_at := now();

  elsif new.status = 'refunded' then
    -- Money returns to the payer — escrow_refund is already special-cased
    -- in fn_apply_wallet_transaction (Migration 003) to move
    -- held_balance back into balance on the SAME wallet, which is
    -- exactly refund semantics.
    insert into wallet_transactions (wallet_id, type, direction, amount, reference_type, reference_id, created_by)
      values (new.payer_wallet_id, 'escrow_refund', 'credit', new.amount, 'escrow_transaction', new.id, new.created_by);
    new.refunded_at := now();
  end if;

  return new;
end;
$$ language plpgsql;

create trigger trg_settle_escrow
  before update of status on escrow_transactions
  for each row execute function fn_settle_escrow();

alter table escrow_transactions enable row level security;
create policy staff_all_access on escrow_transactions for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin','manager','sales_staff'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin','manager','sales_staff'))
);

-- Each side can see an escrow transaction they're party to (read-only —
-- settling it is a staff-only action in this phase, same as
-- postWalletTransaction).
create policy escrow_party_visibility on escrow_transactions for select using (
  exists (
    select 1 from wallets w
    where w.id in (escrow_transactions.payer_wallet_id, escrow_transactions.payee_wallet_id)
    and (
      (w.owner_type = 'farmer' and exists (select 1 from farmers f where f.id = w.owner_id and f.user_id = auth.uid()))
      or (w.owner_type = 'dealer' and exists (select 1 from dealers d where d.id = w.owner_id and d.user_id = auth.uid()))
      or (w.owner_type = 'investor' and exists (select 1 from investors i where i.id = w.owner_id and i.user_id = auth.uid()))
      or (w.owner_type = 'customer' and exists (select 1 from customers c where c.id = w.owner_id and c.user_id = auth.uid()))
    )
  )
);

-- ---------------------------------------------------------------------
-- MULTI-CURRENCY — foundation only. wallets already had currency_code
-- (Migration 003); this adds the tenant-level default so the UI has a
-- sensible fallback when displaying amounts that aren't tied to a
-- specific wallet (e.g. product prices).
-- ---------------------------------------------------------------------
alter table organizations add column if not exists default_currency text not null default 'PKR';
