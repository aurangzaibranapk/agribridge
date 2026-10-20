// 671–675 ko PGlite par chalata hai. Live / testing database ko haath nahi lagata.
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const run = (sql) => db.exec(sql);
const q = async (sql) => (await db.query(sql)).rows;
const read = (f) => fs.readFileSync(f, "utf8");

const OWNER = "00000000-0000-0000-0000-0000000000a1";
const ADMIN = "00000000-0000-0000-0000-0000000000a2";
const STAFF = "00000000-0000-0000-0000-0000000000a3";
const B1 = "00000000-0000-0000-0000-0000000000b1";
const B2 = "00000000-0000-0000-0000-0000000000b2";
const SHOP1 = "00000000-0000-0000-0000-0000000000c1";
const SHOP2 = "00000000-0000-0000-0000-0000000000c2";
const WH_A = "00000000-0000-0000-0000-0000000000d1";
const WH_B = "00000000-0000-0000-0000-0000000000d2";
const WH_T = "00000000-0000-0000-0000-0000000000d3";
const WH_T2 = "00000000-0000-0000-0000-0000000000d4";
const PROD = "00000000-0000-0000-0000-0000000000e1";
const PROD_EXP = "00000000-0000-0000-0000-0000000000e2";
const PROD_ADJ = "00000000-0000-0000-0000-0000000000e3";
const PROD_UNDO = "00000000-0000-0000-0000-0000000000e4";
const OLD_SALE = "00000000-0000-0000-0000-000000000211";
const LOSS = "00000000-0000-0000-0000-000000000411";
const T_OK = "00000000-0000-0000-0000-000000000511";
const T_REJ = "00000000-0000-0000-0000-000000000512";
const T_CAN = "00000000-0000-0000-0000-000000000513";

