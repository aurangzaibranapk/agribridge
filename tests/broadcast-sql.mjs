// Real SQL test: 589/594/597/598/599 (Broadcast) PGlite par -- live DB nahi, koi paighaam nahi.
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const run = (s) => db.exec(s);
const one = async (s) => { try { return Object.values((await db.query(s)).rows[0] ?? {})[0]; } catch (e) { console.error("SQL:", s, e.message); throw e; } };
const reset = "reset role; select set_config('test.uid','',false);";
const as = (u) => `set role authenticated; select set_config('test.uid','${u}',false);`;
const throws = async (s, re, msg) => {
  let err = null;
  try { await run(s); } catch (e) { err = e; }
  await run(reset);
  assert.ok(err, `expected error: ${msg}`);
  if (re) assert.match(String(err.message), re, msg);
};
const FILES = ["589_broadcasts", "594_broadcast_recipients", "597_message_templates", "598_messaging_optouts", "599_broadcast_audit_rls"];
const mig = (f) => fs.readFileSync(`supabase/migrations/${f}.sql`, "utf8");
let ok = 0; const pass = (n) => { ok++; console.log(`  ok  ${n}`); };

for (const f of FILES) {
  const m = mig(f).replace(/--.*$/gm, "");
  assert.doesNotMatch(m, /\bdrop\s+table\b|\btruncate\b/i, f);
  assert.doesNotMatch(m, /\balter\s+table\s+public\.(?!(broadcasts|broadcast_recipients|broadcast_audit|message_templates|messaging_optouts|messaging_dnd)\b)/i, `${f}: only own new tables altered`);
  assert.doesNotMatch(m, /delete\s+from\s+(?!broadcast_recipients|messaging_optouts)/i, `${f}: deletes only on own tables`);
  assert.doesNotMatch(m, /net\.http|http_post|graph\.facebook/i, `${f}: no network from SQL`);
}
pass("additive only; no network from SQL; deletes only on own queue/opt-out rows");

await run(fs.readFileSync("tests/sql/broadcast-stubs.sql", "utf8"));
for (const f of FILES) await run(mig(f));
for (const f of FILES) await run(mig(f)); // dobara chalana mehfooz
pass("migrations apply twice (idempotent)");

const OWNER = "00000000-0000-0000-0000-0000000000a1", ADMIN = "00000000-0000-0000-0000-0000000000a2", MGR = "00000000-0000-0000-0000-0000000000a3", SALES = "00000000-0000-0000-0000-0000000000a4", FARMER = "00000000-0000-0000-0000-0000000000a5";
await run(`insert into profiles (id, role) values ('${OWNER}','owner'),('${ADMIN}','admin'),('${MGR}','manager'),('${SALES}','sales_staff'),('${FARMER}','farmer');`);
const T_OK = "00000000-0000-0000-0000-00000000e001", T_PEND = "00000000-0000-0000-0000-00000000e002";
await run(`${as(ADMIN)} insert into message_templates (id, name, lang, category, body, var_count, meta_status) values
  ('${T_OK}','general_notice','ur','UTILITY','Assalam {{1}}',1,'APPROVED'), ('${T_PEND}','season_booking','ur','MARKETING','{{1}} booking',1,'PENDING'); ${reset}`);
await throws(`${as(MGR)} insert into message_templates (name, category, body) values ('x','UTILITY','x')`, /row-level/, "manager cannot add templates");
pass("templates: only owner/admin can register");

// ---- create (maker) ----
const B1 = "00000000-0000-0000-0000-0000000b0001", B2 = "00000000-0000-0000-0000-0000000b0002", B3 = "00000000-0000-0000-0000-0000000b0003", B4 = "00000000-0000-0000-0000-0000000b0004";
await throws(`${as(SALES)} insert into broadcasts (title, audience_role, channel, sms_body) values ('Notice x','farmers','sms','{"rm":"x"}')`, /row-level/, "sales staff cannot create");
await throws(`${as(MGR)} insert into broadcasts (title, audience_role, channel, sms_body, status) values ('Notice x','farmers','sms','{"rm":"x"}','approved')`, /row-level/, "cannot insert as approved");
await throws(`${as(MGR)} insert into broadcasts (title, audience_role, channel, sms_body) values ('Notice x','farmers','whatsapp','{}')`, /wa_needs_template/, "WhatsApp needs a template");
await run(`${as(MGR)} insert into broadcasts (id, title, audience_role, channel, template_id, template_vars, sms_body) values
  ('${B1}','Gandum seed','farmers','both','${T_PEND}','["naam"]','{"rm":"Assalam {naam}"}'); ${reset}`);
await run(`${as(OWNER)} insert into broadcasts (id, title, audience_role, channel, sms_body) values ('${B2}','Eid notice','all','sms','{"rm":"Eid mubarak {naam}"}'); ${reset}`);
pass("create: owner/admin/manager draft only; sales/farmer blocked; WA needs template");

