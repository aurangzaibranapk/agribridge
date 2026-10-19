-- Test-only stubs for 572-573 (on top of portal-khata-stubs.sql + 565). PGlite -- live DB nahi.
grant usage on schema public to anon, authenticated;
grant usage on schema auth to anon, authenticated;
create table auth.users (id uuid primary key, banned_until timestamptz, last_sign_in_at timestamptz);
create type public.user_role as enum ('owner','super_admin','admin','manager','sales_staff','finance','admin_assistant','hr','cashier','accountant','farmer','customer','warehouse','procurement','milk_collection');
create table public.branches (id uuid primary key default gen_random_uuid(), name text);
create table public.profiles (id uuid primary key, role public.user_role, is_active boolean default true, branch_id uuid, extra_roles public.user_role[]);
create function public.fn_has_dept(p_roles public.user_role[]) returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and is_active = true and (role = any (p_roles) or extra_roles && p_roles)) $$;
create function public.fn_is_any_staff() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and is_active and role not in ('farmer','customer')) $$;
alter table public.farmers add column farmer_code text;
alter table public.customers add column contact_person text, add column phone_number text, add column email text, add column address text,
  add column payment_due_days int, add column current_balance numeric default 0, add column is_active boolean default true,
  add column is_deleted boolean default false, add column created_at timestamptz default now(), add column branch_id uuid,
  add column customer_type text, add column cnic text, add column business_name text, add column overdue_block_days int;
alter table public.pos_sales add column crm_customer_id uuid, add column status text default 'completed', add column payment_mode text,
  add column cash_paid numeric default 0, add column khata_amount numeric default 0, add column total_amount numeric,
  add column total_cogs numeric, add column profit numeric, add column created_at timestamptz default now();
alter table public.pos_sale_items add column unit_price numeric, add column unit_cost numeric, add column line_cogs numeric;
alter table public.pos_returns add column return_number text, add column total_amount numeric, add column created_at timestamptz default now();
create table public.agri_orders (id uuid primary key default gen_random_uuid(), order_number text, order_id_display text, order_type text,
  customer_id uuid, subtotal numeric, discount numeric, freight_charges numeric, grand_total numeric, payment_terms text, payment_due_date date,
  status text, credit_limit numeric, existing_outstanding numeric, available_credit numeric, notes text, rejection_reason text,
  sales_verified_by uuid, sales_verified_at timestamptz, finance_verified_by uuid, finance_verified_at timestamptz,
  approved_by uuid, approved_at timestamptz, created_at timestamptz default now());
create table public.agri_order_items (id uuid primary key default gen_random_uuid(), order_id uuid, product_name text, pack_size text,
  order_qty numeric, net_price numeric, line_total numeric, created_at timestamptz default now());
create table public.agri_order_returns (id uuid primary key default gen_random_uuid(), return_number text, order_id uuid, total_amount numeric,
  status text, created_at timestamptz default now());
alter table public.payment_promises add column branch_id uuid, add column notes text, add column created_by uuid, add column approved_by uuid,
  add column promised_days int, add column terms_version text, add column terms_accepted_at timestamptz, add column terms_accepted_by uuid,
  add column signature_ref text, add column assigned_to uuid;
create schema storage;
grant usage on schema storage to authenticated, anon;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to authenticated;
-- 535 ka stub: sirf staff; customer ka 1100 credit (baqaya kam) likhta hai.
create table public.recovery_money_movements (id uuid primary key default gen_random_uuid(), client_action_id uuid unique, amount numeric, party_id uuid, created_by uuid);
create function public.fn_record_recovery_money(p_input jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_m uuid; v_e uuid := gen_random_uuid();
begin
  if auth.uid() is null or not public.fn_is_any_staff() then raise exception 'Staff permission required.'; end if;
  if (p_input->>'financeAccountId') is null then raise exception 'Active cash/bank account chunein.'; end if;
  insert into recovery_money_movements (client_action_id, amount, party_id, created_by)
    values ((p_input->>'clientActionId')::uuid, (p_input->>'amount')::numeric, (p_input->>'partyId')::uuid, auth.uid()) returning id into v_m;
  insert into journal_entries (id, entry_number, entry_date, description, source_module, source_id)
    values (v_e, 'TXN-T', (p_input->>'paymentDate')::date, 'rcv', 'recovery_money', v_m);
  insert into journal_lines (entry_id, account_code, debit, credit, party_type, party_id)
    values (v_e, '1100', 0, (p_input->>'amount')::numeric, 'customer', (p_input->>'partyId')::uuid);
  return jsonb_build_object('success', true, 'id', v_m, 'entryId', v_e);
end $$;
