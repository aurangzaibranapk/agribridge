// Real SQL test: 605-606 (mobile role + staff home + pending entries) PGlite par -- live DB nahi.
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const run = (s) => db.exec(s);
const one = async (s) => Object.values((await db.query(s)).rows[0] ?? {})[0];
const reset = "reset role; select set_config('test.uid','',false);";
const as = (u) => `set role authenticated; select set_config('test.uid','${u}',false);`;
const asOne = async (u, s) => { await run(as(u)); try { return await one(s); } finally { await run(reset); } };
const throws = async (u, s, re, msg) => {
  let err = null;
  try { await run(as(u)); await run(s); } catch (e) { err = e; }
  await run(reset);
  assert.ok(err, `expected error: ${msg}`);
  if (re) assert.match(String(err.message), re, `${msg} -> ${err.message}`);
};
const mig = (f) => fs.readFileSync(`supabase/migrations/${f}.sql`, "utf8");
await run(fs.readFileSync("tests/sql/portal-khata-stubs.sql", "utf8"));
await run(fs.readFileSync("tests/sql/portal-customer-stubs.sql", "utf8"));
await run(fs.readFileSync("tests/sql/mobile-roles-stubs.sql", "utf8"));
const M605 = mig("605_mobile_role_and_staff_home"), M606 = mig("606_mobile_staff_entries");
for (const m of [M605, M606]) { await run(m); await run(m); } // idempotent
let ok = 0; const pass = (n) => { ok++; console.log(`  ok  ${n}`); };

for (const m of [M605, M606]) {
  assert.doesNotMatch(m, /\bdrop\s+(table|column)\b|\btruncate\b|\bdelete\s+from\b/i);
  assert.doesNotMatch(m, /\balter\s+table\s+(public\.)?(customers|farmers|pos_sales|payment_promises|agri_orders|journal_lines|journal_entries|profiles)\b/i);
  assert.doesNotMatch(m, /insert\s+into\s+(public\.)?journal_/i);
}
pass("605/606 additive, ERP tables untouched, no ledger posting, idempotent");

const B1 = "00000000-0000-0000-0000-0000000000e1", B2 = "00000000-0000-0000-0000-0000000000e2";
const UOWN = "00000000-0000-0000-0000-0000000000d1", UFIN = "00000000-0000-0000-0000-0000000000d2";
const USAL = "00000000-0000-0000-0000-0000000000d3", USAL2 = "00000000-0000-0000-0000-0000000000d4";
const UNOB = "00000000-0000-0000-0000-0000000000d5", UMGR = "00000000-0000-0000-0000-0000000000d6";
const UFARM = "00000000-0000-0000-0000-0000000000a1", UCUST = "00000000-0000-0000-0000-0000000000b1";
const FA = "00000000-0000-0000-0000-00000000f00a";
const CA = "00000000-0000-0000-0000-00000000c00a", CB = "00000000-0000-0000-0000-00000000c00b";
await run(`
insert into branches values ('${B1}','Mahabali'),('${B2}','HQ');
insert into profiles (id, role, branch_id, full_name) values ('${UOWN}','owner',null,'Owner'),('${UFIN}','finance',null,'Fin'),
 ('${USAL}','sales_staff','${B1}','Sal1'),('${USAL2}','sales_staff','${B2}','Sal2'),('${UNOB}','sales_staff',null,'NoBranch'),
 ('${UMGR}','manager','${B1}','Mgr'),('${UFARM}','farmer',null,'Kisan'),('${UCUST}','customer',null,'Gahak');
insert into farmers (id, user_id, full_name, farmer_code) values ('${FA}','${UFARM}','Kisan A','FRM-000066');
insert into customers (id, user_id, farmer_id, name, branch_id, phone_number) values
 ('${CA}','${UFARM}','${FA}','A kisan','${B1}','03001234521'),('${CB}','${UCUST}',null,'B store','${B2}','03111111199');
insert into journal_entries (id, entry_number, entry_date, source_module) values
 ('00000000-0000-0000-0000-0000000e0001','POS-1', current_date - 40, 'pos'),('00000000-0000-0000-0000-0000000e0002','RCP-1', current_date, 'recovery_money'),
 ('00000000-0000-0000-0000-0000000e0003','POS-2', current_date - 5, 'pos');
insert into journal_lines (entry_id, account_code, debit, credit, party_type, party_id) values
 ('00000000-0000-0000-0000-0000000e0001','1100', 50000, 0,'customer','${CA}'),('00000000-0000-0000-0000-0000000e0002','1100', 0, 8000,'customer','${CA}'),
 ('00000000-0000-0000-0000-0000000e0003','1100', 9000, 0,'customer','${CB}');
insert into pos_sales (total_amount, branch_id, created_at) values (1000,'${B1}',now()),(2500,'${B2}',now());
insert into payment_promises (party_type, party_id, promised_amount, promise_date, status) values ('customer','${CA}',15000,current_date,'open');
insert into agri_orders (customer_id, status) values ('${CB}','pending');
`);

