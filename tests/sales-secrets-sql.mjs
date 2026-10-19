// Real SQL test: 595 + 596 ko PGlite (in-process Postgres) par chalata hai -- live DB nahi.
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const run = (sql) => db.exec(sql);
const m595 = fs.readFileSync("supabase/migrations/595_hide_cost_columns_from_public.sql", "utf8");
const m596 = fs.readFileSync("supabase/migrations/596_finance_load_customer_read_scope.sql", "utf8");
const r595 = fs.readFileSync("supabase/rollbacks/595_hide_cost_columns_from_public.down.sql", "utf8");
const r596 = fs.readFileSync("supabase/rollbacks/596_finance_load_customer_read_scope.down.sql", "utf8");

for (const s of [m595, m596]) assert.doesNotMatch(s, /\bdrop table\b|\btruncate\b|\bdrop column\b|\bdelete from\b/i, "additive only");

await run(fs.readFileSync("tests/sql/sales-secrets-stubs.sql", "utf8"));

const ORG = "00000000-0000-0000-0000-0000000000f0";
const B1 = "00000000-0000-0000-0000-0000000000b1", B2 = "00000000-0000-0000-0000-0000000000b2";
const S1 = "00000000-0000-0000-0000-0000000000c1";
const OWNER = "00000000-0000-0000-0000-00000000000a", ADMIN = "00000000-0000-0000-0000-00000000000b",
  FIN = "00000000-0000-0000-0000-00000000000c", MGR = "00000000-0000-0000-0000-00000000000d",
  STAFF = "00000000-0000-0000-0000-00000000000e", STAFF2 = "00000000-0000-0000-0000-00000000000f",
  FARMER = "00000000-0000-0000-0000-000000000010";
const ACC = "00000000-0000-0000-0000-0000000000a1";
await run(`
  insert into profiles (id, full_name, role, branch_id, shop_id, organization_id) values
   ('${OWNER}','Owner','owner',null,null,'${ORG}'), ('${ADMIN}','Admin','super_admin','${B1}',null,'${ORG}'),
   ('${FIN}','Finance','finance',null,null,'${ORG}'), ('${MGR}','Manager','manager','${B1}',null,'${ORG}'),
   ('${STAFF}','Anwar','sales_staff','${B1}','${S1}','${ORG}'), ('${STAFF2}','Staff B2','sales_staff','${B2}',null,'${ORG}'),
   ('${FARMER}','Kisan','farmer',null,null,'${ORG}');
  insert into products (organization_id, name, selling_price, purchase_price) values ('${ORG}','DAP',14000,12500);
  insert into stock_batches (remaining_quantity, unit_cost) values (10, 12500);
  insert into customers (organization_id, branch_id, name, current_balance, credit_limit) values
   ('${ORG}','${B1}','Gahak B1',5000,10000), ('${ORG}','${B2}','Gahak B2',7000,10000), ('${ORG}','${B1}','Gahak B1b',100,null);
  insert into finance_accounts (id, organization_id, name) values ('${ACC}','${ORG}','Cash');
  insert into finance_transactions (account_id, transaction_type, category, amount, created_by) values ('${ACC}','income','Shuruati',100000,'${OWNER}');
  insert into finance_transactions (account_id, transaction_type, category, amount, created_by) values ('${ACC}','expense','Bijli',20000,'${OWNER}');
  insert into finance_transactions (account_id, transaction_type, category, amount, created_by) values ('${ACC}','expense','Salary',50000,'${FIN}');
  insert into load_transactions (kind, principal, service_charge, branch_id, shop_id, created_by) values
   ('load',1000,20,'${B1}','${S1}','${STAFF}'), ('load',2000,40,'${B2}',null,'${STAFF2}'), ('bill',5000,50,'${B1}',null,'${MGR}');
`);

async function as(role, uid, sql) {
  await run(`reset role; select set_config('test.uid', '${uid ?? ""}', false); set role ${role};`);
  try { return (await db.query(sql)).rows; } finally { await run("reset role;"); }
}
const count = async (role, uid, sql) => Number(Object.values((await as(role, uid, sql))[0])[0]);

// ---------- pehle: leak maujood (live jaisa) ----------
assert.equal((await as("anon", null, "select purchase_price from products"))[0].purchase_price, "12500", "pre-595: anon parh sakta tha");
assert.equal(await count("authenticated", STAFF, "select count(*) from finance_transactions"), 3, "pre-596: staff poori cash book");
assert.equal(await count("authenticated", STAFF, "select count(*) from customers"), 3, "pre-596: staff sab branches");

