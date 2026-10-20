// Dairy review 650-656 on PGlite. Kisi remote database par nahi chalta.
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const FILES = [
  "650_dairy_quality_number_variance",
  "651_dairy_apply_fat_atomic",
  "652_dairy_milk_payment_atomic",
  "653_dairy_maker_checker",
  "654_dairy_rls_counters_dispatch",
  "655_dairy_month_pnl",
  "656_dairy_rate_privacy_meter_bucket",
];
const M = FILES.map((f) => fs.readFileSync(`supabase/migrations/${f}.sql`, "utf8"));

function stripComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
}

for (const sql of M) {
  const live = stripComments(sql);
  assert.doesNotMatch(live, /\bdrop\s+table\b/i);
  assert.doesNotMatch(live, /\bdelete\s+from\b/i);
  assert.doesNotMatch(live, /\btruncate\s+(only\s+|table\s+)?public\./i);
  assert.doesNotMatch(sql, /hwaiuwxqldxsoukkfefn|ktskwawkslaznkjjacni|supabase\.co/i);
}
assert.match(M[1], /for update/i);
assert.match(M[1], /'5010'/);
assert.match(M[1], /'1150'/);
assert.match(M[1], /Doodh pehle jama hua, FAT baad mein laga/);
assert.match(M[2], /status in \('priced', 'verified'\)/);
assert.match(M[6], /needs owner approval/);
assert.match(M[6], /set public = false/);
assert.doesNotMatch(stripComments(M[6]), /update\s+public\.fuel_logs/i);

const db = new PGlite();
const run = (s) => db.exec(s);
const one = async (s) => Object.values((await db.query(s)).rows[0] ?? {})[0];
const num = (v) => Math.round(Number(v) * 100) / 100;
const throws = async (s, re, msg) => {
  let err = null;
  try { await run(s); } catch (e) { err = e; }
  assert.ok(err, `expected error: ${msg}`);
  if (re) assert.match(String(err.message), re, `${msg} :: ${err.message}`);
  try { await db.exec("rollback"); } catch { /* autocommit */ }
  try { await db.exec("reset role"); } catch { /* already superuser */ }
  try { await db.exec("select set_config('test.staff_role','', false)"); } catch { /* closed */ }
};
let ok = 0;
const pass = (n) => { ok++; console.log(`  ok  ${n}`); };

await run(fs.readFileSync("tests/sql/dairy-review-stubs.sql", "utf8"));
for (const m of M) { await run(m); await run(m); }
pass("650-656 idempotent, additive, no remote project id");

const FA = "00000000-0000-0000-0000-0000000000a1";
const FB = "00000000-0000-0000-0000-0000000000b1";
const FC = "00000000-0000-0000-0000-0000000000c1";
const FD = "00000000-0000-0000-0000-0000000000d1";
const FE = "00000000-0000-0000-0000-0000000000e1";
const FF = "00000000-0000-0000-0000-0000000000f1";
const FG = "00000000-0000-0000-0000-000000000011";
const FH = "00000000-0000-0000-0000-000000000012";
const FI = "00000000-0000-0000-0000-000000000013";
const MAKER = "00000000-0000-0000-0000-00000000aaa1";
const OTHER = "00000000-0000-0000-0000-00000000bbb1";
const THIRD = "00000000-0000-0000-0000-00000000ccc1";
const BRANCH_B = "00000000-0000-0000-0000-00000000b222";
const BRANCH_C = "00000000-0000-0000-0000-00000000c333";
const CLIENT = "00000000-0000-0000-0000-00000000c1a1";
const CLIENT2 = "00000000-0000-0000-0000-00000000c1a2";
const CLIENT3 = "00000000-0000-0000-0000-00000000c1a3";

await run(`
insert into public.farmers (id, full_name, phone_number, milk_collection_type) values
  ('${FA}','Ahmad','03001111111','field_collection'),
  ('${FB}','Bilal','03002222222','field_collection'),
  ('${FC}','C','03003333333','field_collection'),
  ('${FD}','D','03004444444','field_collection'),
  ('${FE}','E','03005555555','field_collection'),
  ('${FF}','F','03006666666','field_collection'),
  ('${FG}','G','03007777777','field_collection'),
  ('${FH}','H','03008888888','field_collection'),
  ('${FI}','Irfan','03009999999','self_dropoff');
insert into public.milk_rate_settings (standard_rate, self_dropoff_incentive, snf_constant, reference_ts)
  values (145, 10, 0.805, 13);
insert into public.company_billing_settings (company_name, service_rate_per_liter) values ('Wasela Pakistan', 10);
insert into public.fuel_rate_settings (petrol_rate, diesel_rate, margin) values (280, 290, 2.17);
insert into public.wallets (owner_type, owner_id, balance) values
  ('farmer','${FA}',0), ('farmer','${FE}',0), ('farmer','${FG}',0), ('farmer','${FH}',0);
`);

