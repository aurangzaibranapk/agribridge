// 696: auto payroll draft + line adjust. PGlite (in-process) -- live DB nahi.
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const mig = fs.readFileSync("supabase/migrations/696_payroll_auto_draft.sql", "utf8");
const code = mig.replace(/--.*$/gm, "");
assert.ok(!/\b(drop\s+table|drop\s+column|truncate)/i.test(code), "696 additive");
assert.match(code, /grant execute on function public\.fn_payroll_auto_draft\(int, int\) to service_role/);
assert.match(code, /revoke execute on function public\.fn_payroll_auto_draft\(int, int\) from public, anon, authenticated/);

const db = new PGlite();
const run = (sql) => db.exec(sql);
const q = async (sql, p = []) => (await db.query(sql, p)).rows;
const as = (uid) => run(`select set_config('test.uid', '${uid}', false)`);
const fails = async (sql, re, msg) => assert.rejects(() => db.exec(sql), (e) => { assert.match(String(e.message), re, msg); return true; }, msg);

await run(fs.readFileSync("tests/sql/salary-qist-stubs.sql", "utf8"));
await run(`do $$ begin if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if; end $$;`);
for (const f of ["551_salary_structure", "552_staff_advances", "553_payroll_runs", "554_payroll_features",
  "555_qist_plans", "556_qist_engine", "557_qist_hooks", "558_qist_features"]) {
  await run(fs.readFileSync(`supabase/migrations/${f}.sql`, "utf8"));
}
await run(mig); await run(mig); // 2 dafa

const HR = "00000000-0000-0000-0000-0000000000a1", ADMIN = "00000000-0000-0000-0000-0000000000a2",
  OWNER = "00000000-0000-0000-0000-0000000000a3", ANWAR = "00000000-0000-0000-0000-0000000000b1",
  ALI = "00000000-0000-0000-0000-0000000000b2";
await run(`insert into profiles values ('${HR}','HR','hr',true),('${ADMIN}','Admin','admin',true),('${OWNER}','Owner','owner',true),
  ('${ANWAR}','Anwar Ul Hassan','sales_staff',true),('${ALI}','Ali','sales_staff',true);
  insert into staff_details (profile_id, hire_date) values ('${ANWAR}','2026-03-01'),('${ALI}','2026-01-01');`);
// Sirf Ali ka structure; Anwar ka nahi
await as(HR);
const [{ id: S }] = await q(`insert into staff_salary_structures (profile_id, basic, effective_from) values ($1, 30000, '2026-01-01') returning id`, [ALI]);
await as(ADMIN); await run(`select fn_salary_structure_decide('${S}', true)`);

// Cron (koi login nahi)
await as("");
let res = (await q(`select fn_payroll_auto_draft(2026, 11) v`))[0].v;
assert.equal(res.action, "created"); assert.equal(res.lines, 1); assert.equal(res.warnings, 1);
assert.equal(res.incomplete, true, "hazri adhoori nishan");
const RUN = res.run_id;
const w = await q(`select profile_id, message from payroll_run_warnings where run_id=$1`, [RUN]);
assert.equal(w[0].profile_id, ANWAR); assert.match(w[0].message, /tankhwah darj nahi/);
const run1 = (await q(`select created_by, auto_created, branch_id, status from payroll_runs where id=$1`, [RUN]))[0];
assert.equal(run1.created_by, null); assert.equal(run1.auto_created, true); assert.equal(run1.branch_id, null); assert.equal(run1.status, "draft");
// Dobara: skip
res = (await q(`select fn_payroll_auto_draft(2026, 11) v`))[0].v;
assert.equal(res.action, "skipped");
assert.equal((await q(`select count(*)::int n from payroll_runs where pay_month=11`))[0].n, 1);

// Khaali purana Sab draft (jaise live Oct) bhar diya jata hai, naya nahi banta
await as(HR); await run(`insert into payroll_runs (pay_year, pay_month, created_by) values (2026, 10, '${HR}')`);
await as("");
res = (await q(`select fn_payroll_auto_draft(2026, 10) v`))[0].v;
assert.equal(res.action, "filled"); assert.equal(res.lines, 1);
// Branch run ho to Sab nahi banta
await as(HR); await run(`insert into payroll_runs (pay_year, pay_month, branch_id, created_by) values (2026, 9, gen_random_uuid(), '${HR}')`);
await as("");
assert.equal((await q(`select fn_payroll_auto_draft(2026, 9) v`))[0].v.action, "skipped");

// Line adjust
const [{ id: LINE, net: NET0 }] = await q(`select id, net from payroll_lines where run_id=$1`, [RUN]);
await as(ALI); await fails(`select fn_payroll_line_adjust('${LINE}','allowances',1000,'x')`, /Ijazat/);
await as(HR);
await fails(`select fn_payroll_line_adjust('${LINE}','allowances',1000,' ')`, /wajah/);
await fails(`select fn_payroll_line_adjust('${LINE}','basic',1000,'x')`, /nahi badal/);
await fails(`update payroll_lines set net = 1 where id='${LINE}'`, /Hisaab chalayein/, "seedha update band");
await run(`select fn_payroll_line_adjust('${LINE}','allowances',2000,'Eid bonus')`);
const l2 = (await q(`select gross, net from payroll_lines where id=$1`, [LINE]))[0];
assert.equal(Number(l2.gross), 32000); assert.equal(Number(l2.net), Number(NET0) + 2000);
const adj = await q(`select field, old_value, new_value, reason, adjusted_by from payroll_line_adjustments where line_id=$1`, [LINE]);
assert.equal(adj.length, 1); assert.equal(adj[0].reason, "Eid bonus"); assert.equal(adj[0].adjusted_by, HR);

// Maker-checker: HR bhejta, OWNER manzoor; system run hai to created_by null
await as(ADMIN); await run(`select fn_payroll_transition('${RUN}','submit')`);
await fails(`select fn_payroll_transition('${RUN}','approve')`, /khud manzoor/, "bhejne wala nahi");
await as(ADMIN); await run(`select fn_payroll_transition('${RUN}','back_to_draft')`);
await run(`select fn_payroll_line_adjust('${LINE}','other_deductions',500,'jurmana')`);
await as(HR); await run(`select fn_payroll_transition('${RUN}','submit')`);
await as(ADMIN); await fails(`select fn_payroll_transition('${RUN}','approve')`, /line badli/, "badalne wala manzoor nahi");
await as(OWNER); await run(`select fn_payroll_transition('${RUN}','approve')`);
assert.equal((await q(`select status from payroll_runs where id=$1`, [RUN]))[0].status, "approved");
await fails(`select fn_payroll_line_adjust('${LINE}','allowances',1,'x')`, /Sirf draft/);
console.log("payroll-auto-draft-696-sql: ok");
