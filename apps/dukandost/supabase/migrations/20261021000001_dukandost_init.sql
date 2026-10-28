-- DukanDost MVP schema. Lives in its own schema `dukandost` and is meant for a
-- SEPARATE Supabase project. It never references AgriBridge tables.
create extension if not exists pgcrypto;
create schema if not exists dukandost;
grant usage on schema dukandost to authenticated, service_role;

-- Shops (tenants)
create table dukandost.shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  name text not null check (length(name) between 1 and 120),
  owner_name text,
  phone text,
  address text,
  business_type text,
  lang text not null default 'ur' check (lang in ('ur','en','roman')),
  plan text not null default 'trial' check (plan in ('free','trial','pro','business')),
  trial_ends_at timestamptz not null default now() + interval '14 days',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table dukandost.shop_members (
  shop_id uuid not null references dukandost.shops(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'owner' check (role in ('owner','manager','salesman','stock')),
  created_at timestamptz not null default now(),
  primary key (shop_id, user_id)
);

create or replace function dukandost.is_member(p_shop uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from dukandost.shop_members m
                 where m.shop_id = p_shop and m.user_id = auth.uid());
$$;
revoke all on function dukandost.is_member(uuid) from public;
grant execute on function dukandost.is_member(uuid) to authenticated;

create or replace function dukandost.add_owner_member()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into dukandost.shop_members(shop_id, user_id, role) values (new.id, new.owner_id, 'owner');
  return new;
end $$;
create trigger shops_owner_member after insert on dukandost.shops
  for each row execute function dukandost.add_owner_member();

-- Generic tenant tables. Ids are client-generated (offline-first).
create table dukandost.items (
  id uuid primary key, shop_id uuid not null references dukandost.shops(id) on delete cascade,
  name text not null, barcode text, category text, unit text not null default 'pcs',
  buy_price numeric(14,2) not null default 0, sell_price numeric(14,2) not null default 0,
  stock numeric(14,3) not null default 0, low_stock_at numeric(14,3) not null default 0,
  deleted boolean not null default false, updated_at timestamptz not null default now()
);
create table dukandost.parties (
  id uuid primary key, shop_id uuid not null references dukandost.shops(id) on delete cascade,
  kind text not null check (kind in ('customer','supplier')), name text not null, phone text,
  credit_limit numeric(14,2), promise_date date,
  deleted boolean not null default false, updated_at timestamptz not null default now()
);
create table dukandost.sales (
  id uuid primary key, shop_id uuid not null references dukandost.shops(id) on delete cascade,
  bill_no integer not null, party_id uuid references dukandost.parties(id),
  subtotal numeric(14,2) not null, discount numeric(14,2) not null default 0, total numeric(14,2) not null,
  paid numeric(14,2) not null default 0, method text not null check (method in ('cash','jazzcash','easypaisa','bank','udhaar')),
  created_at timestamptz not null default now(),
  deleted boolean not null default false, updated_at timestamptz not null default now()
);
create table dukandost.sale_lines (
  id uuid primary key, shop_id uuid not null references dukandost.shops(id) on delete cascade,
  sale_id uuid not null references dukandost.sales(id) on delete cascade, item_id uuid references dukandost.items(id),
  name text not null, qty numeric(14,3) not null, price numeric(14,2) not null, cost numeric(14,2) not null default 0,
  deleted boolean not null default false, updated_at timestamptz not null default now()
);
create table dukandost.purchases (
  id uuid primary key, shop_id uuid not null references dukandost.shops(id) on delete cascade,
  party_id uuid references dukandost.parties(id), ref_no text, total numeric(14,2) not null,
  paid numeric(14,2) not null default 0, method text not null default 'cash',
  created_at timestamptz not null default now(),
  deleted boolean not null default false, updated_at timestamptz not null default now()
);
create table dukandost.purchase_lines (
  id uuid primary key, shop_id uuid not null references dukandost.shops(id) on delete cascade,
  purchase_id uuid not null references dukandost.purchases(id) on delete cascade, item_id uuid references dukandost.items(id),
  name text not null, qty numeric(14,3) not null, price numeric(14,2) not null,
  deleted boolean not null default false, updated_at timestamptz not null default now()
);
create table dukandost.ledger (
  id uuid primary key, shop_id uuid not null references dukandost.shops(id) on delete cascade,
  party_id uuid not null references dukandost.parties(id), amount numeric(14,2) not null, -- + = party owes us more
  note text, method text, ref_type text, ref_id uuid, created_at timestamptz not null default now(),
  deleted boolean not null default false, updated_at timestamptz not null default now()
);
create table dukandost.expenses (
  id uuid primary key, shop_id uuid not null references dukandost.shops(id) on delete cascade,
  category text not null, amount numeric(14,2) not null, note text, method text not null default 'cash',
  created_at timestamptz not null default now(),
  deleted boolean not null default false, updated_at timestamptz not null default now()
);

create index on dukandost.items(shop_id, updated_at);
create index on dukandost.parties(shop_id, updated_at);
create index on dukandost.sales(shop_id, updated_at);
create index on dukandost.sale_lines(shop_id, updated_at);
create index on dukandost.purchases(shop_id, updated_at);
create index on dukandost.purchase_lines(shop_id, updated_at);
create index on dukandost.ledger(shop_id, updated_at);
create index on dukandost.expenses(shop_id, updated_at);

-- RLS
alter table dukandost.shops enable row level security;
alter table dukandost.shop_members enable row level security;
create policy shops_select on dukandost.shops for select to authenticated using (dukandost.is_member(id));
create policy shops_insert on dukandost.shops for insert to authenticated with check (owner_id = auth.uid());
create policy shops_update on dukandost.shops for update to authenticated
  using (dukandost.is_member(id)) with check (dukandost.is_member(id));
create policy members_select on dukandost.shop_members for select to authenticated using (dukandost.is_member(shop_id));

grant select, insert on dukandost.shops to authenticated;
-- plan / trial_ends_at / owner_id are NOT client-updatable (billing is server-side).
grant update (name, owner_name, phone, address, business_type, lang, updated_at) on dukandost.shops to authenticated;
grant select on dukandost.shop_members to authenticated;

do $$
declare t text;
begin
  foreach t in array array['items','parties','sales','sale_lines','purchases','purchase_lines','ledger','expenses'] loop
    execute format('alter table dukandost.%I enable row level security', t);
    execute format('alter table dukandost.%I force row level security', t);
    execute format('create policy %I on dukandost.%I for all to authenticated using (dukandost.is_member(shop_id)) with check (dukandost.is_member(shop_id))', t || '_tenant', t);
    execute format('grant select, insert, update on dukandost.%I to authenticated', t);
    execute format('grant all on dukandost.%I to service_role', t);
  end loop;
end $$;
grant all on dukandost.shops, dukandost.shop_members to service_role;
alter table dukandost.shops force row level security;
alter table dukandost.shop_members force row level security;

-- Plan status helper (14-day trial)
create or replace function dukandost.effective_plan(p_shop uuid)
returns text language sql stable security definer set search_path = '' as $$
  select case when s.plan = 'trial' and s.trial_ends_at < now() then 'free' else s.plan end
  from dukandost.shops s where s.id = p_shop and dukandost.is_member(p_shop);
$$;
grant execute on function dukandost.effective_plan(uuid) to authenticated;
