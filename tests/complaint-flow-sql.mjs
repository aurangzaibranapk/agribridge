// 627 — manager grant, stages, private attachment rules. Live database nahi.
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

const file = fs.readFileSync("supabase/migrations/627_complaint_stages_grants.sql", "utf8");
assert.doesNotMatch(file, /hwaiuwxqldxsoukkfefn/);
assert.doesNotMatch(file, /net\.http|pg_net|whatsapp_send|send_whatsapp/i);
assert.doesNotMatch(file, /\bdelete\s+from\b/i);
assert.match(file, /Forwarded by Manager/);
assert.match(file, /cc_assign_grants/);
assert.match(file, /complaint_stage/);
pass("627 file: additive, no SMS send, no testing project");

await run(fs.readFileSync("tests/sql/call-center-stubs.sql", "utf8"));
await run(fs.readFileSync("tests/sql/complaint-bridge-stub.sql", "utf8"));
await run(fs.readFileSync("supabase/migrations/624_call_center_role.sql", "utf8"));
await run(fs.readFileSync("supabase/migrations/625_call_center.sql", "utf8"));
await run(fs.readFileSync("supabase/migrations/626_complaint_support_bridge.sql", "utf8"));
await run(file);
await run(file);
pass("624+625+626+627 apply twice");

const ORG = "00000000-0000-0000-0000-0000000000aa";
const ADMIN = "00000000-0000-0000-0000-0000000000a1";
const ADMIN2 = "00000000-0000-0000-0000-0000000000a6";
const AGENT = "00000000-0000-0000-0000-0000000000a2";
const FIN = "00000000-0000-0000-0000-0000000000a3";
const SALES = "00000000-0000-0000-0000-0000000000a4";
const MGR = "00000000-0000-0000-0000-0000000000a7";
const OWNER = "00000000-0000-0000-0000-0000000000a8";
const OTHER = "00000000-0000-0000-0000-0000000000a9";
const FARMER = "00000000-0000-0000-0000-0000000000f1";

await run(`
  insert into organizations values ('${ORG}');
  insert into profiles (id, role, full_name, is_active, organization_id) values
    ('${ADMIN}','admin','Admin One',true,'${ORG}'),
    ('${ADMIN2}','admin','Admin Two',true,'${ORG}'),
    ('${AGENT}','admin','Sana Agent',true,'${ORG}'),
    ('${FIN}','finance','Imran Ali',true,'${ORG}'),
    ('${SALES}','sales_staff','Imran Staff',true,'${ORG}'),
    ('${MGR}','manager','Kamran Raza',true,'${ORG}'),
    ('${OWNER}','owner','Malik Owner',true,'${ORG}'),
    ('${OTHER}','sales_staff','Nadeem',true,'${ORG}');
  insert into farmers (id, full_name, phone_number, farmer_code, village, organization_id) values
    ('${FARMER}','Muhammad Aslam','03221234576','FRM-000045','Chak 45 GB','${ORG}');
`);

await run(as(SALES));
const filed = JSON.parse(String(await one(
  `select public.fn_staff_file_complaint('Rate list purani hai','Aaj ki urea rate update nahi hui.','normal','/admin/fertilizer')::text`
)));
await run(reset);
assert.equal(filed.complaint_stage, "received");
assert.equal(await one(`select stage_percent from support_tickets where id = '${filed.id}'`), 10);
assert.equal(await one(`select assigned_to::text from support_tickets where id = '${filed.id}'`), null);
assert.equal(await one(`select count(*) from cc_assign_grants where profile_id = '${MGR}' and active`), 0);
pass("new staff complaint is Received and the manager grant is off");

await run(as(MGR));
const denied = await throws(`select public.fn_complaint_forward('${filed.id}', '${FIN}', 'sales', null, null)`);
await run(reset);
assert.match(denied, /Sirf Admin assign/);
pass("manager without permission cannot assign");

await run(as(MGR));
const notOwner = await throws(`select public.fn_cc_set_assign_grant('${MGR}', true)`);
await run(reset);
assert.match(notOwner, /Owner ya Admin/);
await run(as(OWNER));
const badTarget = await throws(`select public.fn_cc_set_assign_grant('${SALES}', true)`);
await run(reset);
assert.match(badTarget, /sirf Manager/);
await run(as(ADMIN));
await run(`select public.fn_cc_set_assign_grant('${MGR}', true)`);
await run(reset);
assert.equal(await one(`select active from cc_assign_grants where profile_id = '${MGR}'`), true);
pass("only owner or admin can turn the manager grant on");

const smsBefore = Number(await one(`select count(*) from cc_sms_outbox`));
await run(as(MGR));
const forwarded = JSON.parse(String(await one(
  `select public.fn_complaint_forward('${filed.id}', '${FIN}', 'sales', null, null)::text`
)));
await run(reset);
assert.match(forwarded.label, /Forwarded by Manager Kamran Raza/);
assert.equal(await one(`select manager_forward_label from support_tickets where id = '${filed.id}'`), "Forwarded by Manager Kamran Raza");
assert.match(String(await one(`select note from support_ticket_events where ticket_id = '${filed.id}' and note like 'Forwarded by Manager%'`)), /Forwarded by Manager Kamran Raza/);
assert.equal(await one(`select complaint_stage from support_tickets where id = '${filed.id}'`), "assigned");
assert.equal(await one(`select assigned_to::text from support_tickets where id = '${filed.id}'`), FIN);
pass("manager with permission can forward, and the event names them");

