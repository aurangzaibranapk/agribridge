// Real SQL test: 622 (party links) PGlite par -- live DB nahi.
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const run = (s) => db.exec(s);
const q = async (s) => (await db.query(s)).rows;
const one = async (s) => Object.values((await db.query(s)).rows[0] ?? {})[0];
const reset = "reset role; select set_config('test.uid','',false);";
const as = (u) => `set role authenticated; select set_config('test.uid','${u}',false);`;
const throws = async (s, msg) => {
  let err = null;
  try { await run(s); } catch (e) { err = e; }
  await run(reset);
  assert.ok(err, `expected error: ${msg}`);
};
let ok = 0; const pass = (n) => { ok++; console.log(`  ok  ${n}`); };

await run(fs.readFileSync("tests/sql/party-links-stubs.sql", "utf8"));
const M = fs.readFileSync("supabase/migrations/622_party_links.sql", "utf8");
const R = fs.readFileSync("supabase/migrations/622_party_links.rollback.sql", "utf8");
await run(M); await run(M); // idempotent
pass("622 applies twice (idempotent)");

// additive: no drop of existing tables/columns, no deletes, no sends
assert.doesNotMatch(M, /\bdrop\s+(table|column)\b|\btruncate\b|\bdelete\s+from\b/i);
assert.doesNotMatch(M, /whatsapp_send|net\.http|pg_net|send_email/i);
pass("migration additive, no sends");

const OWNER = "00000000-0000-0000-0000-0000000000a1", FIN = "00000000-0000-0000-0000-0000000000a2", CUSTU = "00000000-0000-0000-0000-0000000000a3";
const C = "00000000-0000-0000-0000-00000000c001", S = "00000000-0000-0000-0000-00000000s001".replace("s", "5");
await run(`insert into profiles values ('${OWNER}','owner',null,'Malik'),('${FIN}','finance',null,'Fin'),('${CUSTU}','customer',null,'Cust');
  insert into customers (id,name,phone_number) values ('${C}','Yasir Ali','03468255367');
  insert into suppliers (id,name,phone_number) values ('${S}','Yasir Ali (Diesel)','03468255367');`);

// party_links
await run(`insert into party_links (customer_id, supplier_id, created_by) values ('${C}','${S}','${OWNER}')`);
await throws(`insert into party_links (customer_id, supplier_id) values ('${C}','${S}')`, "duplicate active pair");
pass("one active link per pair");
await throws(`update party_links set is_active=false`, "inactive needs deactivated_at");
pass("deactivate needs deactivated_at");
const linkId = await one(`select id from party_links`);

// RLS: staff can read, customer cannot, nobody writes via authenticated
await run(as(FIN)); assert.equal((await q(`select id from party_links`)).length, 1); await run(reset);
await run(as(CUSTU)); assert.equal((await q(`select id from party_links`)).length, 0); await run(reset);
await run(as(OWNER));
await throws(`insert into party_links (customer_id, supplier_id) values ('${C}','${S}')`, "authenticated insert blocked");
pass("RLS: staff read, customer none, no direct writes");

// linked settlement shape
await throws(`insert into party_settlements (settlement_number,party_type,party_id,lena_khata,dena_khata,amount,wajah,party_link_id,created_by)
  values ('ADJ-T-1','customer','${C}','1100','2000',100,'x','${linkId}','${FIN}')`, "linked needs dena party");
await throws(`insert into party_settlements (settlement_number,party_type,party_id,lena_khata,dena_khata,amount,wajah,party_link_id,dena_party_type,dena_party_id,created_by)
  values ('ADJ-T-2','customer','${C}','1100','2030',100,'x','${linkId}','supplier','${S}','${FIN}')`, "linked must be 1100/2000");
await run(`insert into party_settlements (settlement_number,party_type,party_id,lena_khata,dena_khata,amount,wajah,party_link_id,dena_party_type,dena_party_id,created_by)
  values ('ADJ-T-3','customer','${C}','1100','2000',100,'diesel vs saman','${linkId}','supplier','${S}','${FIN}')`);
