// 624/625 Call Center — PGlite. Live database nahi, testing project nahi.
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const run = (s) => db.exec(s);
const q = async (s) => (await db.query(s)).rows;
const one = async (s) => Object.values((await db.query(s)).rows[0] ?? {})[0];
const reset = "reset role; select set_config('test.uid','',false);";
const as = (u) => `set role authenticated; select set_config('test.uid','${u}',false);`;
const throws = async (sql, msg) => {
  let err = null;
  try { await run(sql); } catch (e) { err = e; }
  await run(reset);
  assert.ok(err, `expected error: ${msg}`);
  return String(err.message ?? err);
};
let ok = 0;
const pass = (n) => { ok++; console.log(`  ok  ${n}`); };

const ROLE = fs.readFileSync("supabase/migrations/624_call_center_role.sql", "utf8");
const MAIN = fs.readFileSync("supabase/migrations/625_call_center.sql", "utf8");
const ROLL = fs.readFileSync("supabase/migrations/625_call_center.rollback.sql", "utf8");

assert.doesNotMatch(ROLE + MAIN, /hwaiuwxqldxsoukkfefn/);
assert.doesNotMatch(MAIN, /net\.http|pg_net|whatsapp_send|send_whatsapp/i);
assert.match(MAIN, /WhatsApp band/);
assert.match(MAIN, /check \(channel = 'sms'\)/);
assert.match(MAIN, /fn_cc_agent_cannot_write/);
assert.match(MAIN, /chk_cc_maker/);
assert.doesNotMatch(MAIN, /\bdelete\s+from\b/i);
pass("migration: SMS-only, no WhatsApp, no testing project, no deletes");

await run(fs.readFileSync("tests/sql/call-center-stubs.sql", "utf8"));
await run(ROLE);
await run(MAIN);
await run(MAIN);
pass("624+625 apply twice");

const ORG = "00000000-0000-0000-0000-0000000000aa";
const ADMIN = "00000000-0000-0000-0000-0000000000a1";
const AGENT = "00000000-0000-0000-0000-0000000000a2";
const FIN = "00000000-0000-0000-0000-0000000000a3";
const SALES = "00000000-0000-0000-0000-0000000000a4";
const OWNER = "00000000-0000-0000-0000-0000000000a5";
const FARMER = "00000000-0000-0000-0000-0000000000f1";
const CUST = "00000000-0000-0000-0000-0000000000c1";

await run(`
  insert into organizations values ('${ORG}');
  insert into profiles (id, role, full_name, is_active, organization_id, phone_number) values
    ('${ADMIN}','admin','Admin',true,'${ORG}',null),
    ('${AGENT}','admin','Sana Agent',true,'${ORG}','03331234541'),
    ('${FIN}','finance','Accounts',true,'${ORG}',null),
    ('${SALES}','sales_staff','Sales',true,'${ORG}',null),
    ('${OWNER}','owner','Malik',true,'${ORG}',null);
  insert into farmers (id, full_name, phone_number, farmer_code, village, organization_id) values
    ('${FARMER}','Muhammad Aslam','03221234576','FRM-000045','Chak 45 GB','${ORG}');
  insert into customers (id, name, phone_number, address, organization_id) values
    ('${CUST}','Bilal Dairy','03011234509','Jaranwala','${ORG}');
  insert into milk_entries (farmer_id, entry_date, quantity_liters, total_amount, rate_per_liter) values
    ('${FARMER}','2026-10-20',18.5,3885,210);
  insert into products (name, selling_price, category_id) values ('Urea (50kg)', 4650, null);
`);

assert.equal(await one(`select public.fn_cc_mask_phone('03221234576')`), "0322-*****76");
pass("mask: pehli 4, aakhri 2");

// Agent ohda — admin register karta hai, invite nahi.
await run(as(ADMIN));
const reg = await one(`select public.fn_cc_register_agent('${AGENT}','03331234541','Sana Iqbal')::text`);
await run(reset);
assert.match(String(reg), /AGT-0001/);
assert.equal(await one(`select role::text from profiles where id = '${AGENT}'`), "call_center_agent");
pass("admin creates agent AGT-0001, role call_center_agent");

await run(as(AGENT));
await throws(`select public.fn_cc_register_agent('${FIN}','03001111111','X')`, "agent cannot create agents");
pass("agent cannot create agents");

// Numbering + SMS only
await run(as(AGENT));
const made = JSON.parse(String(await one(
  `select public.fn_cc_create_complaint('farmer','${FARMER}','khata_ghalat','DAP 1 bag galat likha gaya hai.','sms')::text`
)));
await run(reset);
assert.equal(made.number, "CMP-000001");
assert.equal(made.department, "accounts");
assert.equal(made.priority, "high");
assert.equal(made.sla_hours, 24);
assert.equal(made.sms, "queued");
assert.doesNotMatch(JSON.stringify(made), /03221234576/);
assert.equal(await one(`select channel from cc_sms_outbox where complaint_id = '${made.id}'`), "sms");
assert.equal(await one(`select status from cc_sms_outbox where complaint_id = '${made.id}'`), "queued");
assert.equal(await one(`select count(*)::int from cc_sms_outbox where channel <> 'sms'`), 0);
pass("CMP-000001, accounts/24h, SMS queued, phone not returned");