const entry = async (farmer, o = {}) => one(`
  insert into public.milk_entries (
    farmer_id, quantity_liters, lr, status, entry_date, shift, created_by,
    possible_duplicate_of, collected_at, lr_override
  ) values (
    '${farmer}', ${o.liters ?? 10}, ${o.lr ?? 28}, '${o.status ?? "pending_fat"}',
    ${o.date ?? "current_date"}, 'morning', ${o.by ? `'${o.by}'` : "null"},
    ${o.dup ? `'${o.dup}'` : "null"}, ${o.at ? `'${o.at}'` : "null"}, ${o.lrOverride ? "true" : "false"}
  ) returning id`);

// H1
const numbers = [];
for (let i = 0; i < 5; i++) numbers.push(await one(`select public.fn_next_milk_collection_number(26)`));
assert.deepEqual(numbers, ["MC-26-000001", "MC-26-000002", "MC-26-000003", "MC-26-000004", "MC-26-000005"]);
assert.equal(await one(`select public.fn_next_milk_collection_number(25)`), "MC-25-000001");
await throws(`select public.fn_next_milk_collection_number(100)`, /0 se 99/, "H1 year");
await throws(`select public.fn_next_milk_collection_number(null)`, /0 se 99/, "H1 null year");
assert.equal(await one(`select has_function_privilege('anon','public.fn_next_milk_collection_number(integer)','execute')`), false);
pass("H1 atomic collection numbers");

// C1 C3 L2 — worked example
const aId = await entry(FA, { at: "2026-01-01T14:30:00Z" });
const fat = await db.query(`select public.fn_apply_milk_fat('${aId}', 4, '${OTHER}', false) as r`);
const priced = fat.rows[0].r;
assert.equal(num(priced.snf), 8.61);
assert.equal(num(priced.ts), 12.61);
assert.equal(num(priced.adjusted_volume), 9.7);
assert.equal(num(priced.amount), 1406.5);
assert.equal(num(priced.rate_per_liter), 145);
assert.equal(priced.farmer_name, "Ahmad");
assert.ok(String(priced.collected_at).includes("2026"));
assert.equal(await one(`select status from public.milk_entries where id='${aId}'`), "priced");
assert.equal(Number(await one(`select count(*) from public.farmer_credit_ledger where reference_id='${aId}'`)), 1);
assert.equal(await one(`select source_type from public.farmer_credit_ledger where reference_id='${aId}'`), "milk");
assert.equal(await one(`select ledger_type from public.farmer_credit_ledger where reference_id='${aId}'`), "credit");
assert.equal(num(await one(`select balance_after from public.farmer_credit_ledger where reference_id='${aId}'`)), -1406.5);
assert.equal(num(await one(`select balance from public.wallets where owner_id='${FA}'`)), 1406.5);
assert.equal(Number(await one(`select count(*) from public.wallet_transactions where reference_id='${aId}'`)), 1);
const journal = (await db.query(`select payload from public.test_journal_calls`)).rows[0].payload;
assert.equal(journal.lines[0].account, "5010");
assert.equal(num(journal.lines[0].debit), 1406.5);
assert.equal(journal.lines[1].account, "1150");
assert.equal(num(journal.lines[1].credit), 1406.5);
assert.equal(journal.backdateReason, null);
assert.equal(journal.lines.length, 2);
await throws(`select public.fn_apply_milk_fat('${aId}', 4, '${OTHER}', false)`, /pehle hi lag/, "C1 second FAT");
assert.equal(Number(await one(`select count(*) from public.farmer_credit_ledger where farmer_id='${FA}'`)), 1);
assert.equal(Number(await one(`select count(*) from public.test_journal_calls`)), 1);
pass("C1+C3+L2 one FAT posts khata, wallet and 5010/1150 once");

