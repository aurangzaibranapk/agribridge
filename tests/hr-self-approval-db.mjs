// HR audit (S1, S2, S3, S4, B1) -- asli Postgres 17 par RLS + trigger test.
// Sirf LOCAL cluster (default /tmp:54339, /workspace/localsb/rebuild-hrdb.sh se bana).
// Live DB ko kabhi haath nahi lagata: host socket/localhost ke ilawa koi
// host diya jaye to test ruk jata hai.
//
//   NODE_OPTIONS=-r /workspace/localsb/localenv.cjs npm run test:hr-self-approval-db
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const HOST = process.env.HRDB_PGHOST ?? "/tmp";
const PORT = process.env.HRDB_PGPORT ?? "54339";
const PSQL = process.env.PSQL ?? (fs.existsSync("/usr/lib/postgresql/17/bin/psql") ? "/usr/lib/postgresql/17/bin/psql" : "psql");
if (!(HOST.startsWith("/") || HOST === "localhost" || HOST === "127.0.0.1")) {
  console.error("Ye test sirf local Postgres par chalta hai."); process.exit(1);
}

const HR = "00000000-0000-0000-0000-00000000a001", ADMIN = "00000000-0000-0000-0000-00000000a002",
  ADMIN2 = "00000000-0000-0000-0000-00000000a003", STAFF = "00000000-0000-0000-0000-00000000b001";