await run(`
  create schema if not exists auth;
  create or replace function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('test.uid', true), '')::uuid $$;
  create role anon;
  create role authenticated;
  create role service_role bypassrls;

  create table public.profiles (
    id uuid primary key, full_name text, role text, is_active boolean default true,
    branch_id uuid, shop_id uuid, status text default 'active'
  );
  insert into public.profiles (id, full_name, role, branch_id, shop_id) values
    ('${OWNER}','Owner','owner', null, null),
    ('${ADMIN}','Admin','admin', null, null),
    ('${STAFF}','Staff','sales_staff', '${B2}', '${SHOP2}');

  create or replace function public.fn_is_any_staff() returns boolean language sql stable security definer set search_path = public as $$
    select exists (select 1 from public.profiles where id = auth.uid() and is_active and role in
      ('owner','super_admin','admin','manager','sales_staff','finance','warehouse','hr','procurement'));
  $$;

  create table public.warehouses (
    id uuid primary key, name text, branch_id uuid, shop_id uuid
  );
  insert into public.warehouses (id, name, branch_id, shop_id) values
    ('${WH_A}','A','${B1}','${SHOP1}'),
    ('${WH_B}','B','${B1}','${SHOP1}'),
    ('${WH_T}','T','${B1}','${SHOP1}'),
    ('${WH_T2}','T2','${B1}','${SHOP1}');

  create table public.stock_batches (
    id uuid primary key default gen_random_uuid(),
    batch_number text default 'B',
    product_id uuid, warehouse_id uuid,
    initial_quantity numeric, remaining_quantity numeric, unit_cost numeric,
    expiry_date date, created_at timestamptz default now()
  );
  insert into public.stock_batches (id, product_id, warehouse_id, batch_number, initial_quantity, remaining_quantity, unit_cost, expiry_date, created_at) values
    ('00000000-0000-0000-0000-000000000111','${PROD}','${WH_A}','BAD', 10, 15, 5, null, '2026-01-01'),
    ('00000000-0000-0000-0000-000000000112','${PROD}','${WH_A}','OK', 8, 8, 9, null, '2026-02-01'),
    ('00000000-0000-0000-0000-000000000113','${PROD}','${WH_A}','EXP', 5, 5, 4, '2000-01-01', '2026-03-01'),
    ('00000000-0000-0000-0000-000000000114','${PROD_EXP}','${WH_A}','ONLYEXP', 6, 6, 3, '2000-01-01', '2026-01-02'),
    ('00000000-0000-0000-0000-000000000115','${PROD_UNDO}','${WH_A}','UNDO', 10, 10, 2, null, '2026-01-03');

  create table public.inventory (
    id uuid primary key default gen_random_uuid(),
    warehouse_id uuid, product_id uuid, quantity_on_hand numeric default 0
  );
  insert into public.inventory (id, warehouse_id, product_id, quantity_on_hand) values
    ('00000000-0000-0000-0000-0000000000f1','${WH_A}','${PROD}', 80),
    ('00000000-0000-0000-0000-0000000000f2','${WH_B}','${PROD}', 100),
    ('00000000-0000-0000-0000-0000000000f3','${WH_A}','${PROD_ADJ}', 3),
    ('00000000-0000-0000-0000-0000000000f4','${WH_T}','${PROD}', 5);

  create table public.stock_movements (
    id uuid primary key default gen_random_uuid(),
    inventory_id uuid, movement_type text, quantity numeric,
    reference_type text, reference_id uuid, notes text, created_by uuid, client_action_id text
  );
  create or replace function public.fn_test_apply_movement() returns trigger language plpgsql as $$
  begin
    if tg_op = 'INSERT' and new.movement_type in ('sale_out','adjustment_decrease','transfer_out','damaged_out','expired_out','loss_write_off') then
      update public.inventory set quantity_on_hand = quantity_on_hand - new.quantity where id = new.inventory_id;
    elsif tg_op = 'INSERT' and new.movement_type in ('purchase_in','adjustment_increase','transfer_in','return_in') then
      update public.inventory set quantity_on_hand = quantity_on_hand + new.quantity where id = new.inventory_id;
    elsif tg_op = 'DELETE' and old.movement_type in ('sale_out','adjustment_decrease','transfer_out','damaged_out','expired_out','loss_write_off') then
      update public.inventory set quantity_on_hand = quantity_on_hand + old.quantity where id = old.inventory_id;
    end if;
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end $$;
  create trigger trg_test_apply_movement
    after insert or delete on public.stock_movements
    for each row execute function public.fn_test_apply_movement();

  create table public.grain_procurement_entries (
    id uuid primary key default gen_random_uuid(), grain_type text, weight_kg numeric
  );
  create table public.grain_sales (
    id uuid primary key default gen_random_uuid(),
    sale_number text, buyer_id uuid, customer_id uuid, grain_type text, warehouse_id uuid,
    quantity_kg numeric, rate_per_kg numeric, total_amount numeric, total_cogs numeric,
    delivery_term text, bardana_cost numeric, mazdoori_cost numeric, profit numeric,
    sale_date date, notes text, created_by uuid, draft_id uuid
  );
  insert into public.grain_sales (id, grain_type, warehouse_id, quantity_kg, rate_per_kg, total_amount) values
    ('${OLD_SALE}','wheat','${WH_A}', 40, 100, 4000);

  create table public.grain_type_products (grain_type text primary key, product_id uuid);
  insert into public.grain_type_products values ('wheat','${PROD}');

  create table public.grain_sale_counters (year int primary key, last_number int not null);
  create table public.stock_loss_counters (year int primary key, last_number int not null);
  create table public.agri_dispatch_counters (year int primary key, last_number int not null);
  create table public.agri_dispatches (id uuid primary key default gen_random_uuid(), order_id uuid, dispatch_number text);

  create table public.stock_counts (id uuid primary key, status text);
  insert into public.stock_counts values ('00000000-0000-0000-0000-000000000611','verified');

  create table public.stock_transfers (
    id uuid primary key, status text, transfer_number text,
    from_warehouse_id uuid, to_warehouse_id uuid, product_id uuid,
    quantity numeric, confirmed_quantity numeric, unit_price numeric,
    discrepancy_resolved_at timestamptz, requested_by uuid,
    shop_accepted_by uuid, shop_accepted_at timestamptz
  );
  insert into public.stock_transfers (id, status, transfer_number, from_warehouse_id, to_warehouse_id, product_id, unit_price, requested_by) values
    ('${T_OK}','in_transit','TR-OK','${WH_T}','${WH_T2}','${PROD}', 10, '${ADMIN}'),
    ('${T_REJ}','in_transit','TR-REJ','${WH_T}','${WH_T2}','${PROD}', 10, '${ADMIN}'),
    ('${T_CAN}','in_transit','TR-CAN','${WH_T}','${WH_T2}','${PROD}', 10, '${STAFF}');

  create table public.finance_transactions (
    id uuid primary key default gen_random_uuid(),
    account_id uuid, transaction_type text, category text, amount numeric,
    transaction_date date, notes text, created_by uuid, source_table text, source_row_id uuid
  );
  insert into public.finance_transactions (account_id, transaction_type, amount, notes, source_row_id) values
    ('00000000-0000-0000-0000-000000000711','transfer_in', 50, 'Payment for transfer TR-CAN', '${T_CAN}');

  create table public.stock_loss_records (
    id uuid primary key, status text, reported_by uuid, warehouse_id uuid,
    approved_by uuid, approved_at timestamptz, rejection_reason text, loss_value numeric
  );
  create table public.loss_verifiers (id uuid primary key default gen_random_uuid(), profile_id uuid, shop_id uuid);
  create table public.stock_loss_ledger_claims (loss_id uuid, claimed_by uuid, decision text);
  insert into public.stock_loss_records (id, status, reported_by, warehouse_id) values
    ('${LOSS}','pending','${OWNER}','${WH_A}');
  insert into public.loss_verifiers (profile_id, shop_id) values ('${STAFF}','${SHOP2}');

  create or replace function public.fn_release_stock_loss_claim(p_loss uuid) returns void language plpgsql as $$ begin end $$;
`);