// no wallet still prices
const iId = await entry(FI);
const self = (await db.query(`select public.fn_apply_milk_fat('${iId}', 4, '${OTHER}', false) as r`)).rows[0].r;
assert.equal(num(self.amount), 1503.5);
assert.equal(num(self.rate_per_liter), 155);
assert.equal(Number(await one(`select count(*) from public.wallet_transactions where reference_id='${iId}'`)), 0);
assert.equal(await one(`select status from public.milk_entries where id='${iId}'`), "priced");
pass("C3 wallet missing does not block milk; self-dropoff adds incentive");

// journal failure rolls back
const bId = await entry(FB);
await run(`update public.test_journal_mode set fail = true`);
await throws(`select public.fn_apply_milk_fat('${bId}', 4, '${OTHER}', false)`, /journal down/, "C3 journal");
await run(`update public.test_journal_mode set fail = false`);
assert.equal(await one(`select status from public.milk_entries where id='${bId}'`), "pending_fat");
assert.equal(num(await one(`select coalesce(total_amount,0) from public.milk_entries where id='${bId}'`)), 0);
assert.equal(Number(await one(`select count(*) from public.farmer_credit_ledger where farmer_id='${FB}'`)), 0);
pass("C3 GL failure leaves entry pending and ledger empty");

// late FAT backdate
const hId = await entry(FH, { date: "current_date - 1", at: "2026-01-01T14:30:00Z" });
await run(`select public.fn_apply_milk_fat('${hId}', 4, '${OTHER}', false)`);
const late = (await db.query(`select payload from public.test_journal_calls order by id desc limit 1`)).rows[0].payload;
assert.equal(late.backdateReason, "Doodh pehle jama hua, FAT baad mein laga");
assert.equal(String(late.entryDate).slice(0, 10), String(await one(`select (current_date - 1)::text`)));
pass("C3 late FAT sends backdate reason");

// M8 duplicate
const cOther = await entry(FC, { by: MAKER });
const cId = await entry(FC, { by: MAKER, dup: cOther });
await throws(`select public.fn_apply_milk_fat('${cId}', 4, '${OTHER}', false)`, /duplicate/, "M8 block");
await throws(`select public.fn_clear_milk_duplicate('${cId}', '${MAKER}', 'ye saaf hai')`, /khud saaf/, "M8 maker");
await throws(`select public.fn_clear_milk_duplicate('${cId}', '${OTHER}', 'abc')`, /5 haroof/, "M8 note");
await run(`select public.fn_clear_milk_duplicate('${cId}', '${OTHER}', 'doosra banda saaf')`);
await run(`select public.fn_apply_milk_fat('${cId}', 4, '${THIRD}', false)`);
assert.equal(await one(`select status from public.milk_entries where id='${cId}'`), "priced");
pass("M8 duplicate blocks FAT until a different person clears it");

// M1 ranges
const dId = await entry(FD);
await throws(`select public.fn_apply_milk_fat('${dId}', 45, '${OTHER}', false)`, /1 se 12/, "M1 fat");
await run(`select public.fn_apply_milk_fat('${dId}', 45, '${OTHER}', true)`);
assert.equal(await one(`select fat_override from public.milk_entries where id='${dId}'`), true);
assert.equal(num(await one(`select fat_percentage from public.milk_entries where id='${dId}'`)), 45);
await throws(`
  insert into public.milk_entries (farmer_id, quantity_liters, lr, lr_override)
  values ('${FD}', 5, 280, false)`, /chk_milk_lr_range|check/i, "M1 lr");
const wide = await entry(FD, { lr: 280, lrOverride: true });
assert.ok(wide);
await throws(`
  update public.milk_entries set verified_by_profile_id = created_by
  where id='${cId}'`, /chk_milk_no_self_verify|check/i, "H3 verify");
pass("M1 FAT/LR bounds and H3 no self-verify");

