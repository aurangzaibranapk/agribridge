// Real SQL test: 551-558 ko PGlite (in-process Postgres) par chalata hai -- live DB nahi.
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const run = (sql) => db.exec(sql);
const q = async (sql, p = []) => (await db.query(sql, p)).rows;
const as = (uid) => run(`select set_config('test.uid', '${uid}', false)`);
const fails = async (sql, re, msg) => {
  await assert.rejects(() => db.exec(sql), (e) => { assert.match(String(e.message), re, msg); return true; }, msg);
};

await run(fs.readFileSync("tests/sql/salary-qist-stubs.sql", "utf8"));
for (const f of ["551_salary_structure", "552_staff_advances", "553_payroll_runs", "554_payroll_features",
  "555_qist_plans", "556_qist_engine", "557_qist_hooks", "558_qist_features"]) {
  await run(fs.readFileSync(`supabase/migrations/${f}.sql`, "utf8"));
}
// idempotent: dobara chalana bhi theek
for (const f of ["551_salary_structure", "554_payroll_features", "558_qist_features"]) {
  await run(fs.readFileSync(`supabase/migrations/${f}.sql`, "utf8"));
}

const HR = "00000000-0000-0000-0000-0000000000a1", ADMIN = "00000000-0000-0000-0000-0000000000a2",
  OWNER = "00000000-0000-0000-0000-0000000000a3", ANWAR = "00000000-0000-0000-0000-0000000000b1",
  NEW = "00000000-0000-0000-0000-0000000000b2", FARMER = "00000000-0000-0000-0000-0000000000c1";
await run(`insert into profiles values ('${HR}','HR','hr',true),('${ADMIN}','Admin','admin',true),('${OWNER}','Owner','owner',true),
  ('${ANWAR}','Anwar Ul Hassan','sales_staff',true),('${NEW}','Naya Staff','sales_staff',true);
  insert into staff_details (profile_id, hire_date, probation_start_date) values ('${ANWAR}', null, '2026-03-01'), ('${NEW}', current_date - 30, null);`);

// ---- 551 structure maker-checker
assert.equal((await q(`select count(*)::int n from salary_components where is_active and not is_system`))[0].n, 0, "optional components band");
await as(HR);
const [{ id: S1 }] = await q(`insert into staff_salary_structures (profile_id, basic, effective_from) values ($1, 20000, '2026-10-01') returning id`, [ANWAR]);
await fails(`select fn_salary_structure_decide('${S1}', true)`, /Admin ya Owner/, "HR approve nahi");
await as(ADMIN);
await run(`select fn_salary_structure_decide('${S1}', true)`);
assert.equal(Number((await q(`select basic_salary from staff_details where profile_id=$1`, [ANWAR]))[0].basic_salary), 20000);
await fails(`update staff_salary_structures set basic = 1 where id='${S1}'`, /badla nahi/, "approved immutable");
await fails(`update salary_components set is_active=false where code='BASIC'`, /System component/);
await as(HR);
const [{ id: S2 }] = await q(`insert into staff_salary_structures (profile_id, basic, effective_from) values ($1, 15000, current_date) returning id`, [NEW]);
await as(ADMIN); await run(`select fn_salary_structure_decide('${S2}', true)`);

// ---- 553 pure absent rule (30 din)
assert.equal(Number((await q(`select fn_payroll_absent_deduction(20000, 2, 1) v`))[0].v), 1667, "20000/30*2.5");
assert.equal(Number((await q(`select fn_payroll_absent_deduction(40000, 2, 1) v`))[0].v), 3333);
assert.equal(Number((await q(`select fn_payroll_absent_deduction(20000, 40, 0) v`))[0].v), 20000, "basic se zyada nahi");

// ---- 552 advance eligibility (6 mahine; hire_date na ho to probation start)
await as(HR);
const el = (await q(`select fn_staff_advance_eligibility($1, 12000, 6) v`, [ANWAR]))[0].v;
assert.equal(el.eligible, true); assert.equal(el.service_start_is_probation, true); assert.equal(el.cap_pct, null, "had default: koi nahi");
const elNew = (await q(`select fn_staff_advance_eligibility($1, 6000, 3) v`, [NEW]))[0].v;
assert.equal(elNew.eligible, false); assert.match(elNew.reasons[0], /6 mahine/);
await fails(`insert into staff_advances (profile_id, amount, installments, installment_amount, first_year, first_month, reason)
  values ('${NEW}', 6000, 3, 2000, 2026, 10, 'zaroorat')`, /6 mahine/, "naya staff advance nahi");
await as(ADMIN); await run(`update hr_payroll_settings set advance_cap_pct = 5`); await as(HR);
assert.match((await q(`select fn_staff_advance_eligibility($1, 12000, 6) v`, [ANWAR]))[0].v.reasons.join(), /5/, "admin ki had");
await as(ADMIN); await run(`update hr_payroll_settings set advance_cap_pct = null`); await as(HR);
const [{ id: ADV }] = await q(`insert into staff_advances (profile_id, amount, installments, installment_amount, first_year, first_month, reason)
  values ($1, 12000, 6, 2000, 2026, 10, 'Ghar ki marammat') returning id`, [ANWAR]);
