// 660–669 ko PGlite par chalata hai. Live / testing database ko haath nahi lagata.
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
const C1 = "00000000-0000-0000-0000-0000000000c1";
const C2 = "00000000-0000-0000-0000-0000000000c2";
const WH = "00000000-0000-0000-0000-0000000000d1";
const PROD = "00000000-0000-0000-0000-0000000000e1";

await run(`
  create schema if not exists auth;
  create or replace function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('test.uid', true), '')::uuid $$;
  create role anon;
  create role authenticated;
  create role service_role bypassrls;
  grant usage on schema public to authenticated;

  create table public.profiles (
    id uuid primary key, full_name text, role text, is_active boolean default true,
    branch_id uuid, status text default 'active'
  );
  insert into public.profiles (id, full_name, role, branch_id) values
    ('${OWNER}','Owner','owner', null),
    ('${ADMIN}','Admin','admin', null),
    ('${STAFF}','Staff','sales_staff', '${B1}');

  create or replace function public.fn_is_any_staff() returns boolean language sql stable security definer set search_path = public as $$
    select exists (select 1 from public.profiles where id = auth.uid() and is_active and role in
      ('owner','super_admin','admin','manager','sales_staff','finance','warehouse','hr','procurement'));
  $$;
  create or replace function public.fn_payroll_is_approver() returns boolean language sql stable security definer set search_path = public as $$
    select exists (select 1 from public.profiles where id = auth.uid() and is_active and role in ('owner','super_admin','admin'));
  $$;

  create table public.website_settings (key text primary key, value jsonb not null, updated_at timestamptz default now());
  insert into public.website_settings (key, value) values ('contact_phone', to_jsonb('+923226275476'::text)), ('contact_address', to_jsonb('Pakistan'::text));
  alter table public.website_settings enable row level security;
  create policy public_read_website_settings on public.website_settings for select using (true);
  create policy staff_all_access on public.website_settings for all using (public.fn_is_any_staff()) with check (public.fn_is_any_staff());

  create table public.blog_posts (id uuid primary key default gen_random_uuid(), title text);
  alter table public.blog_posts enable row level security;
  create policy staff_all_access on public.blog_posts for all using (public.fn_is_any_staff()) with check (public.fn_is_any_staff());

  create table public.payroll_runs (
    id uuid primary key, status text, created_by uuid, approve_journal_id uuid, pay_journal_id uuid
  );
  insert into public.payroll_runs (id, status, created_by, approve_journal_id) values
    ('00000000-0000-0000-0000-0000000000f1','approved','${STAFF}','00000000-0000-0000-0000-0000000000f2');
  create or replace function public.fn_guard_payroll_run() returns trigger language plpgsql as $$
  begin
    if tg_op = 'UPDATE' and current_setting('agribridge.payroll_fn', true) is distinct from 'on' then
      raise exception 'Payroll ki halat sirf payroll functions se badalti hai.';
    end if;
    return new;
  end $$;
  create trigger trg_guard_payroll_run before update on public.payroll_runs
    for each row execute function public.fn_guard_payroll_run();

  create table public.stock_batches (
    id uuid primary key default gen_random_uuid(),
    batch_number text default 'B',
    product_id uuid, warehouse_id uuid,
    initial_quantity numeric, remaining_quantity numeric, unit_cost numeric,
    expiry_date date, created_at timestamptz default now()
  );
  insert into public.stock_batches (id, product_id, warehouse_id, initial_quantity, remaining_quantity, unit_cost) values
    ('00000000-0000-0000-0000-000000000111','${PROD}','${WH}', 10, 15, 5);

  create table public.grain_procurement_entries (
    id uuid primary key default gen_random_uuid(), grain_type text, weight_kg numeric,
    stock_weight_kg numeric, reclassified_as_sale_id uuid
  );
  insert into public.grain_procurement_entries (grain_type, weight_kg) values ('wheat', 100);
  create table public.grain_sales (
    id uuid primary key default gen_random_uuid(), grain_type text, quantity_kg numeric, rate_per_kg numeric, total_amount numeric
  );
  insert into public.grain_sales (id, grain_type, quantity_kg, rate_per_kg, total_amount) values
    ('00000000-0000-0000-0000-000000000211','wheat', 40, 4000, 160000);

  create table public.stock_transfers (id uuid primary key, status text);
  insert into public.stock_transfers values ('00000000-0000-0000-0000-000000000311','completed'), ('00000000-0000-0000-0000-000000000312','in_transit');

  create table public.stock_loss_records (
    id uuid primary key, status text, reported_by uuid, approved_by uuid, approved_at timestamptz, rejection_reason text
  );
  create table public.loss_verifiers (id uuid primary key default gen_random_uuid(), profile_id uuid, shop_id uuid);
  insert into public.stock_loss_records (id, status, reported_by) values
    ('00000000-0000-0000-0000-000000000411','pending','${STAFF}'),
    ('00000000-0000-0000-0000-000000000412','pending','${ADMIN}');

  create table public.customers (id uuid primary key, branch_id uuid, organization_id uuid, name text);
  create table public.farmers (id uuid primary key, branch_id uuid, full_name text);
  insert into public.customers values ('${C1}','${B1}', null, 'Gahak 1'), ('${C2}','${B2}', null, 'Gahak 2');

  grant all on all tables in schema public to authenticated;
  grant execute on all functions in schema public to authenticated;
`);

