// HR KPI (688) -- asli LOCAL Postgres par: migration 2 dafa, RLS, maker-checker, pulse gumnaami, stage tareekhen.
// Live DB ko kabhi nahi chhoota. Env: HRKPI_PGHOST (default /var/run/postgresql), HRKPI_PGPORT (5432).
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const HOST = process.env.HRKPI_PGHOST ?? "/var/run/postgresql";
const PORT = process.env.HRKPI_PGPORT ?? "5432";
const DB = "hrkpi688_test";
if (!(HOST.startsWith("/") || HOST === "localhost" || HOST === "127.0.0.1")) { console.error("Sirf local Postgres."); process.exit(1); }
const psql = (sql, db = DB) => {
  const r = spawnSync("psql", ["-h", HOST, "-p", PORT, "-U", process.env.HRKPI_PGUSER ?? "postgres", "-d", db, "-X", "-q", "-At", "-v", "ON_ERROR_STOP=1"], { input: sql, encoding: "utf8" });
  return { ok: r.status === 0, out: (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim() };
};
const probe = psql("select 1", "postgres");
if (!probe.ok) { console.log("hr-kpi-688-db: local Postgres nahi mila -- skip"); process.exit(0); }
psql(`drop database if exists ${DB}`, "postgres");
assert.ok(psql(`create database ${DB}`, "postgres").ok);

const HR = "00000000-0000-0000-0000-0000000000a1", HR2 = "00000000-0000-0000-0000-0000000000a2",
  S1 = "00000000-0000-0000-0000-0000000000b1", S2 = "00000000-0000-0000-0000-0000000000b2",
  S3 = "00000000-0000-0000-0000-0000000000b3", F = "00000000-0000-0000-0000-0000000000f1";
assert.ok(psql(fs.readFileSync("tests/sql/hr-kpi-688-stub.sql", "utf8")).ok, "stub");
const mig = fs.readFileSync("supabase/migrations/688_hr_kpi_dashboard.sql", "utf8");
let r = psql(mig + "\n" + mig);
assert.ok(r.ok, `688 (2 dafa): ${r.err}`);
assert.ok(psql("grant all on all tables in schema public to authenticated; grant all on all sequences in schema public to authenticated;").ok);
assert.ok(psql(`insert into profiles values ('${HR}','HR','hr',true),('${HR2}','Owner','owner',true),('${S1}','S1','sales_staff',true),('${S2}','S2','warehouse',true),('${S3}','S3','finance',true),('${F}','Kisan','farmer',true);
  insert into staff_details(profile_id) values ('${S1}'),('${S2}');`).ok);

const as = (u, sql) => psql(`begin; set local role authenticated; select set_config('request.jwt.claims','{"sub":"${u}"}',true) \\g /dev/null\n${sql}; commit;`);
let n = 0;
const ok = (name, res) => { assert.ok(res.ok, `${name}: ${res.err}`); n++; console.log(`  ✓ ${name}`); return res; };
const no = (name, res, re) => { assert.ok(!res.ok, `${name}: rukna chahiye tha`); if (re) assert.match(res.err, re); n++; console.log(`  ✓ ${name} (ruka)`); };

ok("HR training darj", as(HR, `insert into hr_training_records(profile_id,training_type,title,training_date,hours,cost) values ('${S1}','technical','POS',current_date,4,500)`));
no("Staff training nahi daal sakta", as(S1, `insert into hr_training_records(profile_id,training_type,title,training_date,hours) values ('${S1}','technical','x',current_date,1)`));
no("Ghalat training type", as(HR, `insert into hr_training_records(profile_id,training_type,title,training_date,hours) values ('${S1}','cooking','x',current_date,1)`));
assert.equal(as(S1, "select count(*) from hr_training_records").out.split("\n").pop(), "1", "staff apni training dekhe");
assert.equal(as(S2, "select count(*) from hr_training_records").out.split("\n").pop(), "0", "doosre ki training nahi");

ok("HR review bheje", as(HR, `insert into hr_performance_reviews(profile_id,period_month,rating) values ('${S1}',date_trunc('month',current_date)::date,'good')`));
no("Apni review khud manzoor nahi", as(HR, `update hr_performance_reviews set status='approved' where profile_id='${S1}'`), /maker-checker/);
no("Staff manzoor nahi kar sakta", (() => { const x = as(S2, `update hr_performance_reviews set status='approved' where profile_id='${S1}' returning 'HIT'`); return { ok: x.ok && x.out.includes("HIT"), err: x.err }; })());
ok("Doosra (owner) manzoor kare", as(HR2, `update hr_performance_reviews set status='approved' where profile_id='${S1}'`));
assert.equal(psql(`select decided_by from hr_performance_reviews`).out, HR2);
no("Manzoor shuda badli nahi", as(HR2, `update hr_performance_reviews set rating='poor' where profile_id='${S1}'`), /badli nahi/);
no("Apna review nahi", as(S1, `insert into hr_performance_reviews(profile_id,period_month,rating,reviewed_by) values ('${S1}','2026-10-01','good','${S1}')`));
assert.equal(as(S1, "select count(*) from hr_performance_reviews").out.split("\n").pop(), "1", "staff apna manzoor review dekhe");

ok("Target bheja", as(HR, `insert into hr_department_targets(department_key,period_month,target_amount) values ('ops','2026-10-01',1000)`));
no("Target khud manzoor nahi", as(HR, `update hr_department_targets set status='approved'`), /maker-checker/);
ok("Target owner manzoor", as(HR2, `update hr_department_targets set status='approved'`));
ok("Manzoori ke baad actual badal sakta", as(HR, `update hr_department_targets set actual_manual=900`));
no("Manzoori ke baad target nahi badalta", as(HR, `update hr_department_targets set target_amount=5`), /badli nahi/);

for (const u of [S1, S2]) ok("Pulse jawab", as(u, `insert into hr_pulse_responses(period_month,score) values (date_trunc('month',current_date)::date,${u === S1 ? 5 : 2})`));
no("Ek mahine mein do jawab nahi", as(S1, `insert into hr_pulse_responses(period_month,score) values (date_trunc('month',current_date)::date,3)`));
no("Kisan pulse nahi", as(F, `insert into hr_pulse_responses(period_month,score) values (date_trunc('month',current_date)::date,3)`));
assert.equal(as(HR, "select count(*) from hr_pulse_responses").out.split("\n").pop(), "0", "HR bhi alag jawab nahi dekh sakta");
assert.equal(as(HR, "select count(*) from fn_hr_pulse_summary(current_date, current_date)").out.split("\n").pop(), "0", "3 se kam jawab: koi nateeja nahi");
ok("Teesra jawab", as(S3, `insert into hr_pulse_responses(period_month,score) values (date_trunc('month',current_date)::date,4)`));
const sum = as(HR, "select responses||'|'||avg_score||'|'||engaged from fn_hr_pulse_summary(current_date, current_date)").out.split("\n").pop();
assert.equal(sum, "3|3.67|2");
assert.equal(as(S1, "select count(*) from fn_hr_pulse_summary(current_date, current_date)").out.split("\n").pop(), "0", "staff ko summary nahi");
assert.equal(psql("select count(*) from hr_kpi_audit where table_name='hr_pulse_responses' and (new_row ? 'score' or old_row is not null)").out, "0", "audit mein score nahi");

ok("Application", psql(`insert into job_applications(full_name) values ('A')`));
ok("Joined", psql(`update job_applications set status='joined'`));
assert.equal(psql("select (screened_at is not null)::int+(interview_at is not null)::int+(offer_at is not null)::int+(hired_at is not null)::int from job_applications").out, "4", "pichle marhalon ki tareekh bhi");

ok("Exit audit", psql(`update staff_details set exit_date=current_date, exit_reason='personal' where profile_id='${S2}'`));
assert.equal(psql("select count(*) from hr_kpi_audit where table_name='staff_details'").out, "1");
assert.ok(Number(psql("select count(*) from hr_kpi_audit").out) >= 6);
assert.equal(psql("select salary_due_day from hr_payroll_settings").out, "10");
no("Due day 31 nahi", psql("update hr_payroll_settings set salary_due_day=31"));
ok("Rollback chale", psql(fs.readFileSync("supabase/migrations/688_hr_kpi_dashboard.rollback.sql", "utf8")));

psql(`drop database if exists ${DB}`, "postgres");
console.log(`hr-kpi-688-db: ${n} checks ok`);