await fails(`select fn_staff_advance_decide('${ADV}', true)`, /Admin ya Owner/);
await as(ADMIN); await run(`select fn_staff_advance_decide('${ADV}', true)`);
await run(`select fn_staff_advance_mark_paid('${ADV}', null, null, null)`);
const [adv] = await q(`select qist_plan_id from staff_advances where id=$1`, [ADV]);
assert.ok(adv.qist_plan_id, "advance se qist plan");
const inst = await q(`select seq, due_date::text d, amount_due::int a from qist_installments where plan_id=$1 order by seq`, [adv.qist_plan_id]);
assert.equal(inst.length, 6); assert.equal(inst[0].d, "2026-10-31"); assert.equal(inst[5].d, "2027-03-31"); assert.equal(inst.reduce((s, r) => s + r.a, 0), 12000);

// ---- 553 payroll: Oct 2026, Anwar 2 absent + 1 half, finalized
await run(`insert into test_attendance values ('${ANWAR}',2026,10,26,1,2,0,2,0,0,true),('${NEW}',2026,10,30,0,0,0,0,0,0,false)`);
await as(HR);
const [{ id: RUN }] = await q(`insert into payroll_runs (pay_year, pay_month) values (2026, 10) returning id`);
await fails(`select fn_payroll_compute('${RUN}', false)`, /Hazri mukammal nahi/, "unfinalized needs ack");
await run(`select fn_payroll_compute('${RUN}', true)`);
const [line] = await q(`select basic::int, absent_deduction::int ad, advance_deduction::int adv, net::int from payroll_lines where run_id=$1 and profile_id=$2`, [RUN, ANWAR]);
assert.deepEqual(line, { basic: 20000, ad: 1667, adv: 2000, net: 16333 }, "20000 - 1667 - 2000");
await fails(`insert into payroll_lines (run_id, profile_id, basic, gross, net) values ('${RUN}','${ANWAR}',1,1,1)`, /Hisaab chalayein/);
await fails(`update payroll_runs set status='approved' where id='${RUN}'`, /payroll functions/);
await run(`select fn_payroll_transition('${RUN}', 'submit')`);
await fails(`select fn_payroll_transition('${RUN}', 'approve')`, /Admin ya Owner/);
await as(ADMIN);
await run(`select fn_payroll_transition('${RUN}', 'approve')`);
let q1 = await q(`select status, amount_deducted::int d from qist_installments where plan_id=$1 and seq=1`, [adv.qist_plan_id]);
assert.deepEqual(q1[0], { status: "paid", d: 2000 }, "approve par qist kati");
// journal fail -> unapprove ulta karta hai
await run(`select fn_payroll_transition('${RUN}', 'unapprove')`);
q1 = await q(`select status, amount_deducted::int d from qist_installments where plan_id=$1 and seq=1`, [adv.qist_plan_id]);
assert.deepEqual(q1[0], { status: "due", d: 0 });
await run(`select fn_payroll_transition('${RUN}', 'approve')`);
await run(`select fn_payroll_set_journal('${RUN}', 'approve', gen_random_uuid())`);
await run(`select fn_payroll_set_journal('${RUN}', 'pay', gen_random_uuid(), null, null)`);
assert.equal((await q(`select status from payroll_runs where id=$1`, [RUN]))[0].status, "paid");
assert.equal(Number((await q(`select net_salary from salary_payments where profile_id=$1`, [ANWAR]))[0].net_salary), 16333, "My HR slip");
// HR (maker) apna run ada nahi kar sakta
await as(HR);
const [{ id: RUN2 }] = await q(`insert into payroll_runs (pay_year, pay_month) values (2026, 11) returning id`);
await fails(`insert into payroll_runs (pay_year, pay_month) values (2026, 11)`, /duplicate|unique/, "ek mahina ek run");

// ---- 555/556 Qist: kisan, doodh, har hafte, 4 x 5000
await run(`insert into profiles values ('${FARMER}','unused','farmer',true)`);
await as(HR);
const [{ id: P }] = await q(`insert into qist_plans (party_type, party_id, party_name, total, installments_count, frequency, deduct_source, start_date)
  values ('farmer', gen_random_uuid(), 'Muhammad Aslam', 20000, 4, 'milk_weekly', 'milk', '2026-10-07') returning id`);
const [{ party_id: FID }] = await q(`select party_id from qist_plans where id=$1`, [P]);
await run(`insert into qist_installments (plan_id, seq, due_date, amount_due) values
  ('${P}',1,'2026-10-07',5000),('${P}',2,'2026-10-14',5000),('${P}',3,'2026-10-21',5000),('${P}',4,'2026-10-28',4000)`);