// whoami
assert.equal((await asOne(UFARM, `select fn_mobile_whoami()`)).kind, "farmer");
assert.equal((await asOne(UCUST, `select fn_mobile_whoami()`)).kind, "customer");
const ws = await asOne(USAL, `select fn_mobile_whoami()`);
assert.equal(ws.kind, "staff"); assert.equal(ws.sees_all_branches, false); assert.equal(ws.branch_id, B1);
assert.equal((await asOne(UFIN, `select fn_mobile_whoami()`)).sees_all_branches, true);
assert.equal((await one(`select fn_mobile_whoami()`)).kind, "none");
pass("whoami: farmer / customer / staff(branch) / finance(all) / none");

// all-branch
const so = await asOne(UOWN, `select fn_staff_home_summary()`);
assert.equal(Number(so.sales_today), 3500); assert.equal(Number(so.branch_due), 51000); assert.equal(Number(so.pending_orders), 1);
const lo = await asOne(UFIN, `select fn_staff_party_search()`);
assert.equal(lo.length, 2);
pass("owner/finance see all branches");

// own-branch
const s1 = await asOne(USAL, `select fn_staff_home_summary()`);
assert.equal(Number(s1.sales_today), 1000); assert.equal(Number(s1.branch_due), 42000); assert.equal(Number(s1.recovery_today), 8000);
assert.equal(Number(s1.promises_today), 1); assert.equal(Number(s1.pending_orders), 0);
const l1 = await asOne(USAL, `select fn_staff_party_search()`);
assert.equal(l1.length, 1); assert.equal(l1[0].name, "A kisan"); assert.equal(l1[0].kind, "farmer");
assert.equal(l1[0].phone_masked, "0300xxxxx21"); assert.equal(l1[0].age_days, 40);
assert.ok(!JSON.stringify(l1).includes("03001234521"), "full phone hidden in list");
assert.equal((await asOne(USAL, `select fn_staff_party_search('FRM-000066')`)).length, 1);
assert.equal((await asOne(USAL, `select fn_staff_party_search(null,'customer')`)).length, 0);
const pv = await asOne(USAL, `select fn_staff_party_view('${CA}')`);
assert.equal(Number(pv.due), 42000); assert.equal(pv.khata.length, 2); assert.equal(pv.promises.length, 1);
await throws(USAL, `select fn_staff_party_view('${CB}')`, /branch/, "other branch party blocked");
pass("sales staff: own branch only, phone masked in list");

// no-branch staff
const sn = await asOne(UNOB, `select fn_staff_home_summary()`);
assert.equal(Number(sn.sales_today), 0); assert.equal(Number(sn.branch_due), 0);
assert.equal((await asOne(UNOB, `select fn_staff_party_search()`)).length, 0);
pass("staff without branch sees nothing");