await run(read("supabase/migrations/660_cms_editor_role.sql"));
await run(read("supabase/migrations/661_owner_suspend_guard.sql"));
await run(read("supabase/migrations/662_payroll_pay_once.sql"));
await run(read("supabase/migrations/663_stock_batch_atomic_deduct.sql"));
await run(read("supabase/migrations/664_grain_sale_stock_guard.sql"));
await run(read("supabase/migrations/665_grain_rate_unit.sql"));
await run(read("supabase/migrations/666_completed_transfer_lock.sql"));
await run(read("supabase/migrations/667_stock_loss_once.sql"));
await run(read("supabase/migrations/668_expired_batch_no_sale.sql"));
const m669 = read("supabase/migrations/669_statement_branch_scope.sql").split("-- LEDGER FUNCTIONS")[0];
await run(m669);

async function asUser(uid, sql) {
  await run(`select set_config('test.uid', '${uid}', false); set role authenticated;`);
  try {
    return await q(sql);
  } finally {
    await run("reset role;");
  }
}

assert.equal((await q(`select value #>> '{}' as v from website_settings where key = 'contact_phone'`))[0].v, "+923126513294");
const staffWrite = await asUser(STAFF, `update website_settings set value = to_jsonb('x'::text) where key = 'contact_address' returning key`);
assert.equal(staffWrite.length, 0, "sales staff website nahi badal sakta");
const phoneRows = await asUser(ADMIN, `update website_settings set value = to_jsonb('+923126513294'::text) where key = 'contact_phone' returning key`);
assert.equal(phoneRows.length, 1);

await assert.rejects(() => run(`update profiles set is_active = false where id = '${OWNER}'`), /Owner account/);
await assert.rejects(() => run(`update profiles set status = 'suspended', is_active = false where id = '${OWNER}'`), /Owner account/);
await run(`update profiles set status = 'suspended', is_active = false where id = '${STAFF}'`);

await assert.rejects(() => asUser(STAFF, `select public.fn_payroll_claim_pay('00000000-0000-0000-0000-0000000000f1')`), /ada nahi kar sakta|Ijazat nahi|Admin ya Owner/);
const claimed = await asUser(ADMIN, `select public.fn_payroll_claim_pay('00000000-0000-0000-0000-0000000000f1') as v`);
assert.equal(claimed[0].v, "claimed");
await run(`select set_config('agribridge.payroll_fn','on', false); update payroll_runs set status = 'paid', pay_journal_id = '00000000-0000-0000-0000-0000000000f9' where id = '00000000-0000-0000-0000-0000000000f1'; select set_config('agribridge.payroll_fn','off', false);`);
const again = await asUser(ADMIN, `select public.fn_payroll_claim_pay('00000000-0000-0000-0000-0000000000f1') as v`);
assert.equal(again[0].v, "already_paid");