await run(as(AGENT));
const errWa = await throws(
  `select public.fn_cc_create_complaint('farmer','${FARMER}','delivery','Bag nahi aaya abhi tak bhi.','whatsapp')`,
  "whatsapp rejected"
);
assert.match(errWa, /SMS/);
pass("WhatsApp channel rejected");
assert.equal(await one(`select count(*)::int from cc_complaints`), 1);
pass("rejected WhatsApp did not create a complaint");

await run(as(AGENT));
const second = JSON.parse(String(await one(
  `select public.fn_cc_create_complaint('farmer','${FARMER}','doodh','Doodh ka rate galat lag raha hai aaj.','sms')::text`
)));
await run(reset);
assert.equal(second.number, "CMP-000002");
assert.equal(second.department, "dairy");
pass("second number CMP-000002, doodh -> dairy");

// Maker-checker
await run(as(AGENT));
const agentClose = await throws(
  `select public.fn_cc_set_complaint_status('${made.id}','resolved')`,
  "agent cannot resolve"
);
await run(reset);
assert.match(agentClose, /status nahi badal/);
pass("maker: agent cannot resolve");

await run(as(SALES));
const salesClose = await throws(
  `select public.fn_cc_set_complaint_status('${made.id}','resolved')`,
  "sales cannot close accounts"
);
assert.match(salesClose, /department/);
pass("other department cannot close");

await run(as(FIN));
const closed = JSON.parse(String(await one(
  `select public.fn_cc_set_complaint_status('${made.id}','resolved')::text`
)));
await run(reset);
assert.equal(closed.status, "resolved");
assert.equal(await one(`select resolved_by::text from cc_complaints where id = '${made.id}'`), FIN);
assert.notEqual(await one(`select resolved_by::text from cc_complaints where id = '${made.id}'`), AGENT);
pass("finance (accounts) can resolve, maker is not the closer");

await run(as(OWNER));
const own = JSON.parse(String(await one(
  `select public.fn_cc_create_complaint('customer','${CUST}','payment','Payment slip par raqam galat hai.','sms')::text`
)));
await run(reset);
await run(as(OWNER));
const self = await throws(
  `select public.fn_cc_set_complaint_status('${own.id}','resolved')`,
  "owner cannot close own"
);
assert.match(self, /khud band nahi/);
pass("maker-checker holds for owner too");

// View-only writes
await run(as(AGENT));
const writeKhata = await throws(
  `insert into journal_lines (account_code, debit, credit) values ('1000', 10, 0)`,
  "agent journal insert"
);
assert.match(writeKhata, /dekh sakta|permission|policy|row-level/i);
pass("agent cannot write journal");

await run(as(AGENT));
const writeRate = await throws(
  `update products set selling_price = 1`,
  "agent rate change"
);
assert.match(writeRate, /dekh sakta hai/);
pass("agent cannot change a rate even if RLS is open");

await run(as(FIN));
await run(`insert into journal_entries (id, entry_date, description, source_module) values ('00000000-0000-0000-0000-0000000000e1','2026-10-20','test','manual');
  insert into journal_lines (entry_id, account_code, debit, credit) values ('00000000-0000-0000-0000-0000000000e1','1000',10,0);`);
await run(reset);
assert.equal(await one(`select count(*)::int from journal_lines`), 1);
pass("finance can still write the journal");

// 360: audit + masked + balance tracked. Empty customer is NULL not zero.
await run(as(AGENT));
const view = JSON.parse(String(await one(
  `select public.fn_cc_party_360('farmer','${FARMER}','PC-CC-01')::text`
)));
await run(reset);
assert.equal(view.found, true);
assert.equal(view.phone_masked, "0322-*****76");
assert.equal(view.tracked, true);
assert.ok(view.balance > 0);
assert.doesNotMatch(JSON.stringify(view), /03221234576/);
assert.equal(await one(`select count(*)::int from cc_lookup_audit where party_id = '${FARMER}' and device = 'PC-CC-01'`), 1);
pass("khata view writes audit, masks phone, balance tracked");

await run(as(AGENT));
const empty = JSON.parse(String(await one(
  `select public.fn_cc_party_360('customer','${CUST}','PC-CC-02')::text`
)));
await run(reset);
assert.equal(empty.tracked, false);
assert.equal(empty.balance, null);
pass("no ledger is null, not zero");

await run(as(AGENT));
await throws(`select public.fn_cc_audit_log(10)`, "agent cannot read audit");
await run(as(ADMIN));
const audit = JSON.parse(String(await one(`select public.fn_cc_audit_log(10)::text`)));
await run(reset);
assert.ok(audit.length >= 1);
assert.match(JSON.stringify(audit), /PC-CC-01|Khata dekha/);
pass("audit visible to admin only");

assert.equal(await one(`select count(*)::int from features where key like 'call-center%'`), 3);
assert.equal(await one(`select actions::text from role_feature_permissions where role = 'call_center_agent' and feature_key = 'call-center'`), "{view,create}");
const agentBoard = await one(`select actions::text from role_feature_permissions where role = 'call_center_agent' and feature_key = 'call-center-board'`);
assert.equal(agentBoard, "{view}");
assert.equal(await one(`select count(*)::int from role_feature_permissions where role = 'call_center_agent' and feature_key = 'call-center-agents'`), 0);
pass("permissions: agent view/create console, view board, no agent admin");

await run(ROLL);
assert.equal(await one(`select to_regclass('public.cc_complaints')::text`), null);
pass("rollback drops call-center tables");

console.log(`\ncall-center-sql: ${ok} checks pass`);
