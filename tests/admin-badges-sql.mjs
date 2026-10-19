// Real SQL test: 582 (admin pending badges) PGlite par -- live DB nahi.
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const run = (s) => db.exec(s);
const q = async (s) => (await db.query(s)).rows;
const one = async (s) => Object.values((await db.query(s)).rows[0] ?? {})[0];
const reset = "reset role; select set_config('test.uid','',false);";
const as = (u) => `set role authenticated; select set_config('test.uid','${u}',false);`;
const asQ = async (u, s) => { await run(as(u)); try { return await q(s); } finally { await run(reset); } };
const throws = async (s, msg) => {
  let err = null;
  try { await run(s); } catch (e) { err = e; }
  await run(reset);
  assert.ok(err, `expected error: ${msg}`);
};
let ok = 0; const pass = (n) => { ok++; console.log(`  ok  ${n}`); };

await run(fs.readFileSync("tests/sql/admin-badges-stubs.sql", "utf8"));
const M = fs.readFileSync("supabase/migrations/582_admin_pending_badges.sql", "utf8");
await run(M); await run(M); // idempotent

// --- additive, invoker, no sends
assert.doesNotMatch(M, /\bdrop\s+(table|column|function|view)\b|\btruncate\b|\bdelete\s+from\b/i);
assert.doesNotMatch(M, /\balter\s+table\s+(?!(public\.)?admin_pending_seen\b)/i);
assert.doesNotMatch(M, /whatsapp_send|net\.http|pg_net|send_email|insert\s+into\s+public\.notifications/i);
for (const f of ["fn_admin_pending_counts", "fn_admin_pending_items", "fn_admin_pending_mark_seen", "fn_admin_pending_sources", "fn_admin_pending_scope"]) {
  assert.equal(await one(`select prosecdef from pg_proc where proname='${f}'`), false, `${f} must be SECURITY INVOKER`);
}
assert.equal(await one(`select provolatile from pg_proc where proname='fn_admin_pending_counts'`), "s");
assert.equal(await one(`select count(*)::int from (select key from fn_admin_pending_sources() group by key having count(*)>1) d`), 0, "unique keys");
pass("582 additive, security invoker, unique category keys, no sends");

// --- data
const B1 = "00000000-0000-0000-0000-0000000000b1", B2 = "00000000-0000-0000-0000-0000000000b2";
const OWN = "00000000-0000-0000-0000-0000000000a1", ADM = "00000000-0000-0000-0000-0000000000a2";
const MGR = "00000000-0000-0000-0000-0000000000a3", ANW = "00000000-0000-0000-0000-0000000000a4";
const FRM = "00000000-0000-0000-0000-0000000000a5";
await run(`
insert into profiles values ('${OWN}','owner',null,'Owner'),('${ADM}','admin',null,'Admin'),
  ('${MGR}','manager','${B1}','Manager B1'),('${ANW}','sales_staff','${B1}','Anwar'),('${FRM}','farmer',null,'Kisan');
insert into pos_returns (return_number, branch_id, total_amount, created_by, admin_review_status, created_at) values
  ('RET-1','${B1}',100,'${ANW}','pending', now() - interval '15 days'),
  ('RET-2','${B1}',50,'${ADM}','pending', now() - interval '2 hours'),
  ('RET-3','${B2}',70,'${ANW}','pending', now() - interval '3 days'),
  ('RET-4','${B1}',999,'${ANW}','approved', now());
insert into leave_requests (profile_id, manager_id, leave_type, status) values ('${ANW}','${MGR}','casual','pending'),('${ANW}','${MGR}','casual','approved');
insert into data_health_findings (title, amount, status) values ('x',1,'open'),('y',2,'open'),('z',3,'resolved');
`);
const counts = async (u) => Object.fromEntries((await asQ(u, "select * from fn_admin_pending_counts()")).map((r) => [r.category, r]));

// owner: sab dekhta hai
let c = await counts(OWN);
assert.equal(c.pos_returns.pending, 3);
assert.equal(Number(c.pos_returns.amount), 220);
assert.equal(c.pos_returns.readable, true);
assert.equal(c.pos_returns.naya, 1, "sirf 24 ghante wali, aur jo apni nahi");
assert.equal(c.pos_returns.mine_to_act, 3);
assert.ok(new Date(c.pos_returns.oldest_at) < new Date(Date.now() - 14 * 864e5), "oldest age");
assert.equal(c.pos_returns.pending_with, "admin_owner");
assert.equal(c.leave.pending, 1);
assert.equal(c.data_health.pending, 2); assert.equal(c.data_health.is_info, true);
pass("owner: counts, amount, oldest age, naya (last 24h), responsible role, data-health is_info");