await run(read("supabase/migrations/665_grain_rate_unit.sql"));
await run(read("supabase/migrations/671_fifo_shortfall_scope.sql"));
await run(read("supabase/migrations/672_stock_locks_and_counters.sql"));
await run(read("supabase/migrations/673_transfer_accept_atomic.sql"));
await run(read("supabase/migrations/674_stock_loss_scope_and_undo.sql"));
await run(read("supabase/migrations/675_grain_sale_on_hand.sql"));
await run(`grant usage on schema public to authenticated, service_role; grant all on all tables in schema public to authenticated, service_role;`);

async function asRole(role, uid, jwt, sql) {
  await run(`select set_config('test.uid', '${uid ?? ""}', false); select set_config('request.jwt.claim.role', '${jwt ?? ""}', false); set role ${role};`);
  try {
    return await q(sql);
  } finally {
    await run(`reset role; select set_config('request.jwt.claim.role', '', false); select set_config('test.uid', '', false);`);
  }
}

await assert.rejects(
  () => asRole("authenticated", ADMIN, "", `select * from public.fn_consume_sellable_fifo('${WH_A}','${PROD}', 1, false, '${ADMIN}', null, null)`),
  /permission denied/i
);

const took = await asRole("service_role", ADMIN, "service_role", `select batch_id::text, taken from public.fn_consume_sellable_fifo('${WH_A}','${PROD}', 20, false, '${ADMIN}', 't', null)`);
assert.equal(took.length, 1);
assert.equal(took[0].batch_id, "00000000-0000-0000-0000-000000000112");
assert.equal(Number(took[0].taken), 8);
const left = await q(`select id::text, remaining_quantity from stock_batches where product_id = '${PROD}' and warehouse_id = '${WH_A}' order by batch_number`);
const byId = Object.fromEntries(left.map((r) => [r.id, Number(r.remaining_quantity)]));
assert.equal(byId["00000000-0000-0000-0000-000000000111"], 15, "remaining>initial batch nahi chheri");
assert.equal(byId["00000000-0000-0000-0000-000000000112"], 0);
assert.equal(byId["00000000-0000-0000-0000-000000000113"], 5, "expire batch nahi chheri");
const short = await q(`select short_qty from stock_batch_shortfalls where product_id = '${PROD}'`);
assert.equal(Number(short[0].short_qty), 12);

await assert.rejects(
  () => asRole("service_role", STAFF, "service_role", `select * from public.fn_consume_sellable_fifo('${WH_A}','${PROD}', 1, false, '${STAFF}', null, null)`),
  /scope se bahar/
);

const ignored = await asRole("service_role", ADMIN, "", `select taken from public.fn_consume_sellable_fifo('${WH_A}','${PROD_EXP}', 2, true, '${ADMIN}', 'exp', null)`);
assert.equal(ignored.length, 0, "bina service jwt expire nahi nikli");
assert.equal(Number((await q(`select remaining_quantity from stock_batches where id = '00000000-0000-0000-0000-000000000114'`))[0].remaining_quantity), 6);
const expiredTake = await asRole("service_role", ADMIN, "service_role", `select taken from public.fn_consume_sellable_fifo('${WH_A}','${PROD_EXP}', 2, true, '${ADMIN}', 'exp2', null)`);
assert.equal(Number(expiredTake[0].taken), 2);

await assert.rejects(
  () => asRole("service_role", ADMIN, "service_role", `select public.fn_adjust_stock('00000000-0000-0000-0000-0000000000f3','decrease', 5, '${ADMIN}', null, null, null)`),
  /Itna stock nahi/
);

const n1 = await q(`select public.fn_next_year_counter('stock_loss', 26) as n`);
const n2 = await q(`select public.fn_next_year_counter('stock_loss', 26) as n`);
assert.equal(Number(n1[0].n), 1);
assert.equal(Number(n2[0].n), 2);