await run(as(ADMIN));
await run(`select public.fn_complaint_forward('${filed.id}', '${ADMIN2}', 'sales', null, null)`);
await run(reset);
assert.equal(await one(`select assigned_to::text from support_tickets where id = '${filed.id}'`), ADMIN2);
assert.equal(await one(`select manager_forward_label from support_tickets where id = '${filed.id}'`), "Forwarded by Manager Kamran Raza");
await run(as(ADMIN));
const seen = await one(`select public.fn_complaint_forward_label('${filed.id}')`);
await run(reset);
assert.equal(seen, "Forwarded by Manager Kamran Raza");
await run(as(OTHER));
assert.equal(await one(`select public.fn_complaint_can_see('${filed.id}')`), false);
const hidden = await throws(`select public.fn_complaint_forward_label('${filed.id}')`);
assert.match(hidden, /Ijazat nahi/);
await run(as(SALES));
assert.equal(await one(`select public.fn_complaint_can_see('${filed.id}')`), true);
await run(reset);
pass("admin sees the manager forward and can reassign; a stranger cannot");

await run(as(ADMIN));
await run(`select public.fn_complaint_forward('${filed.id}', '${FIN}', 'sales', null, null)`);
await run(reset);
await run(as(FIN));
const early = await throws(`select public.fn_complaint_set_stage('${filed.id}', 'completed', 'jaldi')`);
assert.match(early, /Pehle Check/);
await run(as(FIN));
await run(`select public.fn_complaint_set_stage('${filed.id}', 'in_progress', 'Rate sheet khol li.')`);
await run(`select public.fn_complaint_set_stage('${filed.id}', 'review', 'Check ke liye.')`);
await run(reset);
assert.equal(await one(`select complaint_stage from support_tickets where id = '${filed.id}'`), "review");
assert.equal(await one(`select stage_percent from support_tickets where id = '${filed.id}'`), 80);
await run(as(SALES));
const maker = await throws(`select public.fn_complaint_set_stage('${filed.id}', 'completed', 'khud')`);
await run(reset);
assert.match(maker, /khud band nahi/);
await run(as(ADMIN));
await run(`select public.fn_cc_register_agent('${AGENT}','03331234541','Sana Iqbal')`);
await run(reset);
await run(as(AGENT));
const agentBlock = await throws(`select public.fn_complaint_set_stage('${filed.id}', 'completed', 'agent')`);
await run(reset);
assert.match(agentBlock, /Call Center Agent/);
const smsAfterMoves = Number(await one(`select count(*) from cc_sms_outbox`));
assert.equal(smsAfterMoves, smsBefore);
await run(as(ADMIN2));
await run(`select public.fn_complaint_set_stage('${filed.id}', 'completed', 'Theek ho gaya.')`);
await run(reset);
assert.equal(await one(`select complaint_stage from support_tickets where id = '${filed.id}'`), "completed");
assert.equal(await one(`select status from support_tickets where id = '${filed.id}'`), "resolved");
pass("assignee walks the stages, maker cannot close, stage change sends no SMS");

const ticket = filed.id;
await run(`
  insert into support_ticket_attachments (ticket_id, organization_id, uploaded_by, storage_path, mime, size_bytes)
  values ('${ticket}', '${ORG}', '${SALES}', 'a.png', 'image/png', 1200);
`);
const badMime = await throws(`
  insert into support_ticket_attachments (ticket_id, organization_id, uploaded_by, storage_path, mime, size_bytes)
  values ('${ticket}', '${ORG}', '${SALES}', 'a.pdf', 'application/pdf', 1200);
`);
assert.match(badMime, /mime|check/i);
const tooBig = await throws(`
  insert into support_ticket_attachments (ticket_id, organization_id, uploaded_by, storage_path, mime, size_bytes)
  values ('${ticket}', '${ORG}', '${SALES}', 'big.png', 'image/png', 8388609);
`);
assert.match(tooBig, /size|check/i);
for (let i = 0; i < 5; i++) {
  await run(`insert into support_ticket_attachments (ticket_id, organization_id, uploaded_by, storage_path, mime, size_bytes)
    values ('${ticket}', '${ORG}', '${SALES}', 'p${i}.png', 'image/png', 100)`);
}
const seventh = await throws(`insert into support_ticket_attachments (ticket_id, organization_id, uploaded_by, storage_path, mime, size_bytes)
  values ('${ticket}', '${ORG}', '${SALES}', 'p6.png', 'image/png', 100)`);
assert.match(seventh, /6 images/);
pass("images are typed, sized, and capped at six");

await run(as(ADMIN));
await run(`select public.fn_cc_set_assign_grant('${MGR}', false)`);
await run(reset);
await run(as(SALES));
const again = JSON.parse(String(await one(
  `select public.fn_staff_file_complaint('Doosri shikayat','Ye bhi admin ke paas jaye.','normal',null)::text`
)));
await run(reset);
await run(as(MGR));
const off = await throws(`select public.fn_complaint_forward('${again.id}', '${FIN}', 'general', null, null)`);
await run(reset);
assert.match(off, /Sirf Admin assign/);
pass("turning the grant off stops the manager again");

const kept = await one(`select count(*) from support_tickets where id = '${filed.id}'`);
await run(fs.readFileSync("supabase/migrations/627_complaint_stages_grants.rollback.sql", "utf8"));
assert.equal(await one(`select count(*) from support_tickets where id = '${filed.id}'`), kept);
const gone = await throws(`select complaint_stage from support_tickets limit 1`);
assert.match(gone, /complaint_stage/);
pass("rollback drops the stage column and keeps the complaint");

console.log(`\ncomplaint-flow-sql: ${ok} checks pass`);
