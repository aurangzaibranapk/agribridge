// PGlite only. Does not connect to Testing or Live.
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const run = (s) => db.exec(s);
const q = async (s) => (await db.query(s)).rows;
const one = async (s) => Object.values((await db.query(s)).rows[0] ?? {})[0];
const reset = "reset role; select set_config('test.uid','',false); select set_config('test.role','',false);";
const asUser = (id, role) =>
  `set role authenticated; select set_config('test.uid','${id}',false); select set_config('test.role','authenticated',false);`;
const throws = async (sql, msg) => {
  let err = null;
  try { await run(sql); } catch (e) { err = e; }
  await run(reset);
  assert.ok(err, `expected error: ${msg}`);
};
let ok = 0;
const pass = (n) => { ok++; console.log(`  ok  ${n}`); };

const ORG = "11111111-1111-1111-1111-111111111111";
const ADMIN = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1";
const MANAGER = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2";
const ACCT = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1";

await run(fs.readFileSync("tests/sql/finance-fixes-stubs.sql", "utf8"));
const m640 = fs.readFileSync("supabase/migrations/640_finance_money_write_rls.sql", "utf8");
const m641 = fs.readFileSync("supabase/migrations/641_finance_maker_checker_and_indexes.sql", "utf8");
const m642 = fs.readFileSync("supabase/migrations/642_customer_balance_drift.sql", "utf8");
await run(m640);
await run(m640);
pass("640 applies twice");
await run(m641);
await run(m641);
pass("641 applies twice");
await run(m642);
pass("642 applies");

await run(`insert into profiles (id, role, is_active) values
  ('${ADMIN}','admin',true), ('${MANAGER}','manager',true);`);
await run(`insert into finance_accounts (id, name, organization_id) values ('${ACCT}','Cash','${ORG}');`);

await throws(
  `${asUser(MANAGER, "authenticated")} insert into finance_transactions (account_id, transaction_type, amount) values ('${ACCT}','expense',10);`,
  "manager cannot write finance_transactions"
);
pass("manager finance write blocked");

await run(`${asUser(ADMIN, "authenticated")} insert into finance_transactions (account_id, transaction_type, amount, category) values ('${ACCT}','income',5,'Shuruati balance');`);
await run(reset);
pass("admin finance write allowed");

await throws(
  `${asUser(ADMIN, "authenticated")} insert into finance_transactions (account_id, transaction_type, amount, category) values ('${ACCT}','income',5,'Shuruati balance');`,
  "second opening"
);
pass("opening balance unique");

await throws(
  `${asUser(ADMIN, "authenticated")} insert into journal_entries (description) values ('seedha');`,
  "direct journal insert"
);
pass("journal insert blocked for authenticated");

const cust = "cccccccc-cccc-cccc-cccc-ccccccccccc1";
await run(`insert into customers (id, name, current_balance) values ('${cust}','Ali',0);`);
await throws(
  `${asUser(MANAGER, "authenticated")} update customers set current_balance = 99 where id = '${cust}';`,
  "manager balance"
);
pass("manager cannot write customer balance");
await run(`${asUser(ADMIN, "authenticated")} update customers set current_balance = 12 where id = '${cust}';`);
await run(reset);
assert.equal(Number(await one(`select current_balance from customers where id = '${cust}'`)), 12);
pass("admin can write customer balance");
await run(`update customers set current_balance = 12 where id = '${cust}';`);
pass("postgres can write customer balance");
await run(`set role service_role; update customers set current_balance = 12 where id = '${cust}';`);
await run(reset);
pass("service_role can write customer balance");

await run(`insert into journal_lines (account_code, debit, credit, party_type, party_id) values ('1100',20,0,'customer','${cust}');`);
const drift = await q(`select * from fn_customer_balance_drift()`);
assert.equal(drift.length, 1);
assert.equal(Number(drift[0].stored), 12);
assert.equal(Number(drift[0].ledger), 20);
pass("drift check sees stored vs ledger");

const entry = "dddddddd-dddd-dddd-dddd-ddddddddddd1";
const rev = "dddddddd-dddd-dddd-dddd-ddddddddddd2";
await run(`insert into journal_entries (id, description) values ('${entry}','asal');`);
await run(`insert into journal_entries (id, description, is_reversal, reversal_of) values ('${rev}','ulta',true,'${entry}');`);
assert.equal(await one(`select posting_status from journal_entries where id = '${entry}'`), "reversed");
pass("source row marked reversed");

const dealer = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1";
await run(`insert into dealers (id, business_name, current_payable) values ('${dealer}','D',100);`);
await throws(
  `insert into dealer_payments (dealer_id, amount, payment_date, created_by, approved_by, status, journal_entry_id)
   values ('${dealer}',10,'2026-10-01','${ADMIN}','${ADMIN}','posted','${entry}');`,
  "self approve"
);
pass("maker cannot post own dealer payment");
await run(`insert into dealer_payments (dealer_id, amount, payment_date, created_by, status) values ('${dealer}',10,'2026-10-01','${MANAGER}','pending');`);
pass("pending dealer request allowed");

await throws(
  `${asUser(MANAGER, "authenticated")} update dealers set current_payable = 0 where id = '${dealer}';`,
  "manager dealer payable"
);
pass("manager cannot write dealer payable");

console.log(`PASS: finance rls sql (${ok})`);