// maker-checker: admin ki apni entry na "naya" na "mine_to_act"
c = await counts(ADM);
assert.equal(c.pos_returns.pending, 3);
assert.equal(c.pos_returns.mine_to_act, 2, "apni RET-2 apne zimme nahi");
assert.equal(c.pos_returns.naya, 0, "apni entry naya nahi");
pass("own entries excluded from naya + mine_to_act (auth.uid())");

// missing table -> readable=false, not zero
assert.equal(c.expenses.readable, false); assert.equal(c.expenses.pending, null);
assert.equal(c.support_tickets.readable, false);
pass("missing/unreadable source -> readable=false (not 0)");

// branch scoping: manager B1 sirf B1
c = await counts(MGR);
assert.equal(c.pos_returns.pending, 2, "B2 wali RET-3 nahi");
assert.equal(c.leave.pending, 1);
// farmer: RLS -> 0 pos returns
c = await counts(FRM);
assert.equal(c.pos_returns.pending, 0);
assert.equal(c.leave.pending, 0);
pass("branch scoping for branch staff + RLS respected (farmer sees 0)");

// items: is_own + is_new + names
let it = await asQ(ADM, "select * from fn_admin_pending_items(50, 'pos_returns')");
assert.equal(it.length, 3);
assert.deepEqual(it.map((r) => r.ref), ["RET-1", "RET-3", "RET-2"], "oldest first");
const r2 = it.find((r) => r.ref === "RET-2");
assert.equal(r2.is_own, true); assert.equal(r2.is_new, false);
const r1 = it.find((r) => r.ref === "RET-1");
assert.equal(r1.is_own, false); assert.equal(r1.entered_by_name, "Anwar");
it = await asQ(OWN, "select * from fn_admin_pending_items(50, 'pos_returns')");
assert.equal(it.find((r) => r.ref === "RET-2").is_new, true);
assert.equal(it.find((r) => r.ref === "RET-2").is_own, false);
it = await asQ(OWN, "select * from fn_admin_pending_items(50, 'leave')");
assert.equal(it[0].actor_name, "Manager B1");
it = await asQ(MGR, "select * from fn_admin_pending_items(50, null)");
assert.equal(it.filter((r) => r.category === "pos_returns").length, 2);
assert.equal(it.filter((r) => r.category === "data_health").length, 0, "info not in items");
pass("items: oldest first, is_own by auth.uid(), is_new, entered by / actor names, branch scope");

// mark seen -> naya clears, pending stays
assert.equal((await asQ(OWN, "select fn_admin_pending_mark_seen(array['pos_returns','bogus'])"))[0].fn_admin_pending_mark_seen, 1);
c = await counts(OWN);
assert.equal(c.pos_returns.naya, 0); assert.equal(c.pos_returns.pending, 3);
assert.ok(c.pos_returns.seen_until);
pass("mark_seen: naya clears, pending stays; unknown category ignored");

// reads RLS: sirf apni qatarein
assert.equal((await asQ(ADM, "select count(*)::int n from admin_pending_seen"))[0].n, 0, "admin can't see owner's rows");
await throws(`${as(ADM)} insert into admin_pending_seen values ('${OWN}','pos_returns', now())`, "insert for other user");
await run(as(ADM)); await run(`update admin_pending_seen set seen_until = now() - interval '9 days' where profile_id='${OWN}'`); await run(reset);
await run(as(ADM)); await run(`delete from admin_pending_seen where profile_id='${OWN}'`); await run(reset);
assert.equal(await one(`select count(*)::int from admin_pending_seen where profile_id='${OWN}'`), 1, "other's row untouched");
await throws(`set role anon; select * from fn_admin_pending_counts()`, "anon blocked");
pass("admin_pending_seen RLS: own rows only; anon cannot call");

// no uid -> nothing
assert.equal((await q("select count(*)::int n from fn_admin_pending_counts()"))[0].n, 0);
pass("no auth.uid -> empty");

console.log(`admin-badges-sql: ${ok} checks passed`);