// H2 payments
assert.equal(num(await one(`select public.fn_milk_payable_balance('${FF}')`)), 0);
await throws(`
  select public.fn_record_milk_payment('${FF}', 10, 0, 'cash', null, '${OTHER}', '${CLIENT}')
`, /baqaya se zyada/, "H2 empty");
const pendingOnly = await entry(FF, { status: "pending_fat" });
assert.ok(pendingOnly);
assert.equal(num(await one(`select balance_due from public.milk_farmer_balances where farmer_id='${FF}'`)), 0);
assert.equal(num(await one(`select public.fn_milk_payable_balance('${FA}')`)), 1406.5);
await throws(`
  select public.fn_record_milk_payment('${FA}', 2000, 0, 'cash', null, '${OTHER}', '${CLIENT}')
`, /baqaya se zyada/, "H2 over");
const pay = (await db.query(`
  select public.fn_record_milk_payment('${FA}', 400, 0, 'cash', 'hissa', '${OTHER}', '${CLIENT}') as r
`)).rows[0].r;
assert.equal(pay.already, false);
assert.equal(num(pay.cash), 400);
const again = (await db.query(`
  select public.fn_record_milk_payment('${FA}', 400, 0, 'cash', 'hissa', '${OTHER}', '${CLIENT}') as r
`)).rows[0].r;
assert.equal(again.already, true);
assert.equal(Number(await one(`select count(*) from public.milk_payments where client_action_id='${CLIENT}'`)), 1);
assert.equal(Number(await one(`select count(*) from public.farmer_credit_ledger where farmer_id='${FA}' and ledger_type='debit'`)), 1);
assert.equal(num(await one(`select balance from public.wallets where owner_id='${FA}'`)), 1006.5);
const journalsAfterPay = Number(await one(`select count(*) from public.test_journal_calls`));
await throws(`
  select public.fn_record_milk_payment('${FA}', 1200, 0, 'cash', null, '${OTHER}', '${CLIENT2}')
`, /baqaya se zyada/, "H2 remainder");
assert.equal(Number(await one(`select count(*) from public.test_journal_calls`)), journalsAfterPay);
assert.equal(num(await one(`select public.fn_milk_payable_balance('${FA}')`)), 1006.5);
assert.equal(num(await one(`select balance_due from public.milk_farmer_balances where farmer_id='${FA}'`)), 1006.5);
pass("H2 balance, idempotent cash payment, cash does not post GL");

const eId = await entry(FE);
await run(`select public.fn_apply_milk_fat('${eId}', 4, '${OTHER}', false)`);
await throws(`
  select public.fn_record_milk_payment('${FE}', 1400, 20, 'cash', null, '${OTHER}', '${CLIENT2}')
`, /baqaya se zyada/, "H2 qist plus cash over");
const split = (await db.query(`
  select public.fn_record_milk_payment('${FE}', 300, 100, 'cash', null, '${OTHER}', '${CLIENT3}') as r
`)).rows[0].r;
assert.equal(split.already, false);
assert.equal(num(split.cash), 300);
assert.equal(num(split.qist), 100);
assert.equal(Number(await one(`select count(*) from public.milk_payments where farmer_id='${FE}'`)), 2);
assert.equal(Number(await one(`select count(*) from public.milk_payments where farmer_id='${FE}' and payment_method='qist_adjustment'`)), 1);
assert.equal(Number(await one(`select count(*) from public.farmer_credit_ledger where farmer_id='${FE}' and ledger_type='debit'`)), 1);
assert.equal(num(await one(`select amount from public.farmer_credit_ledger where farmer_id='${FE}' and ledger_type='debit'`)), 300);
assert.equal(num(await one(`select balance from public.wallets where owner_id='${FE}'`)), 1106.5);
assert.equal(num(await one(`select public.fn_milk_payable_balance('${FE}')`)), 1006.5);
pass("H2 qist row is not cash; wallet and khata move only for cash");

// H3 maker-checker
await throws(`
  insert into public.fuel_logs (approved_by, created_by) values ('${MAKER}', '${MAKER}')
`, /chk_fuel_no_self_approval|check/i, "H3 fuel");
await run(`insert into public.fuel_logs (approved_by, created_by) values ('${OTHER}', '${MAKER}')`);
await run(`insert into public.fuel_logs (approved_by, created_by) values ('${MAKER}', null)`);
await throws(`
  insert into public.generator_logs (approved_by, created_by) values ('${MAKER}', '${MAKER}')
`, /chk_generator_no_self_approval|check/i, "H3 generator");
await throws(`
  insert into public.maintenance_logs (approved_by, created_by, branch_verified_by)
  values ('${OTHER}', '${MAKER}', '${MAKER}')
`, /chk_maint_verifier_not_maker|check/i, "H3 maint verifier");
await throws(`
  insert into public.maintenance_logs (approved_by, created_by, branch_verified_by)
  values ('${MAKER}', '${MAKER}', '${OTHER}')
`, /chk_maint_approver_not_maker|check/i, "H3 maint maker");
await throws(`
  insert into public.maintenance_logs (approved_by, created_by, branch_verified_by)
  values ('${OTHER}', '${MAKER}', '${OTHER}')
`, /chk_maint_approver_not_verifier|check/i, "H3 maint same person");
await run(`
  insert into public.maintenance_logs (approved_by, created_by, branch_verified_by)
  values ('${THIRD}', '${MAKER}', '${OTHER}')
`);
pass("H3 nobody approves or verifies their own fuel, generator, or maintenance");

