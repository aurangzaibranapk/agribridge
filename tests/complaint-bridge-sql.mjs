// 626 — complaints Support queue mein. Live database nahi.
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const run = (s) => db.exec(s);
const one = async (s) => Object.values((await db.query(s)).rows[0] ?? {})[0];
const reset = "reset role; select set_config('test.uid','',false);";
const as = (u) => `set role authenticated; select set_config('test.uid','${u}',false);`;
const throws = async (sql) => {
  let err = null;
  try { await run(sql); } catch (e) { err = e; }
  await run(reset);
  assert.ok(err, "expected an error");
  return String(err.message ?? err);
};
let ok = 0;
const pass = (n) => { ok++; console.log(`  ok  ${n}`); };

const bridge = fs.readFileSync("supabase/migrations/626_complaint_support_bridge.sql", "utf8");
assert.doesNotMatch(bridge, /hwaiuwxqldxsoukkfefn/);
assert.doesNotMatch(bridge, /net\.http|pg_net|whatsapp_send|send_whatsapp/i);
assert.doesNotMatch(bridge, /\bdelete\s+from\b/i);
assert.match(bridge, /intake_source/);
assert.match(bridge, /Sirf Admin assign karta hai/);
pass("626 file: additive, SMS path untouched, no testing project");

await run(fs.readFileSync("tests/sql/call-center-stubs.sql", "utf8"));
await run(fs.readFileSync("tests/sql/complaint-bridge-stub.sql", "utf8"));
await run(fs.readFileSync("supabase/migrations/624_call_center_role.sql", "utf8"));
await run(fs.readFileSync("supabase/migrations/625_call_center.sql", "utf8"));
await run(bridge);
await run(bridge);
pass("624+625+626 apply twice");

const ORG = "00000000-0000-0000-0000-0000000000aa";
const ADMIN = "00000000-0000-0000-0000-0000000000a1";
const AGENT = "00000000-0000-0000-0000-0000000000a2";
const FIN = "00000000-0000-0000-0000-0000000000a3";
const SALES = "00000000-0000-0000-0000-0000000000a4";
const ADMIN2 = "00000000-0000-0000-0000-0000000000a6";
const FARMER = "00000000-0000-0000-0000-0000000000f1";

await run(`
  insert into organizations values ('${ORG}');
  insert into profiles (id, role, full_name, is_active, organization_id) values
    ('${ADMIN}','admin','Admin One',true,'${ORG}'),
    ('${ADMIN2}','admin','Admin Two',true,'${ORG}'),
    ('${AGENT}','admin','Sana Agent',true,'${ORG}'),
    ('${FIN}','finance','Accounts',true,'${ORG}'),
    ('${SALES}','sales_staff','Imran Staff',true,'${ORG}');
  insert into farmers (id, full_name, phone_number, farmer_code, village, organization_id) values
    ('${FARMER}','Muhammad Aslam','03221234576','FRM-000045','Chak 45 GB','${ORG}');
`);

await run(as(ADMIN));
await run(`select public.fn_cc_register_agent('${AGENT}','03331234541','Sana Iqbal')`);
await run(reset);

await run(as(AGENT));
const made = JSON.parse(String(await one(
  `select public.fn_cc_create_complaint('farmer','${FARMER}','khata_ghalat','DAP 1 bag galat likha gaya hai.','sms')::text`
)));
await run(reset);
assert.equal(made.number, "CMP-000001");
assert.equal(made.sms, "queued");
const ticket = await one(`select id::text from support_tickets where cc_complaint_id = '${made.id}'`);
assert.ok(ticket);
assert.equal(await one(`select intake_source from support_tickets where id = '${ticket}'`), "call_center");
assert.equal(await one(`select suggested_department from support_tickets where id = '${ticket}'`), "accounts");
assert.equal(await one(`select assigned_to::text from support_tickets where id = '${ticket}'`), null);
assert.equal(await one(`select department_id::text from support_tickets where id = '${ticket}'`), null);
assert.equal(await one(`select status from support_tickets where id = '${ticket}'`), "new");
assert.equal(await one(`select support_ticket_id::text from cc_complaints where id = '${made.id}'`), ticket);
assert.match(String(await one(`select note from support_ticket_events where ticket_id = '${ticket}'`)), /Tajweez department: accounts/);
assert.equal(await one(`select channel from cc_sms_outbox where complaint_id = '${made.id}'`), "sms");
pass("CMP lands in support queue, suggested accounts, nobody assigned, SMS queued");

