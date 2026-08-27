-- =====================================================================
-- AgriBridge ERP — Supabase (PostgreSQL) Schema — Phase 1 (Al Rana Traders)
-- Run this in the Supabase SQL Editor once, on a fresh project.
-- Uses Supabase Auth (auth.users) for login; this file adds the business
-- schema + a `profiles` table linked 1:1 to auth.users for roles/RBAC.
-- =====================================================================

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------
-- ROLES & USER PROFILES (RBAC on top of Supabase Auth)
-- ---------------------------------------------------------------------
create type user_role as enum ('super_admin', 'admin', 'manager', 'sales_staff', 'farmer', 'customer');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone_number text,
  role user_role not null default 'sales_staff',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Auto-create a profile row whenever someone signs up via Supabase Auth, so
-- there's never a user without a role/profile. full_name is read from the
-- signup call's options.data.full_name (see LoginForm/signup usage) and
-- falls back to the email if not supplied. The FIRST user to ever sign up
-- becomes super_admin automatically; everyone after defaults to sales_staff
-- and an admin promotes them from the Users & Roles page.
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
      when v_requested_role in ('farmer', 'customer') then v_requested_role::user_role
      else 'sales_staff'::user_role
    end
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function fn_handle_new_user();

-- ---------------------------------------------------------------------
-- COMPANY MANAGEMENT (suppliers' companies, brands, categories)
-- ---------------------------------------------------------------------
create table companies (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  contact_person text,
  phone_number text,
  email text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table brands (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  company_id uuid references companies(id) on delete set null,
  logo_url text,
  created_at timestamptz not null default now()
);

create table categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  parent_category_id uuid references categories(id) on delete set null,
  created_at timestamptz not null default now()
);

create table suppliers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  contact_person text,
  phone_number text,
  email text,
  address text,
  credit_limit numeric(14,2) default 0,
  current_payable numeric(14,2) default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- PRODUCT MANAGEMENT
-- ---------------------------------------------------------------------
create table products (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  company_id uuid references companies(id) on delete set null,
  brand_id uuid references brands(id) on delete set null,
  category_id uuid references categories(id) on delete set null,
  active_ingredient text,
  composition text,
  dose text,
  usage_instructions text,
  safety_information text,
  pack_size text,
  purchase_price numeric(14,2) not null default 0,
  selling_price numeric(14,2) not null default 0,
  min_stock_threshold numeric(14,3) default 0,
  image_url text,
  brochure_pdf_url text,
  is_available boolean not null default true,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_products_category on products(category_id);
create index idx_products_company on products(company_id);

-- ---------------------------------------------------------------------
-- INVENTORY (stock, batches, movements)
-- ---------------------------------------------------------------------
create table stock_batches (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references products(id) on delete restrict,
  batch_number text not null,
  manufacture_date date,
  expiry_date date,
  initial_quantity numeric(14,3) not null,
  created_at timestamptz not null default now(),
  unique(product_id, batch_number)
);
create index idx_batches_expiry on stock_batches(expiry_date);

create table inventory (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references products(id) on delete restrict,
  batch_id uuid references stock_batches(id) on delete restrict,
  quantity_on_hand numeric(14,3) not null default 0,
  updated_at timestamptz not null default now(),
  unique(product_id, batch_id)
);

create type stock_movement_type as enum (
  'purchase_in', 'sale_out', 'transfer_in', 'transfer_out',
  'adjustment_increase', 'adjustment_decrease', 'return_in', 'damaged_out', 'expired_out'
);

-- Append-only audit trail: every quantity change is written here alongside
-- the inventory update, so stock is always reconcilable.
create table stock_movements (
  id uuid primary key default uuid_generate_v4(),
  inventory_id uuid not null references inventory(id) on delete restrict,
  movement_type stock_movement_type not null,
  quantity numeric(14,3) not null,
  balance_after numeric(14,3) not null,
  reference_type text,
  reference_id uuid,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- FARMER MANAGEMENT
-- ---------------------------------------------------------------------
create table farmers (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete set null,
  farmer_code text not null unique,
  full_name text not null,
  cnic text not null unique,
  phone_number text not null,
  email text,
  address text,
  village text,
  tehsil text,
  district text,
  province text,
  is_verified boolean not null default false,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table farms (
  id uuid primary key default uuid_generate_v4(),
  farmer_id uuid not null references farmers(id) on delete cascade,
  name text not null,
  area_acres numeric(10,2) not null,
  village text, tehsil text, district text, province text,
  latitude double precision,
  longitude double precision,
  soil_type text,
  has_irrigation boolean default false,
  created_at timestamptz not null default now()
);

create table crop_history (
  id uuid primary key default uuid_generate_v4(),
  farm_id uuid not null references farms(id) on delete cascade,
  crop_name text not null,
  variety text,
  season text,
  crop_year int,
  sowing_date date,
  expected_harvest_date date,
  area_sown_acres numeric(10,2),
  notes text,
  created_at timestamptz not null default now()
);

create table soil_test_records (
  id uuid primary key default uuid_generate_v4(),
  farm_id uuid not null references farms(id) on delete cascade,
  test_date date not null,
  lab_name text,
  ph numeric(4,2),
  nitrogen_ppm numeric(8,2),
  phosphorus_ppm numeric(8,2),
  potassium_ppm numeric(8,2),
  fertility_level text,
  recommendation_notes text,
  report_file_url text,
  created_at timestamptz not null default now()
);

create table water_test_records (
  id uuid primary key default uuid_generate_v4(),
  farm_id uuid not null references farms(id) on delete cascade,
  test_date date not null,
  source text,
  ph numeric(4,2),
  electrical_conductivity numeric(10,2),
  quality_level text,
  recommendation_notes text,
  report_file_url text,
  created_at timestamptz not null default now()
);

create table harvest_records (
  id uuid primary key default uuid_generate_v4(),
  farm_id uuid not null references farms(id) on delete cascade,
  crop_name text not null,
  harvest_date date not null,
  quantity_harvested numeric(14,3) not null,
  unit text,
  yield_per_acre numeric(14,3),
  quality_grade text,
  created_at timestamptz not null default now()
);

create table farm_visits (
  id uuid primary key default uuid_generate_v4(),
  farm_id uuid not null references farms(id) on delete cascade,
  visited_by uuid references auth.users(id),
  visit_date date not null default current_date,
  purpose text,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- AI CROP DOCTOR
-- ---------------------------------------------------------------------
create type ai_report_status as enum ('queued', 'processing', 'completed', 'failed');

create table ai_crop_reports (
  id uuid primary key default uuid_generate_v4(),
  farm_id uuid references farms(id) on delete set null,
  farmer_id uuid references farmers(id) on delete set null,
  image_url text not null,
  status ai_report_status not null default 'queued',
  detected_crop_name text,
  detected_disease_name text,
  severity text,
  confidence_score numeric(5,4),
  treatment_recommendation text,
  recommended_product_ids uuid[],
  spray_schedule jsonb,
  spray_calculator jsonb,
  pdf_report_url text,
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);

-- ---------------------------------------------------------------------
-- CUSTOMER MANAGEMENT + KHATA (LEDGER)
-- ---------------------------------------------------------------------
create table customers (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  contact_person text,
  phone_number text not null,
  email text,
  address text,
  credit_limit numeric(14,2) default 0,
  payment_due_days int default 0,
  current_balance numeric(14,2) not null default 0, -- positive = customer owes us
  is_active boolean not null default true,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now()
);

create type ledger_entry_type as enum ('opening_balance', 'sale', 'payment_received', 'adjustment', 'return');

-- Append-only Khata ledger: every row is one line of the running account.
-- current_balance on `customers` is a cached running total kept in sync by
-- triggers below, but this table is the source of truth / full history.
create table customer_ledger (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid not null references customers(id) on delete restrict,
  entry_type ledger_entry_type not null,
  reference_type text,
  reference_id uuid,
  debit numeric(14,2) not null default 0,   -- increases what customer owes (sales)
  credit numeric(14,2) not null default 0,  -- decreases what customer owes (payments)
  balance_after numeric(14,2) not null,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index idx_ledger_customer on customer_ledger(customer_id, created_at);

-- ---------------------------------------------------------------------
-- PURCHASE MANAGEMENT
-- ---------------------------------------------------------------------
create type purchase_status as enum ('draft', 'pending', 'received', 'cancelled');

create table purchases (
  id uuid primary key default uuid_generate_v4(),
  purchase_number text not null unique,
  supplier_id uuid not null references suppliers(id) on delete restrict,
  purchase_date date not null default current_date,
  status purchase_status not null default 'draft',
  total_amount numeric(14,2) not null default 0,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table purchase_items (
  id uuid primary key default uuid_generate_v4(),
  purchase_id uuid not null references purchases(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  batch_id uuid references stock_batches(id),
  quantity numeric(14,3) not null,
  unit_cost numeric(14,2) not null,
  line_total numeric(14,2) not null
);

create table purchase_returns (
  id uuid primary key default uuid_generate_v4(),
  purchase_id uuid not null references purchases(id) on delete restrict,
  product_id uuid not null references products(id) on delete restrict,
  quantity numeric(14,3) not null,
  reason text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- SALES MANAGEMENT (Cash / Credit / Khata)
-- ---------------------------------------------------------------------
create type sale_type as enum ('cash', 'credit', 'khata');
create type sale_status as enum ('draft', 'confirmed', 'cancelled');

create table sales (
  id uuid primary key default uuid_generate_v4(),
  invoice_number text not null unique,
  customer_id uuid references customers(id) on delete restrict,
  sale_type sale_type not null,
  status sale_status not null default 'confirmed',
  sale_date date not null default current_date,
  subtotal numeric(14,2) not null default 0,
  total_purchase_value numeric(14,2) not null default 0, -- cost basis, for profit calc
  total_sales_value numeric(14,2) not null default 0,
  profit numeric(14,2) not null default 0,
  profit_percentage numeric(6,2) not null default 0,
  amount_paid numeric(14,2) not null default 0,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table sale_items (
  id uuid primary key default uuid_generate_v4(),
  sale_id uuid not null references sales(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  batch_id uuid references stock_batches(id),
  quantity numeric(14,3) not null,
  unit_purchase_price numeric(14,2) not null,
  unit_selling_price numeric(14,2) not null,
  line_purchase_value numeric(14,2) not null,
  line_sales_value numeric(14,2) not null,
  line_profit numeric(14,2) not null
);

create table payments (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid not null references customers(id) on delete restrict,
  sale_id uuid references sales(id) on delete set null,
  amount numeric(14,2) not null,
  payment_method text, -- cash, bank_transfer, cheque, easypaisa, jazzcash...
  payment_date date not null default current_date,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- NOTIFICATIONS & ACTIVITY LOGS
-- ---------------------------------------------------------------------
create table notifications (
  id uuid primary key default uuid_generate_v4(),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  message text not null,
  link_url text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table activity_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id),
  action text not null,        -- 'create', 'update', 'delete', 'login', ...
  entity_name text not null,   -- 'Product', 'Sale', ...
  entity_id uuid,
  old_values jsonb,
  new_values jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- TRIGGERS: keep computed/cached fields correct automatically
-- =====================================================================

-- Keep customers.current_balance in sync with the ledger, and stamp
-- balance_after on every ledger row — mirrors the append-only-ledger
-- pattern used for inventory movements above.
create or replace function fn_apply_ledger_entry() returns trigger as $$
begin
  update customers
    set current_balance = current_balance + new.debit - new.credit
    where id = new.customer_id
    returning current_balance into new.balance_after;
  return new;
end;
$$ language plpgsql;

create trigger trg_customer_ledger_apply
  before insert on customer_ledger
  for each row execute function fn_apply_ledger_entry();

-- Keep inventory.quantity_on_hand in sync with stock_movements
create or replace function fn_apply_stock_movement() returns trigger as $$
declare
  v_delta numeric(14,3);
begin
  v_delta := case
    when new.movement_type in ('purchase_in','transfer_in','adjustment_increase','return_in') then new.quantity
    else -new.quantity
  end;

  update inventory set quantity_on_hand = quantity_on_hand + v_delta, updated_at = now()
    where id = new.inventory_id
    returning quantity_on_hand into new.balance_after;

  return new;
end;
$$ language plpgsql;

create trigger trg_stock_movement_apply
  before insert on stock_movements
  for each row execute function fn_apply_stock_movement();

-- =====================================================================
-- ROW LEVEL SECURITY — every table locked down; authenticated staff
-- (any row in `profiles`) can read/write. Tighten per-role later as
-- needed (e.g. sales_staff read-only on purchases).
-- =====================================================================
alter table profiles enable row level security;
alter table companies enable row level security;
alter table brands enable row level security;
alter table categories enable row level security;
alter table suppliers enable row level security;
alter table products enable row level security;
alter table stock_batches enable row level security;
alter table inventory enable row level security;
alter table stock_movements enable row level security;
alter table farmers enable row level security;
alter table farms enable row level security;
alter table crop_history enable row level security;
alter table soil_test_records enable row level security;
alter table water_test_records enable row level security;
alter table harvest_records enable row level security;
alter table farm_visits enable row level security;
alter table ai_crop_reports enable row level security;
alter table customers enable row level security;
alter table customer_ledger enable row level security;
alter table purchases enable row level security;
alter table purchase_items enable row level security;
alter table purchase_returns enable row level security;
alter table sales enable row level security;
alter table sale_items enable row level security;
alter table payments enable row level security;
alter table notifications enable row level security;
alter table activity_logs enable row level security;

-- IMPORTANT: scoped to STAFF roles only (super_admin/admin/manager/sales_staff).
-- Farmer and customer portal users get their own narrow policies below —
-- without the role check here, any authenticated farmer/customer would
-- otherwise see every other farmer/customer's data too.
do $$
declare t text;
begin
  for t in select unnest(array[
    'companies','brands','categories','suppliers','products','stock_batches',
    'inventory','stock_movements','farmers','farms','crop_history',
    'soil_test_records','water_test_records','harvest_records','farm_visits',
    'ai_crop_reports','customers','customer_ledger','purchases','purchase_items',
    'purchase_returns','sales','sale_items','payments','activity_logs'
  ])
  loop
    execute format('create policy staff_all_access on %I for all using (
      exists (select 1 from profiles where id = auth.uid() and is_active = true
        and role in (''super_admin'',''admin'',''manager'',''sales_staff''))
    ) with check (
      exists (select 1 from profiles where id = auth.uid() and is_active = true
        and role in (''super_admin'',''admin'',''manager'',''sales_staff''))
    );', t);
  end loop;
end $$;

-- Farmer portal: a farmer can see/update their own farmer profile and
-- everything under their own farms, but nothing belonging to other farmers.
create policy farmer_own_profile on farmers for select using (user_id = auth.uid());
create policy farmer_update_own_profile on farmers for update using (user_id = auth.uid());

create policy farmer_own_farms on farms for all using (
  exists (select 1 from farmers f where f.id = farms.farmer_id and f.user_id = auth.uid())
) with check (
  exists (select 1 from farmers f where f.id = farms.farmer_id and f.user_id = auth.uid())
);

do $$
declare t text;
begin
  for t in select unnest(array['crop_history','soil_test_records','water_test_records','harvest_records','farm_visits'])
  loop
    execute format('create policy farmer_own_farm_records on %I for all using (
      exists (select 1 from farms fa join farmers f on f.id = fa.farmer_id
              where fa.id = %I.farm_id and f.user_id = auth.uid())
    ) with check (
      exists (select 1 from farms fa join farmers f on f.id = fa.farmer_id
              where fa.id = %I.farm_id and f.user_id = auth.uid())
    );', t, t, t);
  end loop;
end $$;

create policy farmer_own_ai_reports on ai_crop_reports for all using (
  exists (select 1 from farmers f where f.id = ai_crop_reports.farmer_id and f.user_id = auth.uid())
) with check (
  exists (select 1 from farmers f where f.id = ai_crop_reports.farmer_id and f.user_id = auth.uid())
);

-- Customer portal: a customer can see their own profile, ledger (Khata), and
-- their own sales/invoices — nothing belonging to other customers.
create policy customer_own_profile on customers for select using (user_id = auth.uid());
create policy customer_own_ledger on customer_ledger for select using (
  exists (select 1 from customers c where c.id = customer_ledger.customer_id and c.user_id = auth.uid())
);
create policy customer_own_sales on sales for select using (
  exists (select 1 from customers c where c.id = sales.customer_id and c.user_id = auth.uid())
);
create policy customer_own_sale_items on sale_items for select using (
  exists (select 1 from sales s join customers c on c.id = s.customer_id
          where s.id = sale_items.sale_id and c.user_id = auth.uid())
);

-- Public website (anonymous, no login) can browse available products and
-- the categories/brands used to label them — this is the "Products" page.
create policy public_read_available_products on products for select
  using (is_available = true and is_deleted = false);
create policy public_read_categories on categories for select using (true);
create policy public_read_brands on brands for select using (true);

create policy own_profile on profiles for select using (auth.uid() = id or exists (
  select 1 from profiles p where p.id = auth.uid() and p.role in ('super_admin','admin')
));
create policy own_notifications on notifications for select using (auth.uid() = recipient_user_id);
create policy own_notifications_update on notifications for update using (auth.uid() = recipient_user_id);

-- =====================================================================
-- STORAGE: bucket for AI Crop Doctor + product images.
-- Run this after the SQL above, or create "ai-crop-doctor" and "products"
-- buckets manually in Supabase Studio → Storage (mark them Public so
-- image URLs work directly in <Image> tags without signed URLs).
-- =====================================================================
insert into storage.buckets (id, name, public) values ('ai-crop-doctor', 'ai-crop-doctor', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('products', 'products', true) on conflict (id) do nothing;

create policy "authenticated uploads" on storage.objects for insert
  with check (bucket_id in ('ai-crop-doctor','products') and auth.role() = 'authenticated');
create policy "public read" on storage.objects for select
  using (bucket_id in ('ai-crop-doctor','products'));
