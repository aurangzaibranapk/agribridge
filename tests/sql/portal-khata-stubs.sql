-- Test-only stubs of live objects that 565 depends on (PGlite).
create role anon; create role authenticated; create role service_role;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create type credit_source_type as enum ('seed','fertilizer','pesticide','machinery','produce_repayment','other','milk','wanda','opening_balance','grain_procurement');
create type credit_ledger_type as enum ('debit','credit');
create table public.farmers (id uuid primary key default gen_random_uuid(), user_id uuid, full_name text, credit_limit numeric default 0, created_at timestamptz default now());
create table public.customers (id uuid primary key default gen_random_uuid(), user_id uuid, farmer_id uuid, name text, credit_limit numeric default 0);
create table public.journal_entries (id uuid primary key default gen_random_uuid(), entry_number text, entry_date date, description text,
  source_module text, source_id uuid, is_reversal boolean default false, created_at timestamptz default now());
create table public.journal_lines (id uuid primary key default gen_random_uuid(), entry_id uuid, account_code text, debit numeric default 0,
  credit numeric default 0, party_type text, party_id uuid, memo text);
create table public.shops (id uuid primary key default gen_random_uuid(), name text, business_type text);
create table public.products (id uuid primary key default gen_random_uuid(), name text);
create table public.pos_sales (id uuid primary key default gen_random_uuid(), shop_id uuid, customer_id uuid);
create table public.pos_sale_items (id uuid primary key default gen_random_uuid(), sale_id uuid, product_id uuid, quantity numeric, subtotal numeric);
create table public.pos_returns (id uuid primary key default gen_random_uuid(), sale_id uuid);
create table public.farmer_credit_ledger (id uuid primary key default gen_random_uuid(), farmer_id uuid, source_type credit_source_type,
  ledger_type credit_ledger_type, amount numeric, notes text, created_at timestamptz default now());
create table public.milk_entries (id uuid primary key default gen_random_uuid(), farmer_id uuid, entry_date date, quantity_liters numeric,
  total_amount numeric, status text, created_at timestamptz default now());
create table public.milk_payments (id uuid primary key default gen_random_uuid(), farmer_id uuid, amount numeric, payment_date date,
  payment_method text, notes text, created_at timestamptz default now());
create table public.payment_promises (id uuid primary key default gen_random_uuid(), party_type text, party_id uuid, promised_amount numeric,
  promise_date date, status text, fulfilled_amount numeric, terms_channel text, created_at timestamptz default now());
create table public.score_snapshots (id uuid primary key default gen_random_uuid(), subject_type text, subject_id uuid, snapshot_date date,
  score int, band text, state text);
create table public.qist_plans (id uuid primary key default gen_random_uuid(), party_type text, party_id uuid, status text);
create table public.qist_installments (id uuid primary key default gen_random_uuid(), plan_id uuid, due_date date, amount_due numeric,
  amount_deducted numeric default 0, status text default 'due');
create function public.fn_credit_eligibility(p_subject_type text, p_subject_id uuid)
  returns table (level text, blocked text[], requires_human_approval boolean, reasons jsonb)
  language sql stable as $$ select 'standard'::text, array[]::text[], false, '[]'::jsonb $$;