pass("linked settlement shape enforced (1100 customer / 2000 supplier)");

// maker-checker
await throws(`update party_settlements set status='approved', approved_by='${FIN}' where settlement_number='ADJ-T-3'`, "self approval blocked");
await run(`update party_settlements set status='approved', approved_by='${OWNER}' where settlement_number='ADJ-T-3'`);
pass("maker-checker: maker cannot approve, other can");
await throws(`update party_settlements set dena_party_id='${C}' where settlement_number='ADJ-T-3'`, "locked after approval");
pass("approved linked settlement locked");

// old (non-linked) settlements unaffected
await run(`insert into party_settlements (settlement_number,party_type,party_id,lena_khata,dena_khata,amount,wajah,created_by)
  values ('ADJ-T-4','farmer','${C}','1140','2010',50,'purana tareeqa','${FIN}')`);
await run(`update party_settlements set status='approved', approved_by='${FIN}' where settlement_number='ADJ-T-4'`);
pass("non-linked settlements unchanged (no new rule)");

// kharche kind
await run(`insert into company_expense_requests (kind, amount) values ('supplier_bill_udhaar', 5000), ('kharcha', 10)`);
await throws(`insert into company_expense_requests (kind, amount) values ('ghalat', 1)`, "unknown kind blocked");
pass("kharche: supplier_bill_udhaar allowed, unknown kind still blocked");

// fn_party_gl_lines
await run(`insert into journal_entries (id, entry_number, entry_date, description, source_module) values
  ('00000000-0000-0000-0000-0000000000e1','TXN-1','2026-10-20','Paid to Yasir','recovery_money'),
  ('00000000-0000-0000-0000-0000000000e2','TXN-2','2026-10-19','Purchase','purchase');
  insert into journal_lines (entry_id, account_code, debit, credit, party_type, party_id) values
  ('00000000-0000-0000-0000-0000000000e1','2000',30000,0,'supplier','${S}'),
  ('00000000-0000-0000-0000-0000000000e1','1010',0,30000,null,null),
  ('00000000-0000-0000-0000-0000000000e2','2000',0,9000,'supplier','${S}'),
  ('00000000-0000-0000-0000-0000000000e2','6010',9000,0,'supplier','${S}');`);
await run(as(FIN));
const rows = await q(`select * from fn_party_gl_lines('supplier','${S}', array['2000','1120'])`);
await run(reset);
assert.equal(rows.length, 2);
assert.deepEqual(rows.map((r) => r.source_module).sort(), ["purchase", "recovery_money"]);
await run(as(CUSTU));
assert.equal((await q(`select * from fn_party_gl_lines('supplier','${S}', array['2000'])`)).length, 0);
await run(reset);
await throws(`set role anon; select * from fn_party_gl_lines('supplier','${S}', array['2000'])`, "anon no execute");
pass("fn_party_gl_lines: staff only, filters account+party");

assert.equal(await one(`select count(*)::int from features where key='party-links'`), 1);
assert.equal(await one(`select count(*)::int from dashboard_features where dashboard_key='admin' and feature_key='party-links' and section='Operations'`), 1);
pass("feature row + admin sidebar row added (620 pattern)");

// rollback restores original
await run(`delete from party_settlements where party_link_id is not null; delete from company_expense_requests where kind='supplier_bill_udhaar';`);
await run(R);
assert.equal(await one(`select count(*)::int from information_schema.tables where table_name='party_links'`), 0);
assert.equal(await one(`select count(*)::int from information_schema.columns where table_name='party_settlements' and column_name='party_link_id'`), 0);
await throws(`insert into company_expense_requests (kind, amount) values ('supplier_bill_udhaar', 1)`, "kind removed after rollback");
assert.equal(await one(`select count(*)::int from features where key='party-links'`), 0);
assert.equal(await one(`select count(*)::int from dashboard_features where feature_key='party-links'`), 0);
pass("rollback clean");
await run(M);
pass("re-apply after rollback");

console.log(`party-links-sql: ${ok} passed`);