// H7 dispatch
await throws(`
  insert into public.milk_dispatches (dispatched_liters, received_liters, notes)
  values (100, 110, 'zyada')
`, /zyada|check/i, "H7 cap");
const disp = await one(`
  insert into public.milk_dispatches (dispatch_date, dispatched_liters, notes)
  values ('2026-09-15', 100, 'pehli') returning id
`);
await run(`update public.milk_dispatches set received_liters = 90, notes = 'raseed' where id='${disp}'`);
await throws(`
  update public.milk_dispatches set received_liters = 80 where id='${disp}'
`, /Raseed pehle/, "H7 write once");
await throws(`
  update public.milk_dispatches set dispatched_liters = 50 where id='${disp}'
`, /badli nahi/, "H7 dispatched locked");
await run(`update public.milk_dispatches set notes = 'sirf note' where id='${disp}'`);
assert.equal(await one(`select notes from public.milk_dispatches where id='${disp}'`), "sirf note");
assert.equal(num(await one(`select received_liters from public.milk_dispatches where id='${disp}'`)), 90);
pass("H7 received capped and write-once; notes can still change");

const as = (role) => `set role authenticated; select set_config('test.staff_role','${role}', false);`;
const reset = `reset role; select set_config('test.staff_role','', false);`;
await throws(`${as("sales_staff")} insert into public.milk_dispatches (dispatched_liters) values (10)`, /row-level security/, "H7 sales insert");
await throws(`${as("sales_staff")} insert into public.milk_collection_counters (year, last_number) values (99, 1)`, /permission denied/, "H7 sales counter");
await run(`${as("milk_collection")} insert into public.milk_dispatches (dispatch_date, dispatched_liters, notes) values ('2026-09-15', 12, 'staff'); ${reset}`);
await throws(`${as("milk_collection")} insert into public.milk_collection_counters (year, last_number) values (98, 1)`, /permission denied/, "H7 milk counter");
assert.equal(await one(`select has_function_privilege('authenticated','public.fn_apply_milk_fat(uuid,numeric,uuid,boolean)','execute')`), false);
pass("H7 sales cannot write dispatch or counters; milk staff can dispatch, not counters");

// L5
await throws(`set role anon; select * from public.fuel_rate_settings`, /permission denied/, "L5 fuel anon");
await throws(`set role anon; select * from public.milk_rate_settings`, /permission denied/, "L5 milk anon");
await run(as("milk_collection"));
assert.equal(Number(await one(`select count(*) from public.fuel_rate_settings`)), 1);
assert.equal(Number(await one(`select count(*) from public.milk_rate_settings`)), 1);
await run(reset);
await run(`set role authenticated; select set_config('test.staff_role','', false);`);
assert.equal(Number(await one(`select count(*) from public.fuel_rate_settings`)), 0);
await run(reset);
pass("L5 anon cannot read rates; milk staff can");

// M6 bucket private, stored URL not rewritten
assert.equal(await one(`select b.public from storage.buckets b where b.id='meter-readings'`), false);
await run(`update public.fuel_logs set meter_photo_url='https://example.test/storage/v1/object/public/meter-readings/fuel/a.jpg' where meter_photo_url is null`);
assert.match(String(await one(`select meter_photo_url from public.fuel_logs where meter_photo_url is not null limit 1`)), /meter-readings\/fuel\/a\.jpg/);
pass("M6 bucket private; public URL rewrite not executed");

// M7 variance kind + L4 indexes
await throws(`
  insert into public.milk_route_collections (variance_kind, shortage_liters, collection_date)
  values ('nope', 1, current_date)
`, /chk_route_variance_kind|check/i, "M7 kind");
await run(`insert into public.milk_route_collections (variance_kind, shortage_liters, collection_date) values ('excess', -4, current_date)`);
assert.equal(await one(`select 1 from pg_indexes where indexname='idx_milk_route_collections_branch_date'`), 1);
assert.equal(await one(`select 1 from pg_indexes where indexname='idx_milk_payments_created_at'`), 1);
pass("M7 variance kind and L4 indexes");

