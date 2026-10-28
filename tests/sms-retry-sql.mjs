// 628 SMS retry columns. PGlite. Live database nahi.
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const run = (s) => db.exec(s);
const one = async (s) => Object.values((await db.query(s)).rows[0] ?? {})[0];
const file = fs.readFileSync("supabase/migrations/628_sms_retry.sql", "utf8");
const rollback = fs.readFileSync("supabase/migrations/628_sms_retry.rollback.sql", "utf8");

assert.doesNotMatch(file + rollback, /hwaiuwxqldxsoukkfefn/);
assert.doesNotMatch(file, /\bdelete\s+from\b/i);
assert.doesNotMatch(file, /whatsapp_send|net\.http/i);
assert.match(file, /attempts/);
assert.match(file, /next_attempt_at/);
assert.match(file, /fn_cc_take_sms/);
console.log("  ok  628 file: additive, no deletes, no testing project");

await run(fs.readFileSync("tests/sql/call-center-stubs.sql", "utf8"));
await run(fs.readFileSync("supabase/migrations/624_call_center_role.sql", "utf8"));
await run(fs.readFileSync("supabase/migrations/625_call_center.sql", "utf8"));
await run(file);
await run(file);
console.log("  ok  628 applies twice");

const cols = (await db.query(`select column_name from information_schema.columns where table_name = 'cc_sms_outbox'`)).rows.map((r) => r.column_name);
assert.ok(cols.includes("attempts"));
assert.ok(cols.includes("next_attempt_at"));

const org = "11111111-1111-1111-1111-111111111111";
await run(`insert into public.organizations (id) values ('${org}')`);
await run(`
  insert into public.cc_sms_outbox (organization_id, to_phone, body, channel, status)
  values ('${org}', '03001234567', 'test', 'sms', 'queued')
`);
const id = await one(`select id from public.cc_sms_outbox`);

await run("set role service_role");
const taken = (await db.query(`select id::text, attempts from public.fn_cc_take_sms(5)`)).rows;
assert.equal(taken.length, 1);
assert.equal(taken[0].id, id);
assert.equal(Number(taken[0].attempts), 0);
const again = (await db.query(`select id from public.fn_cc_take_sms(5)`)).rows;
assert.equal(again.length, 0);
await run("reset role");
const leased = await one(`select next_attempt_at is not null from public.cc_sms_outbox where id = '${id}'`);
assert.equal(leased, true);

await run(`update public.cc_sms_outbox set attempts = 3, next_attempt_at = now() - interval '1 minute' where id = '${id}'`);
await run("set role service_role");
const over = (await db.query(`select id from public.fn_cc_take_sms(5)`)).rows;
assert.equal(over.length, 0);
await run("reset role");

await run("set role authenticated");
let denied = false;
try { await run(`select * from public.fn_cc_take_sms(1)`); } catch { denied = true; }
await run("reset role");
assert.equal(denied, true);
console.log("  ok  take leases due rows, skips the third attempt, staff cannot call it");

await run(rollback);
const left = (await db.query(`select column_name from information_schema.columns where table_name = 'cc_sms_outbox' and column_name = 'attempts'`)).rows;
assert.equal(left.length, 0);
console.log("  ok  rollback drops the retry columns");
console.log("\nsms-retry-sql: pass");