// ---- opt-out / DND ----
await run(`select fn_messaging_keyword('923000000003','STOP','whatsapp'); select fn_messaging_keyword('923000000009','Band karo!','sms');`);
await run(`insert into messaging_dnd (phone, reason) values ('923000000004','asked by phone')`);
assert.equal(await one(`select fn_messaging_keyword('923000000005','hello')`), null);
assert.equal(await one(`select count(*)::int from messaging_optouts`), 2);
await throws(`${as(MGR)} select fn_messaging_keyword('923000000006','STOP')`, /permission denied/, "app user cannot call keyword fn");
pass("STOP / 'band karo' recorded; normal text ignored; only service can call");

const R = (n, extra = "") => `{"party_type":"farmer","name":"F${n}","phone":"92300000000${n}","lang":"rm","vars":{"naam":"F${n}"}${extra}}`;
const LIST = `[${[1, 2, 3, 4].map((n) => R(n)).join(",")},{"party_type":"custom","name":"bad","phone":"0300-1"}]`;
await throws(`${as(OWNER)} select broadcast_submit('${B1}','${LIST}')`, /Sirf banane wala/, "only creator submits");
await run(`${as(MGR)} select broadcast_submit('${B1}','${LIST}', 0.06); ${reset}`);
assert.equal(await one(`select status from broadcasts where id='${B1}'`), "pending_approval");
assert.equal(await one(`select recipient_count from broadcasts where id='${B1}'`), 2);
assert.equal(await one(`select count(*)::int from broadcast_recipients where broadcast_id='${B1}' and status='skipped_optout'`), 2);
assert.equal(await one(`select count(*)::int from broadcast_recipients where broadcast_id='${B1}' and phone like '%0300%'`), 0);
pass("submit freezes list; STOP + DND numbers excluded; invalid number dropped");

// ---- edits after submit ----
await run(`${as(MGR)} update broadcasts set sms_body='{"rm":"changed"}' where id='${B1}'; ${reset}`);
assert.equal(await one(`select sms_body->>'rm' from broadcasts where id='${B1}'`), "Assalam {naam}");
await run(`${as(MGR)} update broadcasts set status='approved', approved_by='${OWNER}' where id='${B1}'; ${reset}`); // RLS: 0 rows
assert.equal(await one(`select status from broadcasts where id='${B1}'`), "pending_approval");
await throws(`update broadcasts set sms_body='{"rm":"svc edit"}' where id='${B1}'`, /Submit ke baad/, "even service cannot edit after submit");
pass("after submit: creator edits ignored by RLS, content locked by trigger");

// ---- maker-checker ----
await throws(`${as(MGR)} select broadcast_approve('${B1}')`, /owner\/admin/, "manager cannot approve");
await throws(`${as(OWNER)} select broadcast_approve('${B1}')`, /Meta-APPROVED/, "WhatsApp template still PENDING");
await run(`update message_templates set meta_status='APPROVED' where id='${T_PEND}'`);
await throws(`${as(FARMER)} select broadcast_approve('${B1}')`, /owner\/admin/, "farmer cannot approve");
await run(`${as(OWNER)} select broadcast_approve('${B1}'); ${reset}`);
assert.equal(await one(`select approved_by::text from broadcasts where id='${B1}'`), OWNER);
await run(`${as(OWNER)} select broadcast_submit('${B2}','[${R(5)},${R(6)}]'); ${reset}`);
await throws(`${as(OWNER)} select broadcast_approve('${B2}')`, /khud manzoor/, "owner cannot approve own");
await throws(`update broadcasts set status='approved', approved_by='${OWNER}' where id='${B2}'`, /khud manzoor|no_self_approval/, "self approval blocked even for service role");
await throws(`update broadcasts set status='approved', approved_by='${MGR}' where id='${B2}'`, /owner\/admin/, "manager id as approver blocked in trigger");
await throws(`${as(ADMIN)} select broadcast_reject('${B2}','  ')`, /wajah/, "reject needs reason");
await run(`${as(ADMIN)} select broadcast_approve('${B2}'); ${reset}`);
pass("maker-checker: creator never approves own; only owner/admin; template must be APPROVED; reject needs reason");