// ---------- 595 ----------
await run(m595); await run(m595); // idempotent
await assert.rejects(() => as("anon", null, "select purchase_price from products"), /permission denied/i, "anon: purchase_price band");
await assert.rejects(() => as("anon", null, "select * from products"), /permission denied/i, "anon: select * bhi band");
await assert.rejects(() => as("anon", null, "select unit_cost from stock_batches"), /permission denied/i);
await assert.rejects(() => as("anon", null, "select current_balance from customers"), /permission denied/i);
const pub = await as("anon", null, "select id, name, selling_price, image_url from products");
assert.equal(pub.length, 1, "public listing chalti hai");
assert.equal(pub[0].name, "DAP");
assert.equal(await count("anon", null, "select count(*) from products"), 1);
// staff (authenticated) par koi farq nahi
assert.equal((await as("authenticated", OWNER, "select purchase_price from products"))[0].purchase_price, "12500");
// rollback 595 kaam karta hai, phir dobara lagao
await run(r595);
assert.equal((await as("anon", null, "select purchase_price from products"))[0].purchase_price, "12500", "rollback 595");
await run(m595);
await assert.rejects(() => as("anon", null, "select purchase_price from products"), /permission denied/i);

// ---------- 596 ----------
await run(m596); await run(m596); // idempotent
// finance_transactions: owner/admin/finance sab; staff/manager sirf apni
assert.equal(await count("authenticated", OWNER, "select count(*) from finance_transactions"), 3);
assert.equal(await count("authenticated", ADMIN, "select count(*) from finance_transactions"), 3);
assert.equal(await count("authenticated", FIN, "select count(*) from finance_transactions"), 3);
assert.equal(await count("authenticated", STAFF, "select count(*) from finance_transactions"), 0, "staff ko company ke kharche nahi");
assert.equal(await count("authenticated", MGR, "select count(*) from finance_transactions"), 0);
assert.equal(await count("authenticated", FARMER, "select count(*) from finance_transactions"), 0);
assert.equal(await count("anon", null, "select count(*) from finance_transactions"), 0);

// sales staff ki apni cash-book entry: insert + returning chalta hai, aur balance guard nahi tootta
const ins = await as("authenticated", STAFF,
  `insert into finance_transactions (account_id, transaction_type, category, amount) values ('${ACC}','income','POS cash',3000) returning id, created_by`);
assert.equal(ins.length, 1, "insert...returning chalta hai");
assert.equal(ins[0].created_by, STAFF, "created_by khud bhar gaya");
assert.equal(await count("authenticated", STAFF, "select count(*) from finance_transactions"), 1, "apni entry nazar aati hai");
const bal = await as("authenticated", ADMIN, `select current_balance from finance_accounts where id='${ACC}'`);
assert.equal(Number(bal[0].current_balance), 100000 - 20000 - 50000 + 3000, "balance sahi (guard ne poora jor liya)");
// guard abhi bhi seedha balance likhne se rokta hai
await assert.rejects(() => as("authenticated", ADMIN, `update finance_accounts set current_balance = 1 where id='${ACC}'`), /seedha nahi likha/);

// load_transactions: owner/finance sab; manager branch; staff apni
assert.equal(await count("authenticated", OWNER, "select count(*) from load_transactions"), 3);
assert.equal(await count("authenticated", FIN, "select count(*) from load_transactions"), 3);
assert.equal(await count("authenticated", MGR, "select count(*) from load_transactions"), 2, "manager: sirf apni branch");
assert.equal(await count("authenticated", STAFF, "select count(*) from load_transactions"), 1, "staff: sirf apni darj ki");
assert.equal(await count("authenticated", STAFF2, "select count(*) from load_transactions"), 1);
assert.equal(await count("authenticated", FARMER, "select count(*) from load_transactions"), 0);

// customers: owner/admin/finance sab; staff apni branch
assert.equal(await count("authenticated", OWNER, "select count(*) from customers"), 3);
assert.equal(await count("authenticated", FIN, "select count(*) from customers"), 3);
assert.equal(await count("authenticated", STAFF, "select count(*) from customers"), 2, "staff: sirf apni branch ke gahak");
assert.equal(await count("authenticated", STAFF2, "select count(*) from customers"), 1);
assert.equal(await count("authenticated", MGR, "select count(*) from customers"), 2);
// staff apni branch ke gahak ka baqaya update kar sakta hai (POS khata)
await as("authenticated", STAFF, `update customers set current_balance = current_balance + 1 where name='Gahak B1'`);
assert.equal(Number((await as("authenticated", OWNER, "select current_balance from customers where name='Gahak B1'"))[0].current_balance), 5001);

// ---------- rollback 596 ----------
await run(r596);
assert.equal(await count("authenticated", STAFF, "select count(*) from finance_transactions"), 4, "rollback: purana haal");
assert.equal(await count("authenticated", STAFF, "select count(*) from customers"), 3);
await run(m596);
assert.equal(await count("authenticated", STAFF, "select count(*) from finance_transactions"), 1);

console.log("sales-secrets SQL (595 + 596): sab test pass");
