// HR Meetings (600-603) -- asli Postgres 17 par RLS + trigger test.
// Sirf LOCAL cluster (default /tmp:54339). Live DB ko haath nahi lagata.
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const HOST = process.env.HRDB_PGHOST ?? "/tmp";
const PORT = process.env.HRDB_PGPORT ?? "54339";
const PSQL = process.env.PSQL ?? (fs.existsSync("/usr/lib/postgresql/17/bin/psql") ? "/usr/lib/postgresql/17/bin/psql" : "psql");
if (!(HOST.startsWith("/") || HOST === "localhost" || HOST === "127.0.0.1")) {
  console.error("Ye test sirf local Postgres par chalta hai."); process.exit(1);
}
const HR = "00000000-0000-0000-0000-00000000a001", S1 = "00000000-0000-0000-0000-00000000b001",
  S2 = "00000000-0000-0000-0000-00000000b002", M = "22222222-0000-0000-0000-000000000001",
  A = "33333333-0000-0000-0000-000000000001";
function psql(sql) {
  const r = spawnSync(PSQL, ["-h", HOST, "-p", PORT, "-U", "postgres", "-X", "-q", "-At", "-v", "ON_ERROR_STOP=1"], { input: sql, encoding: "utf8" });
  if (r.error) throw r.error;
  return { ok: r.status === 0, out: (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim() };
}
const seed = fs.readFileSync("tests/sql/hr-meetings-db-seed.sql", "utf8");
const asUser = (u) => `set local role authenticated; select set_config('request.jwt.claims', '{"sub":"${u}","role":"authenticated"}', true);`;
const run = (u, stmt, setup = "") => psql(`begin;\n${seed}\n${setup}\n\\o /dev/null\n${u === "anon" ? "set local role anon;" : asUser(u)}\n\\o\n${stmt};\nrollback;`);
let n = 0;
const ok = (name, u, stmt, check, setup) => { const r = run(u, stmt, setup); assert.ok(r.ok, `${name}: ${r.err}`); check?.(r.out); n++; console.log(`  ✓ ${name}`); };
const no = (name, u, stmt, setup) => { const r = run(u, stmt, setup); assert.ok(!r.ok || !r.out.includes("HIT"), `${name}: rukna chahiye tha`); n++; console.log(`  ✓ ${name} (ruka)`); };

for (const f of ["600_hr_meetings", "601_hr_meeting_outcomes", "602_hr_meeting_notifications", "603_hr_meetings_rls"]) {
  const r = psql(fs.readFileSync(`supabase/migrations/${f}.sql`, "utf8") + "\n" + fs.readFileSync(`supabase/migrations/${f}.sql`, "utf8"));
  assert.ok(r.ok, `${f} (2 dafa) nahi chali: ${r.err}`);
}
console.log("migrations 600-603: lag gayin (idempotent)");

console.log("Kaun dekh sakta hai:");
ok("HR sab meetings dekhta hai", HR, `select count(*) from hr_meetings where id='${M}'`, (o) => assert.equal(o, "1"));
ok("shamil staff apni meeting dekhta hai", S1, `select count(*) from hr_meetings where id='${M}'`, (o) => assert.equal(o, "1"));
ok("ghair-shamil staff ko meeting nazar nahi aati", S2, `select count(*) from hr_meetings`, (o) => assert.equal(o, "0"));
ok("ghair-shamil staff ko kaam nazar nahi aate", S2, `select count(*) from hr_meeting_action_items`, (o) => assert.equal(o, "0"));
no("anon kuch nahi parh sakta", "anon", `select 'HIT' from hr_meetings`);
console.log("Likhna:");
no("ghair-shamil staff meeting badal nahi sakta", S2, `update hr_meetings set title='Hack' where id='${M}' returning 'HIT'`);
no("shamil staff (organizer nahi) meeting badal nahi sakta", S1, `update hr_meetings set title='Hack' where id='${M}' returning 'HIT'`);
no("staff kisi aur ke naam se meeting nahi rakh sakta", S2, `insert into hr_meetings (title, starts_at, organizer_id) values ('Fake', now(), '${HR}') returning 'HIT'`);
ok("staff apni meeting khud rakh sakta hai", S2, `insert into hr_meetings (title, starts_at, organizer_id) values ('Apni meeting', now(), '${S2}') returning 'ok'`);
no("ghalat Meet link nahi lagta", HR, `update hr_meetings set meet_url='https://evil.com/x' where id='${M}' returning 'HIT'`);
console.log("Reschedule aur postpone ginti:");
ok("waqt badla to reschedule_count barha + record bana", HR,
  `update hr_meetings set starts_at = starts_at + interval '1 day' where id='${M}'; update hr_meetings set starts_at = starts_at + interval '1 day' where id='${M}';
   select reschedule_count || '/' || (select count(*) from hr_meeting_reschedules where meeting_id='${M}') || '/' || (select flag_rescheduled from v_hr_meeting_flags where meeting_id='${M}') from hr_meetings where id='${M}'`,
  (o) => assert.match(o, /2\/2\/(t|true)$/));
ok("reschedule_count app se ghatai nahi ja sakti", HR, `update hr_meetings set reschedule_count=0, starts_at=starts_at+interval '1 hour' where id='${M}'; select reschedule_count from hr_meetings where id='${M}'`, (o) => assert.match(o, /1$/));
ok("due date aage = postponed_count barha", HR, `update hr_meeting_action_items set due_date = due_date + 3 where id='${A}'; select postponed_count from hr_meeting_action_items where id='${A}'`, (o) => assert.match(o, /1$/));
ok("held meeting bina faisle = flag", HR, `update hr_meetings set status='held' where id='${M}'; select flag_no_decision from v_hr_meeting_flags where meeting_id='${M}'`, (o) => assert.match(o, /t$/));
ok("faisla likha to flag hat gaya", HR, `update hr_meetings set status='held' where id='${M}'; insert into hr_meeting_decisions (meeting_id, body) values ('${M}','Salary 1 Nov tak'); select flag_no_decision from v_hr_meeting_flags where meeting_id='${M}'`, (o) => assert.match(o, /f$/));
console.log("Kaam ka zimmedar:");
ok("zimmedar apna status 'done' kar sakta hai", S1, `update hr_meeting_action_items set status='done' where id='${A}' returning status, completed_at is not null`, (o) => assert.match(o, /done\|t/));
no("zimmedar apni due date khud aage nahi kar sakta", S1, `update hr_meeting_action_items set due_date = due_date + 7 where id='${A}' returning 'HIT'`);
no("ghair-shamil staff kaam band nahi kar sakta", S2, `update hr_meeting_action_items set status='done' where id='${A}' returning 'HIT'`);
console.log("Notifications (sirf app):");
ok("shamil staff ko invite notification mila", S1, `select count(*) from hr_notifications where kind='invited' and meeting_id='${M}'`, (o) => assert.equal(o, "1"));
ok("kaam ke zimmedar ko notification mila", S1, `select count(*) from hr_notifications where kind='action_assigned'`, (o) => assert.equal(o, "1"));
ok("reschedule par shamil staff ko notification", S1, `select count(*) from hr_notifications where kind='rescheduled'`, (o) => assert.equal(o, "1"),
  `update hr_meetings set starts_at = starts_at + interval '2 hour' where id='${M}';`);
ok("doosre ki notifications nazar nahi aatin", S2, `select count(*) from hr_notifications`, (o) => assert.equal(o, "0"));
no("staff khud notification nahi bana sakta", S2, `insert into hr_notifications (recipient_id, kind, title) values ('${S1}','invited','fake') returning 'HIT'`);
ok("apni notification read mark ho sakti hai", S1, `update hr_notifications set read_at=now() where recipient_id='${S1}' returning 'ok'`, (o) => assert.match(o, /ok/));
console.log("Rollback:");
{
  const rb = ["603_hr_meetings_rls", "602_hr_meeting_notifications", "601_hr_meeting_outcomes", "600_hr_meetings"].map((f) => fs.readFileSync(`supabase/rollbacks/${f}.rollback.sql`, "utf8")).join("\n");
  const r = psql(`begin;\n${rb}\nselect to_regclass('public.hr_meetings') is null;\nrollback;`);
  assert.ok(r.ok && r.out.endsWith("t"), `rollback: ${r.err}`); n++; console.log("  ✓ rollback 603->600 saaf chalti hai");
}
console.log(`\nhr-meetings-db: ${n} checks pass`);
