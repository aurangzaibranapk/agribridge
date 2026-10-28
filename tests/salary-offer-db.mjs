// 691 -- asli Postgres 17 par RLS + trigger test. Sirf LOCAL cluster (default /tmp:54339).
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const HOST = process.env.HRDB_PGHOST ?? "/tmp";
const PORT = process.env.HRDB_PGPORT ?? "54339";
const PSQL = process.env.PSQL ?? (fs.existsSync("/usr/lib/postgresql/17/bin/psql") ? "/usr/lib/postgresql/17/bin/psql" : "psql");
if (!(HOST.startsWith("/") || HOST === "localhost" || HOST === "127.0.0.1")) { console.error("Ye test sirf local Postgres par chalta hai."); process.exit(1); }
const probe = spawnSync(PSQL, ["-h", HOST, "-p", PORT, "-U", "postgres", "-Atc", "select 1"], { encoding: "utf8" });
if (probe.error || probe.status !== 0) { console.log("salary-offer-db: local Postgres nahi mila -- chhor diya (CI mein DB nahi)."); process.exit(0); }

const HR = "00000000-0000-0000-0000-0000000c0001", A1 = "00000000-0000-0000-0000-0000000c0002", A2 = "00000000-0000-0000-0000-0000000c0003",
  ST = "00000000-0000-0000-0000-0000000c0004", ST2 = "00000000-0000-0000-0000-0000000c0005", OFFER = "44444444-0000-0000-0000-000000000003";