function psql(sql) {
  const r = spawnSync(PSQL, ["-h", HOST, "-p", PORT, "-U", "postgres", "-X", "-q", "-At", "-v", "ON_ERROR_STOP=1"], { input: sql, encoding: "utf8" });
  if (r.error) throw r.error;
  return { ok: r.status === 0, out: (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim() };
}
const seed = fs.readFileSync("tests/sql/hr-self-approval-db-seed.sql", "utf8");
const asUser = (uid) => `set local role authenticated; select set_config('request.jwt.claims', '{"sub":"${uid}","role":"authenticated"}', true);`;
const asService = `set local role service_role; select set_config('request.jwt.claims', '{"role":"service_role"}', true);`;
// Har case: seed -> (setup as postgres) -> user ke taur par statement -> ROLLBACK
function run(uid, stmt, setup = "") {
  const who = uid === "service" ? asService : asUser(uid);
  return psql(`begin;\n${seed}\n${setup}\n${who}\n\\o /dev/null\nselect 1;\n\\o\n${stmt};\nrollback;`);
}
let n = 0;
function allowed(name, uid, stmt, setup, check) {
  const r = run(uid, stmt, setup);
  assert.ok(r.ok, `${name}: chalna chahiye tha -- ${r.err}`);
  if (check) check(r.out);
  n++; console.log(`  ✓ ${name}`);
}
function blocked(name, uid, stmt, setup, re) {
  const r = run(uid, stmt, setup);
  assert.ok(!r.ok, `${name}: rukna chahiye tha, magar chal gaya`);
  if (re) assert.match(r.err, re, `${name}: ghalat wajah -- ${r.err}`);
  n++; console.log(`  ✓ ${name} (ruka)`);
}
// RLS kabhi error ke bajaye 0 qatar deta hai -- us ko bhi "ruka" ginte hain.
function noRows(name, uid, stmt, setup) {
  const r = run(uid, `${stmt} returning 'HIT'`, setup);
  assert.ok(!r.ok || !r.out.includes("HIT"), `${name}: koi qatar nahi badalni chahiye thi`);
  n++; console.log(`  ✓ ${name} (ruka)`);
}

// 0) Migrations (idempotent) lagao
for (const f of ["590_leave_self_approval_guard", "591_attendance_self_write_guard",
  "592_staff_details_self_edit_guard", "593_salary_payment_single_pay"]) {
  const r = psql(fs.readFileSync(`supabase/migrations/${f}.sql`, "utf8"));
  assert.ok(r.ok, `${f} nahi chali: ${r.err}`);
}
console.log("migrations 590-593: lag gayin");

const today = `(now() at time zone 'Asia/Karachi')::date`;
const leave = (uid, status, extra = "") =>
  `insert into leave_requests (id, profile_id, from_date, to_date, leave_type, reason, status${extra ? ", decided_by, decided_at" : ""})
   values ('11111111-1111-1111-1111-111111111111', '${uid}', current_date + 10, current_date + 11, 'casual', 'Ghar mein shaadi hai', '${status}'${extra})`;

console.log("S1 chhutti:");
allowed("staff apni pending darkhwast deta hai", STAFF, leave(STAFF, "pending"));
blocked("staff apni chhutti seedha 'approved' daalta hai", STAFF, leave(STAFF, "approved", `, '${STAFF}', now()`));
blocked("HR apni chhutti 'approved' daalta hai", HR, leave(HR, "approved", `, '${HR}', now()`));
const pend = leave(STAFF, "pending").replace(/'\$\{STAFF\}'/, `'${STAFF}'`);
noRows("staff apni pending ko approved karta hai", STAFF,
  `update leave_requests set status='approved', decided_by='${STAFF}', decided_at=now() where id='11111111-1111-1111-1111-111111111111'`, pend + ";");
noRows("HR apni pending ko approved karta hai", HR,
  `update leave_requests set status='approved', decided_by='${HR}', decided_at=now() where id='11111111-1111-1111-1111-111111111111'`, leave(HR, "pending") + ";");
allowed("staff apni pending wapas (cancel) leta hai", STAFF,
  `update leave_requests set status='cancelled' where id='11111111-1111-1111-1111-111111111111' returning status`, pend + ";",
  (o) => assert.match(o, /cancelled/));
noRows("staff manzoor shuda chhutti ko cancel karta hai", STAFF,
  `update leave_requests set status='cancelled' where id='11111111-1111-1111-1111-111111111111'`,
  leave(STAFF, "approved", `, '${HR}', now()`) + ";");
allowed("HR staff ki chhutti manzoor karta hai (maker-checker theek)", HR,
  `update leave_requests set status='approved', decided_by='${HR}', decided_at=now() where id='11111111-1111-1111-1111-111111111111' returning status`,
  pend + ";", (o) => assert.match(o, /approved/));

console.log("S2 hazri:");
const att = (uid, date, status, extra = "", extraVals = "") =>
  `insert into attendance_records (profile_id, attendance_date, status, source, check_in_at${extra}) values ('${uid}', ${date}, '${status}', 'web', now()${extraVals})`;
allowed("staff aaj ka check-in lagata hai", STAFF, att(STAFF, today, "present"));
blocked("staff kal ki 'present' qatar daalta hai", STAFF, att(STAFF, `${today} - 1`, "present"));
blocked("staff aaj 'leave' darja khud daalta hai", STAFF, att(STAFF, today, "leave"));
blocked("HR apni pichli tareekh ki hazri daalta hai", HR, att(HR, `${today} - 3`, "present"));
blocked("staff purane waqt ka check-in daalta hai", STAFF,
  `insert into attendance_records (profile_id, attendance_date, status, source, check_in_at) values ('${STAFF}', ${today}, 'present', 'web', now() - interval '3 hours')`);
const absentRow = (uid) => `insert into attendance_records (profile_id, attendance_date, status, source, last_changed_by, last_change_reason) values ('${uid}', ${today} - 2, 'absent', 'correction', '${ADMIN}', 'Afsar ne lagaya');`;
blocked("HR apni 'absent' ko 'present' karta hai (chhoot khatam)", HR,
  `update attendance_records set status='present' where profile_id='${HR}'`, absentRow(HR), /darja khud nahi/);
blocked("staff apni 'absent' ko 'present' karta hai", STAFF,
  `update attendance_records set status='present' where profile_id='${STAFF}'`, absentRow(STAFF), /darja khud nahi/);
allowed("HR staff ki hazri lagata hai (afsar ka kaam)", HR,
  `insert into attendance_records (profile_id, attendance_date, status, source, last_changed_by, last_change_reason) values ('${STAFF}', ${today} - 5, 'present', 'correction', '${HR}', 'Field visit tha')`);
allowed("staff apna check-out lagata hai", STAFF,
  `update attendance_records set check_out_at = now() where profile_id='${STAFF}' returning id`,
  `insert into attendance_records (profile_id, attendance_date, status, source, check_in_at) values ('${STAFF}', ${today}, 'present', 'web', now() - interval '8 hours');`,
  (o) => assert.ok(o.length > 0));

console.log("S3 WhatsApp check-in (service role):");
const waUpsert = (uid) => `insert into attendance_records (profile_id, attendance_date, status, source, check_in_at)
  values ('${uid}', ${today}, 'present', 'whatsapp', now())
  on conflict (profile_id, attendance_date) do update set status = excluded.status, source = excluded.source, check_in_at = excluded.check_in_at`;
blocked("WhatsApp manzoor chhutti ko present nahi banata", "service", waUpsert(STAFF),
  `insert into attendance_records (profile_id, attendance_date, status, source, notes) values ('${STAFF}', ${today}, 'leave', 'leave', 'Chhutti manzoor');`, /WhatsApp check-in usay nahi badalta/);
blocked("WhatsApp 'absent' ko present nahi banata", "service", waUpsert(STAFF),
  `insert into attendance_records (profile_id, attendance_date, status, source, last_changed_by, last_change_reason) values ('${STAFF}', ${today}, 'absent', 'correction', '${HR}', 'Afsar ne lagaya');`, /WhatsApp/);
allowed("WhatsApp naya check-in (khali din) lagata hai", "service", waUpsert(STAFF));
allowed("WhatsApp check-out chalta hai", "service",
  `update attendance_records set check_out_at = now() where profile_id='${STAFF}' and attendance_date=${today} returning id`,
  `insert into attendance_records (profile_id, attendance_date, status, source, check_in_at) values ('${STAFF}', ${today}, 'present', 'whatsapp', now() - interval '8 hours');`,
  (o) => assert.ok(o.length > 0));

console.log("S4 staff record:");
blocked("HR apni tankhwah badhata hai", HR, `update staff_details set basic_salary = 500000 where profile_id='${HR}'`, "", /tankhwah khud nahi/);
blocked("HR apni joining date badalta hai", HR, `update staff_details set hire_date = '2020-01-01' where profile_id='${HR}'`, "", /joining date/);
blocked("HR apna afsar badalta hai", HR, `update staff_details set reports_to = null where profile_id='${HR}'`, "", /afsar/);
blocked("Admin apni tankhwah badhata hai", ADMIN, `update staff_details set basic_salary = 900000 where profile_id='${ADMIN}'`, "", /tankhwah khud nahi/);
blocked("HR apni aazmaish khud pakki karta hai", HR, `update staff_details set employment_status='confirmed', confirmed_at=current_date where profile_id='${HR}'`, "", /aazmaishi/);
noRows("HR apna record mita kar dobara banata hai", HR, `delete from staff_details where profile_id='${HR}'`);
blocked("HR (bina record) apni nayi qatar tankhwah ke saath banata hai", ADMIN2,
  `insert into staff_details (profile_id, basic_salary) values ('${ADMIN2}', 1)`,
  `update profiles set role='hr' where id='${ADMIN2}';`, /tankhwah, joining date/);
allowed("HR apni photo/blood group badal sakta hai", HR, `update staff_details set blood_group='B+' where profile_id='${HR}' returning id`, "", (o) => assert.ok(o.length > 0));
allowed("HR staff ki tankhwah badalta hai (doosre ki)", HR, `update staff_details set basic_salary = 22000 where profile_id='${STAFF}' returning basic_salary`, "", (o) => assert.match(o, /22000/));
allowed("Admin HR ki reporting badalta hai (doosre ki)", ADMIN, `update staff_details set reports_to='${ADMIN2}' where profile_id='${HR}' returning id`, "", (o) => assert.ok(o.length > 0));

console.log("B1 tankhwah ek dafa:");
const sal = `insert into salary_payments (id, profile_id, pay_month, pay_year, basic_salary, net_salary, status)
  values ('22222222-2222-2222-2222-222222222222', '${STAFF}', 9, 2026, 20000, 20000, 'pending');`;
const P = "'22222222-2222-2222-2222-222222222222'";
allowed("Admin pehli dafa ada karta hai", ADMIN, `select fn_salary_payment_claim(${P})->>'net_salary'`, sal, (o) => assert.match(o, /20000/));
blocked("Admin doosri dafa ada karta hai (error)", ADMIN, `select fn_salary_payment_claim(${P}); select fn_salary_payment_claim(${P})`, sal, /pehle hi di ja chuki/);
blocked("seedha update se dobara 'paid' (bina shart)", ADMIN,
  `select fn_salary_payment_claim(${P}); update salary_payments set status='paid', paid_date=current_date - 1 where id=${P}`, sal, /pehle hi di ja chuki/);
allowed("conditional update status<>'paid' dobara 0 qatar", ADMIN,
  `select fn_salary_payment_claim(${P}); update salary_payments set notes='x' where id=${P} and status <> 'paid' returning 'HIT'`, sal,
  (o) => assert.ok(!o.includes("HIT")));
blocked("pending ko seedha 'paid' (claim ke baghair)", ADMIN, `update salary_payments set status='paid' where id=${P}`, sal, /fn_salary_payment_claim/);
blocked("paid tankhwah ki raqam badalna", ADMIN, `select fn_salary_payment_claim(${P}); update salary_payments set net_salary=1 where id=${P}`, sal, /pehle hi di ja chuki/);
blocked("HR ada nahi kar sakta", HR, `select fn_salary_payment_claim(${P})`, sal, /Admin ya Owner/);
blocked("Admin apni tankhwah ada nahi karta", ADMIN, `select fn_salary_payment_claim('33333333-3333-3333-3333-333333333333')`,
  `insert into salary_payments (id, profile_id, pay_month, pay_year, basic_salary, net_salary) values ('33333333-3333-3333-3333-333333333333', '${ADMIN}', 9, 2026, 90000, 90000);`, /Apni tankhwah/);
allowed("fail hone par wohi Admin claim wapas leta hai, phir dobara ada", ADMIN,
  `select fn_salary_payment_claim(${P}); select fn_salary_payment_unclaim(${P}); select fn_salary_payment_claim(${P})->>'id'`, sal,
  (o) => assert.match(o, /22222222/));
blocked("doosra Admin claim wapas nahi le sakta", ADMIN2,
  `select fn_salary_payment_unclaim(${P})`, sal + `select set_config('request.jwt.claims', '{"sub":"${ADMIN}"}', true); select fn_salary_payment_claim(${P}); select set_config('request.jwt.claims', '', true);`, /wapas nahi/);

// Asli do-click: do alag connection ek hi waqt claim karte hain.
{
  const { spawn } = await import("node:child_process");
  const ID = "44444444-4444-4444-4444-444444444444";
  const fixture = `${seed}\ninsert into salary_payments (id, profile_id, pay_month, pay_year, basic_salary, net_salary) values ('${ID}', '${STAFF}', 8, 2026, 20000, 20000) on conflict (id) do update set status='pending';`;
  const clean = `delete from salary_payments where id='${ID}';`;
  // fixture commit (sirf local); aakhir mein saaf
  const fx = psql(`begin;\nset local session_replication_role = replica;\ndelete from salary_payments where id='${ID}';\ncommit;\nbegin;\n${fixture}\ncommit;`);
  assert.ok(fx.ok, fx.err);
  const sess = (delayMs) => new Promise((res) => {
    setTimeout(() => {
      const c = spawn(PSQL, ["-h", HOST, "-p", PORT, "-U", "postgres", "-X", "-q", "-At", "-v", "ON_ERROR_STOP=1"]);
      let out = "", err = "";
      c.stdout.on("data", (d) => (out += d)); c.stderr.on("data", (d) => (err += d));
      c.on("close", (code) => res({ ok: code === 0, out, err }));
      c.stdin.end(`begin;\n${asUser(ADMIN)}\nselect fn_salary_payment_claim('${ID}')->>'id';\nselect pg_sleep(1);\ncommit;`);
    }, delayMs);
  });
  const [a, b] = await Promise.all([sess(0), sess(300)]);
  const wins = [a, b].filter((x) => x.ok).length;
  assert.equal(wins, 1, `sirf ek click jeetna chahiye: A=${a.ok} B=${b.ok} ${a.err} ${b.err}`);
  assert.match([a, b].find((x) => !x.ok).err, /pehle hi di ja chuki/);
  // seed ke users/profiles bhi commit hue -- saaf karo
  const cl = psql(`begin;\nset local session_replication_role = replica;\n${clean}\ndelete from staff_details where profile_id in ('${HR}','${ADMIN}','${ADMIN2}','${STAFF}');\ndelete from profiles where id in ('${HR}','${ADMIN}','${ADMIN2}','${STAFF}');\ndelete from auth.users where id in ('${HR}','${ADMIN}','${ADMIN2}','${STAFF}');\ncommit;`);
  assert.ok(cl.ok, cl.err);
  n++; console.log("  ✓ do connection ek saath: sirf ek adaigi, doosre ko error");
}

console.log("Rollback files:");
for (const f of ["590_leave_self_approval_guard", "591_attendance_self_write_guard",
  "592_staff_details_self_edit_guard", "593_salary_payment_single_pay"]) {
  const r = psql(`begin;\n${fs.readFileSync(`supabase/rollbacks/${f}.rollback.sql`, "utf8")}\nrollback;`);
  assert.ok(r.ok, `${f} rollback nahi chali: ${r.err}`);
  n++; console.log(`  ✓ ${f}.rollback.sql chalti hai`);
}

console.log(`hr self-approval DB: ${n} checks theek`);