// non-staff
for (const u of [UFARM, UCUST]) {
  await throws(u, `select fn_staff_home_summary()`, /staff/, "non-staff summary");
  await throws(u, `select fn_staff_party_search()`, /staff/, "non-staff search");
  await throws(u, `select fn_staff_submit_entry(gen_random_uuid(),'recovery','${CA}',100)`, /staff/, "non-staff submit");
}
await throws("", `select fn_staff_home_summary()`, null, "anon blocked");
pass("farmer/customer/anon blocked from staff RPCs");

// entries: pending, idempotent, maker-checker
const K = "11111111-1111-1111-1111-111111111111";
const e1 = await asOne(USAL, `select fn_staff_submit_entry('${K}','recovery','${CA}',10000,'cash','test')`);
assert.equal(e1.status, "pending"); assert.equal(e1.duplicate, false);
const e2 = await asOne(USAL, `select fn_staff_submit_entry('${K}','recovery','${CA}',10000,'cash','test')`);
assert.equal(e2.duplicate, true); assert.equal(e2.id, e1.id);
assert.equal(await one(`select count(*)::int from mobile_staff_entries`), 1);
assert.equal(await one(`select count(*)::int from journal_lines`), 3, "no ledger posting from app");
await throws(USAL, `select fn_staff_submit_entry(gen_random_uuid(),'recovery','${CB}',100)`, /branch/, "other-branch submit");
await throws(USAL, `select fn_staff_submit_entry(gen_random_uuid(),'recovery','${CA}',0)`, /Raqam/, "amount required");
await throws(USAL, `insert into mobile_staff_entries (client_uuid,kind,party_id,created_by) values (gen_random_uuid(),'milk','${CA}','${USAL}')`, /permission/, "no direct insert");
assert.equal((await asOne(USAL, `select fn_staff_home_summary()`)).pending_entries, 1);
await throws(USAL, `select fn_staff_decide_entry('${e1.id}', true)`, /maker-checker/, "self-approval blocked");
await throws(USAL2, `select fn_staff_decide_entry('${e1.id}', true)`, /ijazat/, "other sales staff cannot approve");
{ let err = null; try { await run(`update mobile_staff_entries set decided_by = created_by, status='approved'`); } catch (e) { err = e; }
  assert.match(String(err?.message), /no_self_approval/, "table constraint blocks self-approval even for admin SQL"); }
await throws(USAL, `update mobile_staff_entries set status='approved'`, /permission/, "no direct update");
const d = await asOne(UMGR, `select fn_staff_decide_entry('${e1.id}', true)`);
assert.equal(d.status, "approved");
await throws(UFIN, `select fn_staff_decide_entry('${e1.id}', false)`, /faisla/, "no double decision");
assert.equal((await asOne(USAL, `select fn_staff_my_entries()`))[0].status, "approved");
pass("entries pending-only, idempotent, maker-checker (fn + constraint), branch manager/finance approve");

// logging + log privacy
assert.ok(await one(`select count(*)::int from mobile_staff_action_log where actor_id='${USAL}' and action='entry_submit'`) === 1);
assert.ok(await one(`select count(*)::int from mobile_staff_action_log where action='entry_approve' and actor_id='${UMGR}'`) === 1);
assert.equal(await asOne(USAL, `select count(*)::int from mobile_staff_action_log`), 0, "sales staff can't read log");
assert.ok(await asOne(UOWN, `select count(*)::int from mobile_staff_action_log`) > 3);
await throws(USAL, `select fn_mobile_log('x', null, null, '{}')`, /permission/, "log fn not callable directly");
pass("staff actions logged; log readable by owner/admin only");

// rollback
await run(fs.readFileSync("supabase/rollbacks/606_mobile_staff_entries.rollback.sql", "utf8"));
await run(fs.readFileSync("supabase/rollbacks/605_mobile_role_and_staff_home.rollback.sql", "utf8"));
assert.equal(await one(`select count(*)::int from pg_proc where proname like 'fn_staff_%' or proname like 'fn_mobile_%'`), 0);
await run(M605); await run(M606);
pass("rollbacks clean, re-apply ok");
console.log(`mobile-roles-sql: ${ok} checks passed`);