await assert.rejects(
  () => asRole("authenticated", ADMIN, "", `select public.fn_reject_stock_transfer('${T_REJ}','${ADMIN}')`),
  /pending transfer/
);
const completed = await asRole("authenticated", ADMIN, "", `select public.fn_complete_internal_transfer('${T_OK}', 5, '${ADMIN}') as v`);
assert.equal(completed[0].v, "ok");
assert.equal((await q(`select status from stock_transfers where id = '${T_OK}'`))[0].status, "completed");
assert.equal(Number((await q(`select count(*)::int as n from stock_batches where batch_number like 'TRF-%' and warehouse_id = '${WH_T2}'`))[0].n), 1);
assert.ok(Number((await q(`select count(*)::int as n from stock_batch_shortfalls where reference_id = '${T_OK}'`))[0].n) >= 1);

const cancelled = await asRole("authenticated", ADMIN, "", `select public.fn_cancel_internal_transfer('${T_CAN}','${ADMIN}') as v`);
assert.equal(cancelled[0].v, "ok");
assert.equal((await q(`select count(*)::int as n from finance_transactions where source_row_id = '${T_CAN}' and transaction_type = 'transfer_out'`))[0].n, 1);

const guardDef = await q(`select pg_get_functiondef('public.fn_guard_grain_sale_qty()'::regprocedure) as d`);
assert.match(guardDef[0].d, /for update/i);
const postDef = await q(`select pg_get_functiondef('public.fn_post_grain_sale(uuid,uuid,text,uuid,uuid,numeric,numeric,numeric,text,numeric,numeric,date,text,uuid,uuid)'::regprocedure) as d`);
assert.match(postDef[0].d, /for update/i);

const oldUnit = await q(`select rate_unit from grain_sales where id = '${OLD_SALE}'`);
assert.equal(oldUnit[0].rate_unit, "per_kg");

function postSale(wh, qty, rate, actor) {
  return `select public.fn_post_grain_sale(
    '${actor}','${actor}','wheat','${wh}','${PROD}', ${qty}, ${rate}, 1000,
    null, 0, 0, '2026-10-20', null, '${actor}', null) as v`;
}

const own = await asRole("authenticated", OWNER, "", postSale(WH_A, 40, 4000, OWNER));
assert.ok(own[0].v.id);
assert.equal((await q(`select rate_unit from grain_sales where id = '${own[0].v.id}'`))[0].rate_unit, "per_maund");
assert.equal(Number((await q(`select quantity_on_hand from inventory where warehouse_id = '${WH_A}' and product_id = '${PROD}'`))[0].quantity_on_hand), 40);
await assert.rejects(() => asRole("authenticated", OWNER, "", postSale(WH_A, 50, 4000, OWNER)), /itna anaj nahi/i);

const otherWh = await asRole("authenticated", OWNER, "", postSale(WH_B, 40, 4000, OWNER));
assert.ok(otherWh[0].v.id);
assert.equal(Number((await q(`select quantity_on_hand from inventory where warehouse_id = '${WH_B}' and product_id = '${PROD}'`))[0].quantity_on_hand), 60);

await run(`update inventory set quantity_on_hand = 0 where warehouse_id = '${WH_A}' and product_id = '${PROD}'`);
await asRole("authenticated", OWNER, "", `update grain_sales set quantity_kg = 20 where id = '${own[0].v.id}'`);
assert.equal(Number((await q(`select quantity_kg from grain_sales where id = '${own[0].v.id}'`))[0].quantity_kg), 20);
await assert.rejects(
  () => asRole("authenticated", STAFF, "", `update grain_sales set quantity_kg = 80 where id = '${own[0].v.id}'`),
  /itna anaj nahi/i
);

await assert.rejects(() => asRole("authenticated", OWNER, "", postSale(WH_B, 10, 500, OWNER)), /1,000 se 20,000/);

await assert.rejects(
  () => asRole("authenticated", STAFF, "", `select public.fn_decide_stock_loss('${LOSS}','approve', null)`),
  /is shop/
);
await assert.rejects(
  () => asRole("authenticated", ADMIN, "", `select public.fn_release_stock_loss_claim('${LOSS}')`),
  /permission denied/i
);

const undone = await asRole("service_role", ADMIN, "service_role", `select taken from public.fn_consume_sellable_fifo('${WH_A}','${PROD_UNDO}', 4, false, '${ADMIN}', 'undo', '00000000-0000-0000-0000-000000000811')`);
assert.equal(Number(undone[0].taken), 4);
await asRole("service_role", ADMIN, "service_role", `select public.fn_undo_reference_stock('undo','00000000-0000-0000-0000-000000000811')`);
assert.equal(Number((await q(`select remaining_quantity from stock_batches where id = '00000000-0000-0000-0000-000000000115'`))[0].remaining_quantity), 10);

console.log("dept-review 671 sql: theek");