function psql(sql) {
  const r = spawnSync(PSQL, ["-h", HOST, "-p", PORT, "-U", "postgres", "-X", "-q", "-At", "-v", "ON_ERROR_STOP=1"], { input: sql, encoding: "utf8" });
  if (r.error) throw r.error;
  return { ok: r.status === 0, out: (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim() };
}
const seed = fs.readFileSync("tests/sql/salary-offer-db-seed.sql", "utf8");
const as = (u) => u === "anon" ? "set local role anon; select set_config('request.jwt.claims', '{\"role\":\"anon\"}', true);" : `set local role authenticated; select set_config('request.jwt.claims', '{"sub":"${u}","role":"authenticated"}', true);`;
const reset = "reset role; select set_config('request.jwt.claims', '', true);";
const run = (steps) => psql(`begin;\n${seed}\n\\o /dev/null\n${steps.map(([u, s]) => `${u === "pg" ? reset : as(u)}\n${s};`).join("\n")}\n\\o\n${steps.at(-1)[2] ?? "select 'done'"};\nrollback;`);
let n = 0;
const ok = (name, steps, check) => { const r = run(steps); assert.ok(r.ok, `${name}: ${r.err}`); check?.(r.out); n++; console.log(`  ✓ ${name}`); };
const no = (name, steps, re) => { const r = run(steps); assert.ok(!r.ok, `${name}: rukna chahiye tha`); if (re) assert.match(r.err, re, name); n++; console.log(`  ✓ ${name} (ruka)`); };

const m = fs.readFileSync("supabase/migrations/691_salary_offer_increments_slip.sql", "utf8");
assert.ok(psql(m + "\n" + m).ok, "691 do dafa chalni chahiye (idempotent)");
console.log("  ✓ 691 do dafa chali");

ok("HR offer qubool kare: kul + event khud", [[HR, `update public.job_offers set status = 'accepted' where id = '${OFFER}'`, `reset role; select accepted_total || '|' || (accepted_at is not null) || '|' || (select count(*) from public.job_offer_events e where e.offer_id = '${OFFER}' and e.kind = 'accepted') from public.job_offers where id = '${OFFER}'`]],
  (o) => assert.equal(o.split("\n").at(-1), "50000.00|true|1"));
ok("public link (service, bina auth) se qubool = via public_link", [["pg", `update public.job_offers set status = 'accepted' where id = '${OFFER}'`, `select via from public.job_offer_events where offer_id = '${OFFER}'`]],
  (o) => assert.equal(o.split("\n").at(-1), "public_link"));
ok("naya status countered chalta hai", [[HR, `update public.job_offers set status = 'countered' where id = '${OFFER}'`]]);
no("ghalat status ruka", [[HR, `update public.job_offers set status = 'maybe' where id = '${OFFER}'`]], /check/);
no("staff offer events nahi dekhta/likhta", [[ST, `insert into public.job_offer_events (offer_id, application_id, kind, actor) values ('${OFFER}', '44444444-0000-0000-0000-000000000002', 'countered', '${ST}')`]], /row-level security/);
no("event history badli nahi ja sakti", [["pg", `insert into public.job_offer_events (offer_id, application_id, kind) values ('${OFFER}', '44444444-0000-0000-0000-000000000002', 'sent')`], ["pg", `update public.job_offer_events set note = 'x'`]], /badli ya mitaayi/);

const accept = ["pg", `update public.job_offers set status = 'accepted' where id = '${OFFER}'`];
ok("qubool offer se DRAFT structure (hissay saath)", [accept, [HR, `select public.fn_salary_structure_from_offer('${ST}', '${OFFER}', null)`,
  `reset role; select s.status || '|' || s.basic || '|' || s.change_reason || '|' || (select count(*) from public.staff_salary_structure_items i where i.structure_id = s.id) from public.staff_salary_structures s where s.source_offer_id = '${OFFER}'`]],
  (o) => assert.equal(o.split("\n").at(-1), "draft|34000.00|joining|3"));
no("apna structure offer se khud nahi", [accept, [ST, `select public.fn_salary_structure_from_offer('${ST}', '${OFFER}', null)`]]);
no("pending offer se structure nahi", [[HR, `select public.fn_salary_structure_from_offer('${ST}', '${OFFER}', null)`]], /Qubool shuda offer nahi/);
no("banane wala khud manzoor nahi kar sakta", [accept, [A1, `select public.fn_salary_structure_from_offer('${ST}', '${OFFER}', null)`],
  [A1, `select public.fn_salary_structure_decide((select id from public.staff_salary_structures where source_offer_id = '${OFFER}'), true, null)`]], /Banane wala/);
ok("doosra admin manzoor kare -> staff_details offer + agli barhotri", [accept, [HR, `select public.fn_salary_structure_from_offer('${ST}', '${OFFER}', current_date - 360)`],
  [A2, `select public.fn_salary_structure_decide((select id from public.staff_salary_structures where source_offer_id = '${OFFER}'), true, null)`,
  `reset role; select (offer_id = '${OFFER}') || '|' || (next_increment_due = current_date - 360 + interval '1 year')::text || '|' || basic_salary from public.staff_details where profile_id = '${ST}'`]],
  (o) => assert.equal(o.split("\n").at(-1), "true|true|34000.00"));

const approved = [accept, [HR, `select public.fn_salary_structure_from_offer('${ST}', '${OFFER}', current_date - 360)`],
  [A2, `select public.fn_salary_structure_decide((select id from public.staff_salary_structures where source_offer_id = '${OFFER}'), true, null)`]];
ok("barhotri draft: pichla structure aur farq khud", [...approved, [HR, `insert into public.staff_salary_structures (profile_id, basic, effective_from, created_by, change_reason) values ('${ST}', 37400, current_date + 5, '${HR}', 'annual')`,
  `reset role; select increment_amount || '|' || increment_pct || '|' || (prev_structure_id is not null) from public.staff_salary_structures where profile_id = '${ST}' and basic = 37400`]],
  (o) => assert.equal(o.split("\n").at(-1), "3400.00|10.000|true"));
no("apni barhotri khud nahi", [[ST, `insert into public.staff_salary_structures (profile_id, basic, effective_from, created_by) values ('${ST}', 99999, current_date, '${ST}')`]]);
ok("staff apni next_increment_due nahi badal sakta (RLS: 0 rows)", [[ST, `update public.staff_details set next_increment_due = current_date where profile_id = '${ST}'`, `reset role; select coalesce(next_increment_due::text, 'NULL') from public.staff_details where profile_id = '${ST}'`]],
  (o) => assert.equal(o.split("\n").at(-1), "NULL"));
no("HR bhi apni barhotri ki tareekh / bank khud nahi badal sakta (trigger)", [["pg", `insert into public.staff_details (profile_id, designation) values ('${HR}', 'HR') on conflict (profile_id) do nothing`],
  [HR, `update public.staff_details set next_increment_due = current_date where profile_id = '${HR}'`]], /khud nahi/);
ok("v_upcoming_increments: HR ko dikhta, saalgirah se due", [[HR, "select 1", `select bucket || '|' || days_left from public.v_upcoming_increments where profile_id = '${ST}'`]],
  (o) => assert.match(o.split("\n").at(-1), /^(this_month|next_month)\|5$/));
ok("v_upcoming_increments: staff ko doosre staff nazar nahi aate (RLS)", [[ST, "select 1", `select count(*) from public.v_upcoming_increments where profile_id = '${ST2}' and current_basic is not null`]],
  (o) => assert.equal(o.split("\n").at(-1), "0"));

// Payroll slip: line seedha (guard ijazat ke saath) dalo
const line = ["pg", `insert into public.payroll_runs (id, pay_year, pay_month, created_by) values ('55555555-0000-0000-0000-000000000001', 2026, 11, '${HR}');
  select set_config('agribridge.payroll_fn','on', true);
  update public.payroll_runs set status = 'approved', approved_by = '${A2}' where id = '55555555-0000-0000-0000-000000000001';
  insert into public.payroll_lines (id, run_id, profile_id, basic, gross, net) values ('55555555-0000-0000-0000-000000000002', '55555555-0000-0000-0000-000000000001', '${ST}', 40000, 59200, 52497);
  select set_config('agribridge.payroll_fn','off', true)`];
ok("line par slip_no + verify_code khud", [line, ["pg", "select 1", "select slip_no ~ '^ART-2026-11-[0-9]{4}$' and verify_code ~ '^VRF-[0-9A-F]{4}-[0-9A-F]{4}$' from public.payroll_lines where id = '55555555-0000-0000-0000-000000000002'"]],
  (o) => assert.equal(o.split("\n").at(-1), "t"));
ok("staff apni slip dekhe (bank masked)", [line, [ST, "select 1", "select (public.fn_salary_slip('55555555-0000-0000-0000-000000000002')->'staff'->>'bank_account')"]],
  (o) => assert.equal(o.split("\n").at(-1), "PK00 **** **** 1234"));
ok("doosra staff slip nahi dekh sakta", [line, [ST2, "select 1", "select coalesce(public.fn_salary_slip('55555555-0000-0000-0000-000000000002')::text, 'NULL')"]],
  (o) => assert.equal(o.split("\n").at(-1), "NULL"));
ok("public tasdeeq (anon): mehdood maloomat, CNIC nahi", [line, ["pg", "select set_config('t.code', (select verify_code from public.payroll_lines where id = '55555555-0000-0000-0000-000000000002'), true)"], ["anon", "select 1", "select public.fn_verify_salary_slip(current_setting('t.code'))::text"]],
  (o) => { const j = JSON.parse(o.split("\n").at(-1)); assert.equal(j.name, "Anwar Ul Hassan"); assert.equal(Number(j.net), 52497); assert.ok(!("cnic" in j) && !("bank_account" in j)); });
{ const r = run([line, ["anon", "select 1", "select count(*) from public.payroll_lines"]]); assert.ok(!r.ok || r.out.split("\n").at(-1) === "0" || /permission denied/.test(r.err), "anon payroll_lines"); n++; console.log("  ✓ anon payroll_lines seedha nahi parh sakta"); }
ok("admin adaigi ka hawala", [line, [A1, "select public.fn_payroll_line_set_payment('55555555-0000-0000-0000-000000000002', 'bank_transfer', 'TXN-1', null)", "reset role; select pay_method || '|' || pay_ref || '|' || (paid_at is not null) from public.payroll_lines where id = '55555555-0000-0000-0000-000000000002'"]],
  (o) => assert.equal(o.split("\n").at(-1), "bank_transfer|TXN-1|true"));
no("HR (approver nahi) hawala nahi", [line, [HR, "select public.fn_payroll_line_set_payment('55555555-0000-0000-0000-000000000002', 'cash', null, null)"]], /Sirf Admin/);

const rb = fs.readFileSync("supabase/migrations/691_salary_offer_increments_slip.rollback.sql", "utf8");
const r = psql(`begin;\n${rb}\nselect to_regclass('public.job_offer_events') is null and to_regclass('public.v_upcoming_increments') is null;\nrollback;`);
assert.ok(r.ok && r.out.endsWith("t"), "rollback: " + r.err); n++; console.log("  ✓ rollback saaf chalta hai");
console.log(`salary-offer-db: ${n} ok`);