await run(as(SALES));
const staffErr = await throws(
  `select public.fn_complaint_forward('${ticket}', '${FIN}', 'accounts', null, null)`
);
await run(reset);
assert.match(staffErr, /Sirf Admin assign/);
pass("staff cannot assign");

await run(as(SALES));
const filed = JSON.parse(String(await one(
  `select public.fn_staff_file_complaint('Rate list purani hai','Aaj ki urea rate update nahi hui.','normal','/admin/fertilizer')::text`
)));
await run(reset);
assert.equal(filed.status, "new");
assert.equal(filed.assigned_to, null);
assert.equal(filed.department_id, null);
assert.equal(filed.intake_source, "staff");
assert.equal(await one(`select assigned_to::text from support_tickets where id = '${filed.id}'`), null);
assert.equal(await one(`select department_id::text from support_tickets where id = '${filed.id}'`), null);
assert.equal(await one(`select suggested_department from support_tickets where id = '${filed.id}'`), null);
assert.match(String(await one(`select note from support_ticket_events where ticket_id = '${filed.id}'`)), /Admin queue/);
pass("staff complaint lands unassigned in the admin queue");

await run(as(SALES));
const ownClose = await throws(
  `select public.fn_complaint_set_status('${filed.id}','resolved','maine khud band kar di')`
);
await run(reset);
assert.match(ownClose, /khud band nahi/);
pass("staff cannot close their own complaint");

await run(as(ADMIN));
const fwd = JSON.parse(String(await one(
  `select public.fn_complaint_forward('${ticket}', '${FIN}', 'accounts', null, null)::text`
)));
await run(reset);
assert.equal(fwd.assignee, "Accounts");
assert.equal(fwd.routed, "accounts");
assert.equal(await one(`select assigned_to::text from support_tickets where id = '${ticket}'`), FIN);
assert.equal(await one(`select status from cc_complaints where id = '${made.id}'`), "in_progress");
assert.equal(await one(`select count(*)::int from support_ticket_events where ticket_id = '${ticket}' and event_type = 'assignee'`), 1);
pass("admin forwards CMP to the accounts user and history is kept");

await run(as(AGENT));
const agentClose = await throws(`select public.fn_complaint_set_status('${ticket}','resolved','agent band')`);
await run(reset);
assert.match(agentClose, /band nahi/);
pass("call center agent cannot close");

await run(as(FIN));
const closed = JSON.parse(String(await one(
  `select public.fn_complaint_set_status('${ticket}','resolved','Bag ki entry theek kar di')::text`
)));
await run(reset);
assert.equal(closed.status, "resolved");
assert.equal(await one(`select status from cc_complaints where id = '${made.id}'`), "resolved");
assert.equal(await one(`select resolved_by::text from cc_complaints where id = '${made.id}'`), FIN);
assert.notEqual(await one(`select resolved_by::text from cc_complaints where id = '${made.id}'`), AGENT);
pass("assigned department user closes; maker is not the closer");

await run(as(ADMIN2));
const staffClosed = JSON.parse(String(await one(
  `select public.fn_complaint_set_status('${filed.id}','resolved','Rate update kar di')::text`
)));
await run(reset);
assert.equal(staffClosed.status, "resolved");
pass("a different admin can close a staff complaint");

await run(fs.readFileSync("supabase/migrations/626_complaint_support_bridge.rollback.sql", "utf8"));
const still = await one(`select count(*)::int from information_schema.columns where table_name = 'support_tickets' and column_name = 'intake_source'`);
assert.equal(Number(still), 0);
assert.equal(await one(`select count(*)::int from cc_complaints`), 1);
pass("rollback drops the bridge and keeps the complaint");

console.log(`\ncomplaint-bridge-sql: ${ok} checks pass`);