await assert.rejects(() => run(`insert into stock_batches (product_id, warehouse_id, initial_quantity, remaining_quantity) values ('${PROD}','${WH}', 5, 9)`), /initial se zyada/);
await run(`insert into stock_batches (id, product_id, warehouse_id, initial_quantity, remaining_quantity, unit_cost, expiry_date) values
  ('00000000-0000-0000-0000-000000000112','${PROD}','${WH}', 20, 20, 8, null),
  ('00000000-0000-0000-0000-000000000113','${PROD}','${WH}', 5, 5, 8, '2000-01-01')`);
const took = await asUser(ADMIN, `select batch_id::text, taken from public.fn_consume_sellable_fifo('${WH}','${PROD}', 4, false)`);
assert.equal(took.length, 1);
assert.equal(took[0].batch_id, "00000000-0000-0000-0000-000000000112");
assert.equal(Number(took[0].taken), 4);
const badLeft = await q(`select remaining_quantity from stock_batches where id = '00000000-0000-0000-0000-000000000111'`);
assert.equal(Number(badLeft[0].remaining_quantity), 15, "bigri hui batch nahi chheri");
const expiredLeft = await q(`select remaining_quantity from stock_batches where id = '00000000-0000-0000-0000-000000000113'`);
assert.equal(Number(expiredLeft[0].remaining_quantity), 5);
await assert.rejects(() => run(`update stock_batches set remaining_quantity = 4 where id = '00000000-0000-0000-0000-000000000113'`), /Expire batch/);

await assert.rejects(() => run(`insert into grain_sales (grain_type, quantity_kg, rate_per_kg, total_amount) values ('wheat', 70, 4000, 1)`), /khareed se aage/);
await run(`insert into grain_sales (grain_type, quantity_kg, rate_per_kg, total_amount) values ('wheat', 10, 4000, 1000)`);

const oldUnit = await q(`select rate_unit from grain_sales where id = '00000000-0000-0000-0000-000000000211'`);
assert.equal(oldUnit[0].rate_unit, "per_kg");
const newUnit = await q(`select rate_unit from grain_sales where quantity_kg = 10`);
assert.equal(newUnit[0].rate_unit, "per_maund");
const oldTotal = await q(`select total_amount from grain_sales where id = '00000000-0000-0000-0000-000000000211'`);
assert.equal(Number(oldTotal[0].total_amount), 160000);

await assert.rejects(() => run(`update stock_transfers set status = 'cancelled' where id = '00000000-0000-0000-0000-000000000311'`), /Mukammal transfer/);
await run(`update stock_transfers set status = 'cancelled' where id = '00000000-0000-0000-0000-000000000312'`);

await assert.rejects(() => asUser(ADMIN, `select public.fn_decide_stock_loss('00000000-0000-0000-0000-000000000412','reject', 'wajah')`), /khud manzoor nahi/);
const decided = await asUser(ADMIN, `select public.fn_decide_stock_loss('00000000-0000-0000-0000-000000000411','approve', null) as v`);
assert.equal(decided[0].v, "ok");
const second = await asUser(OWNER, `select public.fn_decide_stock_loss('00000000-0000-0000-0000-000000000411','approve', null) as v`);
assert.equal(second[0].v, "already");

await run(`update profiles set status = 'active', is_active = true where id = '${STAFF}'`);
assert.equal(await asUser(STAFF, `select public.fn_statement_party_visible('customer','${C1}') as v`).then((r) => r[0].v), true);
assert.equal(await asUser(STAFF, `select public.fn_statement_party_visible('customer','${C2}') as v`).then((r) => r[0].v), false);
assert.equal(await asUser(ADMIN, `select public.fn_statement_party_visible('customer','${C2}') as v`).then((r) => r[0].v), true);

const expiredView = await q(`select count(*)::int as n from v_expired_batches_in_stock`);
assert.equal(expiredView[0].n, 1);

console.log("dept-review 660 sql: theek");