// H5 H6 C2 billing
const vehB = await one(`insert into public.vehicles (branch_id) values ('${BRANCH_B}') returning id`);
await run(`
  insert into public.milk_dispatches (dispatch_date, branch_id, dispatched_liters, received_liters) values
    ('2026-10-05', null, 120, 100),
    ('2026-10-06', null, 40, null),
    ('2026-10-08', '${BRANCH_B}', 20, 7);
  insert into public.milk_entries (farmer_id, quantity_liters, status, total_amount, entry_date)
    values ('${FF}', 9, 'rejected', null, '2026-10-05');
  insert into public.fuel_logs (vehicle_id, log_date, fuel_cost, approval_status) values
    (null, '2026-10-02', 50, 'approved'),
    (null, '2026-10-03', 80, 'pending'),
    ('${vehB}', '2026-10-04', 999, 'approved');
  insert into public.generator_logs (log_date, diesel_cost, approval_status, branch_id) values
    ('2026-10-02', 30, 'approved', null),
    ('2026-10-03', 70, 'pending', null),
    ('2026-10-04', 4, 'approved', '${BRANCH_B}');
  insert into public.maintenance_logs (service_date, cost, status, branch_id) values
    ('2026-10-02', 20, 'approved', null),
    ('2026-10-03', 40, 'pending', null),
    ('2026-10-04', 6, 'approved', '${BRANCH_B}');
  insert into public.milk_route_collections (collection_date, shortage_liters, branch_id) values
    ('2026-10-02', 5, null),
    ('2026-10-02', -4, null),
    ('2026-10-04', 8, '${BRANCH_B}');
  insert into public.salary_payments (pay_month, pay_year, net_salary) values (10, 2026, 1000), (9, 2026, 5000);
  insert into public.monthly_expenses (expense_month, expense_year, amount, category) values
    (10, 2026, 15, 'electricity'),
    (10, 2026, 7, 'chiller_maintenance'),
    (9, 2026, 99, 'electricity');
`);
const bill = (await db.query(`select public.fn_dairy_month_pnl(2026, 10, null) as r`)).rows[0].r;
assert.equal(bill.company_name, "Wasela Pakistan");
assert.equal(num(bill.service_rate), 10);
assert.equal(num(bill.accepted_liters), 107);
assert.equal(num(bill.gross_income), 1070);
assert.equal(num(bill.petrol_cost), 1049);
assert.equal(num(bill.diesel_cost), 34);
assert.equal(num(bill.maintenance_cost), 26);
assert.equal(num(bill.shortage_liters), 13);
assert.equal(num(bill.shortage_loss), 1885);
assert.equal(num(bill.standard_rate), 145);
assert.equal(num(bill.staff_salaries), 1000);
assert.equal(num(bill.electricity), 15);
assert.equal(num(bill.chiller_maintenance), 7);
const branchBill = (await db.query(`select public.fn_dairy_month_pnl(2026, 10, '${BRANCH_B}') as r`)).rows[0].r;
assert.equal(num(branchBill.petrol_cost), 999);
assert.equal(num(branchBill.diesel_cost), 4);
assert.equal(num(branchBill.maintenance_cost), 6);
assert.equal(num(branchBill.shortage_liters), 8);
assert.equal(num(branchBill.staff_salaries), 0);
assert.equal(num(branchBill.accepted_liters), 7);
assert.equal(num(branchBill.gross_income), 70);
const otherBranch = (await db.query(`select public.fn_dairy_month_pnl(2026, 10, '${BRANCH_C}') as r`)).rows[0].r;
assert.equal(num(otherBranch.petrol_cost), 0);
assert.equal(num(otherBranch.gross_income), 0);
assert.equal(num(otherBranch.accepted_liters), 0);
await run(`update public.company_billing_settings set service_rate_per_liter = null`);
await throws(`select public.fn_dairy_month_pnl(2026, 10, null)`, /Service rate/, "H6 missing rate");
await run(`update public.company_billing_settings set service_rate_per_liter = 10`);
await run(`update public.milk_rate_settings set standard_rate = null`);
await throws(`select public.fn_dairy_month_pnl(2026, 10, null)`, /Doodh ka rate/, "M3 missing milk rate");
await throws(`select public.fn_apply_milk_fat('${bId}', 4, '${OTHER}', false)`, /Doodh ka rate/, "M3 fat without rate");
await run(`update public.milk_rate_settings set standard_rate = 145`);
await run(`select public.fn_apply_milk_fat('${bId}', 4, '${OTHER}', false)`);
assert.equal(await one(`select status from public.milk_entries where id='${bId}'`), "priced");
pass("C2+H5+H6+M3 bill uses accepted litres and approved costs only");

console.log(`dairy-review-sql: ${ok} passed`);

