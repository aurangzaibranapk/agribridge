-- Test-only stubs for 622 (PGlite). Live shape ki nakal (20 Oct 2026, read-only dekha).
create role anon; create role authenticated; create role service_role;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
grant usage on schema public to authenticated, anon;
grant usage on schema auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
create table public.organizations (id uuid primary key);
create table public.branches (id uuid primary key);
create table public.profiles (id uuid primary key, role text, branch_id uuid, full_name text);
grant select on public.profiles to authenticated;
create function public.fn_is_any_staff() returns boolean language sql stable security definer as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role not in ('farmer','customer')) $$;
create table public.customers (id uuid primary key, name text, phone_number text, current_balance numeric default 0, is_deleted boolean default false);
create table public.suppliers (id uuid primary key, name text, phone_number text, current_payable numeric default 0);
create table public.journal_entries (id uuid primary key default gen_random_uuid(), entry_number text, entry_date date, description text,
  source_module text, created_at timestamptz default now());
create table public.journal_lines (id uuid primary key default gen_random_uuid(), entry_id uuid references public.journal_entries(id),
  account_code text, debit numeric default 0, credit numeric default 0, party_type text, party_id uuid, memo text, line_order int);
create table public.features (key text primary key, label text, label_en text, label_ur text, description text, description_en text,
  description_ur text, route text, icon text, is_sensitive boolean, is_active boolean);
create table public.company_expense_requests (id uuid primary key default gen_random_uuid(), kind text not null, amount numeric,
  constraint company_expense_requests_kind_check check (kind = any (array['kharcha','supplier_ko_diya','staff_ko_advance','kisan_ko_advance',
  'mazdoor_ko_advance','mazdoori_ki_adaigi','customer_se_wasooli','staff_se_wapas','kisan_se_wapas','aamdani','malik_ne_nikala','malik_ka_sarmaya']::text[])));
create table public.party_settlements (
  id uuid primary key default gen_random_uuid(), settlement_number text unique not null,
  party_type text not null check (party_type in ('farmer','staff','customer','supplier')), party_id uuid not null,
  lena_khata text not null, dena_khata text not null, amount numeric(14,2) not null check (amount > 0),
  wajah text not null check (length(trim(wajah)) > 0),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  rejection_reason text, journal_entry_id uuid references public.journal_entries(id), branch_id uuid references public.branches(id),
  created_by uuid references public.profiles(id), approved_by uuid references public.profiles(id), approved_at timestamptz,
  created_at timestamptz not null default now(), constraint chk_settlement_do_khate check (lena_khata <> dena_khata));
create function public.fn_settlement_taala() returns trigger language plpgsql as $$
begin
  if old.status = 'approved' then
    if new.amount is distinct from old.amount or new.party_id is distinct from old.party_id then
      raise exception 'Ye adjustment manzoor ho kar kitab mein ja chuka hai.';
    end if;
  end if;
  return new;
end; $$;
create trigger trg_settlement_taala before update on public.party_settlements for each row execute function public.fn_settlement_taala();
create table public.dashboard_features (dashboard_key text, feature_key text, section text, section_order int, sort_order int,
  primary key (dashboard_key, feature_key));