await fails(`select fn_qist_submit('${P}')`, /barabar nahi/, "jama check");
await run(`update qist_installments set amount_due=5000 where plan_id='${P}' and seq=4`);
await run(`select fn_qist_submit('${P}')`);
await fails(`select fn_qist_decide('${P}', true)`, /Admin ya Owner/);
await as(ADMIN);
await run(`update profiles set role='hr' where id='${ADMIN}'`); await fails(`select fn_qist_decide('${P}', true)`, /Admin ya Owner/);
await run(`update profiles set role='admin' where id='${ADMIN}'`);
await run(`select fn_qist_decide('${P}', true)`);
await fails(`update qist_installments set amount_due=1 where plan_id='${P}' and seq=1`, /Dobara schedule/);
// Haftay 1: doodh Rs 30,000 -> 5000 kata
let a = (await q(`select fn_qist_apply('farmer', $1, 'milk', '2026-10-07', 30000, 'milk_payments', gen_random_uuid()) v`, [FID]))[0].v;
assert.equal(Number(a.deduct), 5000);
// idempotent
const SRC = "11111111-1111-1111-1111-111111111111";
// Haftay 2: doodh sirf 3000 -> 3000 kata, 2000 akhir wali jama qist mein
a = (await q(`select fn_qist_apply('farmer', $1, 'milk', '2026-10-14', 3000, 'milk_payments', $2) v`, [FID, SRC]))[0].v;
assert.equal(Number(a.deduct), 3000);
const again = (await q(`select fn_qist_apply('farmer', $1, 'milk', '2026-10-14', 3000, 'milk_payments', $2) v`, [FID, SRC]))[0].v;
assert.equal(again.already, true, "dobara nahi katta");
let rows = await q(`select seq, status, amount_due::int a, amount_deducted::int d, carried_out::int c, is_carry, due_date::text dd from qist_installments where plan_id=$1 order by seq`, [P]);
assert.deepEqual(rows[1], { seq: 2, status: "partial", a: 5000, d: 3000, c: 2000, is_carry: false, dd: "2026-10-14" });
assert.deepEqual(rows[4], { seq: 5, status: "due", a: 2000, d: 0, c: 0, is_carry: true, dd: "2026-11-04" }, "kami akhir mein");
// Haftay 3: phir kami 1000 -> isi jama qist mein judti hai (nayi nahi)
await q(`select fn_qist_apply('farmer', $1, 'milk', '2026-10-21', 4000, 'milk_payments', gen_random_uuid())`, [FID]);
rows = await q(`select count(*)::int n, sum(amount_due)::int a from qist_installments where plan_id=$1 and is_carry`, [P]);
assert.deepEqual(rows[0], { n: 1, a: 3000 }, "ek hi jama qist");
// Had (cap): Admin 10% rakhe -> 30000 par 3000 se zyada nahi
await run(`select fn_qist_reschedule('${P}', '[{"due_date":"2026-10-28","amount":5000},{"due_date":"2026-11-04","amount":3000}]', 'had lagai', 10, null, true)`);
const pv = (await q(`select fn_qist_preview('farmer', $1, 'milk', '2026-10-28', 30000) v`, [FID]))[0].v;
assert.equal(Number(pv.deduct), 3000, "10% had");
// Rok: kuch nahi katta
await run(`select fn_qist_set_status('${P}', 'pause', 'kisan bemar')`);
assert.equal(Number((await q(`select fn_qist_preview('farmer', $1, 'milk', '2026-10-28', 30000) v`, [FID]))[0].v.deduct), 0);
await fails(`select fn_qist_set_status('${P}', 'resume', '')`, /Wajah/);
await run(`select fn_qist_set_status('${P}', 'resume', 'theek')`);
// Write-off: Owner bhi kar sakta, wajah lazmi
await as(OWNER);
await fails(`select fn_qist_write_off('${P}', 'x')`, /wajah/);
const wo = (await q(`select fn_qist_write_off($1, 'kisan ilaqa chhor gaya') v`, [P]))[0].v;
assert.equal(Number(wo), 8000);
assert.equal((await q(`select status from qist_plans where id=$1`, [P]))[0].status, "written_off");
// Banane wala manzoor nahi (Admin ne banaya)
await as(ADMIN);
const [{ id: P2 }] = await q(`insert into qist_plans (party_type, party_id, total, installments_count, frequency, deduct_source, start_date)
  values ('customer', gen_random_uuid(), 1000, 1, 'custom', 'cash', current_date) returning id`);
await run(`insert into qist_installments (plan_id, seq, due_date, amount_due) values ('${P2}',1,current_date,1000)`);
await run(`select fn_qist_submit('${P2}')`);
await fails(`select fn_qist_decide('${P2}', true)`, /Banane wala/);
await as(OWNER); await run(`select fn_qist_decide('${P2}', true)`);
// Views
assert.ok((await q(`select count(*)::int n from v_qist_plan_summary`))[0].n >= 3);
// additive
for (const f of fs.readdirSync("supabase/migrations").filter((f) => /^55[1-8]_/.test(f))) {
  const s = fs.readFileSync(`supabase/migrations/${f}`, "utf8");
  assert.doesNotMatch(s, /\bdrop table\b|\btruncate\b|\balter table [^;]* drop column\b/i, f);
}
console.log("PASS: 551-558 salary + qist SQL (PGlite)");