// ---- status path ----
await throws(`update broadcasts set status='draft' where id='${B2}'`, /nahi ho sakta/, "approved -> draft not allowed");
await run(`${as(MGR)} insert into broadcasts (id, title, audience_role, channel, sms_body, schedule_at) values ('${B3}','Later','farmers','sms','{"rm":"x"}', now() + interval '2 days'); select broadcast_submit('${B3}','[${R(7)}]'); ${reset}`);
await run(`${as(ADMIN)} select broadcast_approve('${B3}'); ${reset}`);
await run(`${as(MGR)} insert into broadcasts (id, title, audience_role, channel, sms_body) values ('${B4}','Pending one','staff','sms','{"rm":"x"}'); select broadcast_submit('${B4}','[${R(8)}]'); ${reset}`);
const r8 = await one(`select id::text from broadcast_recipients where broadcast_id='${B4}'`);
await throws(`update broadcast_recipients set status='sent' where id='${r8}'`, /Bina manzoori/, "cannot mark sent before approval");
pass("status transitions guarded; unapproved recipients can never be marked sent");

// ---- worker ----
await throws(`${as(ADMIN)} select * from broadcast_claim_batch(10)`, /permission denied/, "app users cannot run the worker");
await throws(`${as(ADMIN)} select broadcast_mark('${r8}','sent','x','y')`, /permission denied/, "app users cannot mark");
await run(`select fn_messaging_keyword('923000000002','stop')`); // beech mein STOP
const batch = (await db.query(`select * from broadcast_claim_batch(10)`)).rows;
assert.deepEqual(batch.map((r) => r.phone).sort(), ["923000000001", "923000000005", "923000000006"]);
assert.equal(await one(`select status from broadcast_recipients where broadcast_id='${B1}' and phone='923000000002'`), "skipped_optout");
assert.equal(await one(`select status from broadcasts where id='${B3}'`), "approved", "future schedule not started");
assert.equal(await one(`select status from broadcasts where id='${B4}'`), "pending_approval");
assert.equal((await db.query(`select * from broadcast_claim_batch(1)`)).rows.length, 1, "limit respected");
pass("worker: only approved + due; mid-run STOP skipped; scheduled later waits; batch limit respected");

const wa1 = batch.find((r) => r.phone === "923000000001");
await run(`select broadcast_mark('${wa1.id}','failed','whatsapp',null,'not on whatsapp')`);
assert.equal(await one(`select count(*)::int from broadcast_recipients where broadcast_id='${B1}' and channel='sms' and status='queued'`), 1, "fallback SMS queued");
for (const r of (await db.query(`select * from broadcast_claim_batch(10)`)).rows) await run(`select broadcast_mark('${r.id}','sent','${r.channel}','m-${r.phone}-${r.channel}')`);
assert.equal(await one(`select status from broadcasts where id='${B1}'`), "done");
assert.equal(await one(`select status from broadcasts where id='${B2}'`), "done");
await run(`select broadcast_status_update('m-923000000005-sms','delivered'); select broadcast_status_update('m-923000000005-sms','read');`);
assert.equal(await one(`select status from broadcast_recipients where provider_msg_id='m-923000000005-sms'`), "read");
// der se aaya WhatsApp "failed" (done ke baad) -> SMS fallback aur elaan dobara "sending"
const B5 = "00000000-0000-0000-0000-0000000b0005";
await run(`${as(MGR)} insert into broadcasts (id, title, audience_role, channel, template_id, template_vars, sms_body) values ('${B5}','Late fail','farmers','both','${T_OK}','["naam"]','{"rm":"x"}'); select broadcast_submit('${B5}','[${R(7).replace("0000007", "0000077")}]'); ${reset}`);
await run(`${as(ADMIN)} select broadcast_approve('${B5}'); ${reset}`);
for (const r of (await db.query(`select * from broadcast_claim_batch(10)`)).rows) await run(`select broadcast_mark('${r.id}','sent','whatsapp','late-1')`);
assert.equal(await one(`select status from broadcasts where id='${B5}'`), "done");
await run(`select broadcast_status_update('late-1','failed','Undeliverable')`);
assert.equal(await one(`select status from broadcasts where id='${B5}'`), "sending");
assert.equal(await one(`select count(*)::int from broadcast_recipients where broadcast_id='${B5}' and channel='sms' and status='queued'`), 1);
pass("WhatsApp fail -> SMS fallback (channel both); done when queue empty; delivered/read from webhook");

// ---- audit ----
assert.ok(Number(await one(`select count(*) from broadcast_audit where broadcast_id='${B1}'`)) >= 3);
await throws(`delete from broadcast_audit`, /append-only/, "audit cannot be deleted");
await throws(`update broadcast_audit set action='x'`, /append-only/, "audit cannot be edited");
await run(as(SALES)); assert.equal(await one(`select count(*)::int from broadcasts`), 0); await run(reset);
await run(as(MGR)); assert.equal(await one(`select count(*)::int from broadcasts`), 4); await run(reset);
pass("audit append-only; RLS: sales staff sees none, manager sees only own");
assert.equal(await one(`select count(*)::int from features where key='broadcast' and route='/admin/broadcast'`), 1);
pass("sidebar feature row");
console.log(`\nbroadcast-sql: ${ok} passed`);
