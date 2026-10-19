// Real SQL test: 569-571 (nasal-kashi, sehat, yaad-dihani, admin) PGlite par -- live DB nahi.
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const run = (s) => db.exec(s);
const one = async (s) => Object.values((await db.query(s)).rows[0] ?? {})[0];
const rows = async (s) => (await db.query(s)).rows;
const reset = "reset role; select set_config('test.uid','',false);";
const as = (u) => `set role authenticated; select set_config('test.uid','${u}',false);`;
const throws = async (s, re, msg) => {
  let err = null;
  try { await run(s); } catch (e) { err = e; }
  await run(reset);
  assert.ok(err, `expected error: ${msg}`);
  if (re) assert.match(String(err.message), re, msg);
};
const mig = (f) => fs.readFileSync(`supabase/migrations/${f}.sql`, "utf8");
await run(fs.readFileSync("tests/sql/portal-dairy-stubs.sql", "utf8"));
await run(fs.readFileSync("tests/sql/portal-dairy-pl-stubs.sql", "utf8"));
for (const f of ["566_dairy_animals", "567_dairy_milk_yields", "568_dairy_herd_seed_helper", "574_dairy_photos", "575_dairy_expenses", "576_dairy_income", "577_dairy_pnl", "578_dairy_admin_totals"]) await run(mig(f));
const NEW = ["569_dairy_breeding", "570_dairy_health", "571_dairy_reminders"].map(mig);
for (const m of NEW) { await run(m); }
for (const m of NEW) { await run(m); } // dobara chalana mehfooz (idempotent)
let ok = 0; const pass = (n) => { ok++; console.log(`  ok  ${n}`); };
for (const m of NEW) {
  assert.doesNotMatch(m, /\bdrop\s+table\b|\btruncate\b|\bdelete\s+from\b|\balter\s+table\s+public\.(farmers|milk_entries|milk_payments|pos_sales|pos_sale_items|dairy_animals|dairy_milk_yields)\b/i);
  assert.doesNotMatch(m.replace(/--.*$/gm, ""), /whatsapp|\bsms\b|net\.http|http_post/i); // comments mein sirf "nahi" likha hai
}
pass("additive only; ERP tables untouched; no WhatsApp/SMS/http anywhere");

const UA = "00000000-0000-0000-0000-0000000000a1", UB = "00000000-0000-0000-0000-0000000000b1", US = "00000000-0000-0000-0000-0000000000c1", UO = "00000000-0000-0000-0000-0000000000d1";
const FA = "00000000-0000-0000-0000-00000000f00a", FB = "00000000-0000-0000-0000-00000000f00b";
const CA = "00000000-0000-0000-0000-00000000c00a", SV = "00000000-0000-0000-0000-0000000005a1";
await run(`insert into farmers (id,user_id,full_name,farmer_code,village) values ('${FA}','${UA}','A','FRM-1','Chak 1'),('${FB}','${UB}','B','FRM-2','Chak 2');
insert into profiles (id, role, is_active) values ('${US}','sales_staff',true),('${UO}','owner',true),('${UA}','farmer',true),('${UB}','farmer',true);
insert into customers (id, farmer_id, name) values ('${CA}','${FA}','A dukaan');
insert into shops values ('${SV}','Vets','vet');
insert into products (id,name,category_id) values ('00000000-0000-0000-0000-0000000d0003','Semen straw',null),('00000000-0000-0000-0000-0000000d0004','Oxytet',null);
insert into pos_sales (id, shop_id, customer_id) values ('00000000-0000-0000-0000-0000000aa002','${SV}','${CA}');
insert into pos_sale_items (id, sale_id, product_id, quantity, unit_price, subtotal) values
  ('00000000-0000-0000-0000-00000000b003','00000000-0000-0000-0000-0000000aa002','00000000-0000-0000-0000-0000000d0003',1,800,800),
  ('00000000-0000-0000-0000-00000000b005','00000000-0000-0000-0000-0000000aa002','00000000-0000-0000-0000-0000000d0004',1,870,870);`);
const RANI = "00000000-0000-0000-0000-0000000a0001", GORI = "00000000-0000-0000-0000-0000000a0002", BHAINS = "00000000-0000-0000-0000-0000000a0003", BULL = "00000000-0000-0000-0000-0000000a0004", KAJAL = "00000000-0000-0000-0000-0000000a0005", BANI = "00000000-0000-0000-0000-0000000b0001";
await run(`${as(UA)} insert into dairy_animals (id, farmer_id, tag_no, name, species, sex, status, lactation_no, last_calving_date, dob) values
  ('${RANI}','${FA}','104','Rani','cow','F','milking',2, current_date-100, current_date-1500),
  ('${GORI}','${FA}','117','Gori','cow','F','milking',3, current_date-300, current_date-2000),
  ('${BHAINS}','${FA}','201','Kali','buffalo','F','milking',1, current_date-90, current_date-1800),
  ('${BULL}','${FA}','300','Raja','cow','M','bull',0, null, current_date-1000),
  ('${KAJAL}','${FA}','129','Kajal','cow','F','heifer',0, null, current_date-400); ${reset}`);
await run(`${as(UB)} insert into dairy_animals (id, farmer_id, tag_no) values ('${BANI}','${FB}','1'); ${reset}`);

// ---- 569 breeding
await run(`${as(UA)} insert into dairy_breeding_events (animal_id, farmer_id, event_type, event_date, heat_signs) values ('${RANI}','${FA}','heat', current_date-60, array['bellow','mucus']); ${reset}`);
await throws(`${as(UA)} insert into dairy_breeding_events (animal_id, farmer_id, event_type, heat_signs) values ('${RANI}','${FA}','heat', array['dance'])`, /check/, "unknown heat sign");
await throws(`${as(UA)} insert into dairy_breeding_events (animal_id, farmer_id, event_type) values ('${RANI}','${FA}','ai')`, /check/, "AI needs bull name");
await throws(`${as(UA)} insert into dairy_breeding_events (animal_id, farmer_id, event_type, bull_name, event_date) values ('${RANI}','${FA}','ai','X', current_date+1)`, /Aage/, "no future");
await throws(`${as(UA)} insert into dairy_breeding_events (animal_id, farmer_id, event_type, bull_name) values ('${BULL}','${FA}','ai','X')`, /maada/, "male cannot get AI");
await throws(`${as(UA)} insert into dairy_breeding_events (animal_id, farmer_id, event_type, bull_name) values ('${BANI}','${FA}','ai','X')`, /row-level/, "other farmer's animal");
await throws(`${as(UB)} insert into dairy_breeding_events (animal_id, farmer_id, event_type) values ('${RANI}','${FB}','heat')`, /row-level/, "B cannot write A's animal");
await throws(`${as(UA)} insert into dairy_breeding_events (animal_id, farmer_id, event_type, bull_name, event_date) values ('${KAJAL}','${FA}','ai','X', current_date-500)`, /Paidaish/, "before birth");
// AI with cost -> one vets expense (source breeding)
await run(`${as(UA)} insert into dairy_breeding_events (id, animal_id, farmer_id, event_type, event_date, bull_name, semen_breed, straw_no, technician, cost)
  values ('00000000-0000-0000-0000-0000000e0001','${RANI}','${FA}','ai', current_date-40, 'Raja-07','Sahiwal','SHW-1','Akram', 600); ${reset}`);
const S1 = "00000000-0000-0000-0000-0000000e0001";
assert.deepEqual((await rows(`select category, amount::int a, source, voided from dairy_expenses where source_ref='${S1}'`)).map((r) => [r.category, r.a, r.source, r.voided]), [["vets", 600, "breeding", false]]);
await throws(`${as(UA)} insert into dairy_expenses (farmer_id, category, amount, source, source_ref) values ('${FA}','vets',600,'breeding','${S1}')`, /waqia/, "fake breeding expense blocked");
await throws(`${as(UA)} update dairy_expenses set amount=1 where source_ref='${S1}'`, /waqia/, "auto expense not editable directly");
await run(`${as(UA)} update dairy_breeding_events set cost=650 where id='${S1}'; ${reset}`);
assert.equal(Number(await one(`select amount from dairy_expenses where source_ref='${S1}'`)), 650);
assert.equal(Number(await one(`select count(*) from dairy_expenses where source_ref='${S1}'`)), 1);
pass("breeding: guards (signs, bull, future, male, other farmer, dob); cost -> one locked vets row, edit follows");

// repro view: pd pending, windows
await run(as(UA));
let r = (await rows(`select * from v_dairy_repro_status where animal_id='${RANI}'`))[0];
await run(reset);
assert.equal(r.pd_pending, true); assert.equal(r.pregnant, false); assert.equal(r.services_lactation, 1);
assert.equal(String(r.gestation_days), "283");
await throws(`${as(UA)} insert into dairy_breeding_events (animal_id, farmer_id, event_type, pd_result) values ('${RANI}','${FA}','pd','positive')`, /check/, "PD needs service");
await throws(`${as(UA)} insert into dairy_breeding_events (animal_id, farmer_id, event_type, pd_result, service_id) values ('${GORI}','${FA}','pd','positive','${S1}')`, /juRna/, "PD must link own animal's service");
await run(`${as(UA)} insert into dairy_breeding_events (animal_id, farmer_id, event_type, pd_result, pd_method, service_id, cost) values ('${RANI}','${FA}','pd','positive','rectal','${S1}', 500); ${reset}`);
assert.equal(await one(`select status from dairy_animals where id='${RANI}'`), "pregnant");
await run(as(UA));
r = (await rows(`select *, (expected_calving - preg_service_date) gd, (expected_calving - dry_off_due) dd from v_dairy_repro_status where animal_id='${RANI}'`))[0];
await run(reset);
assert.equal(r.pregnant, true); assert.equal(Number(r.gd), 283); assert.equal(Number(r.dd), 60); assert.equal(Number(r.days_pregnant), 40); assert.equal(r.pd_pending, false);
// second open pregnancy blocked
await run(`${as(UA)} insert into dairy_breeding_events (id, animal_id, farmer_id, event_type, event_date, bull_name) values ('00000000-0000-0000-0000-0000000e0002','${RANI}','${FA}','ai', current_date-5, 'Y'); ${reset}`);
await throws(`${as(UA)} insert into dairy_breeding_events (animal_id, farmer_id, event_type, pd_result, service_id) values ('${RANI}','${FA}','pd','positive','00000000-0000-0000-0000-0000000e0002')`, /pehle se khula/, "two open pregnancies");
// buffalo 310
await run(`${as(UA)} insert into dairy_breeding_events (id, animal_id, farmer_id, event_type, event_date, bull_name) values ('00000000-0000-0000-0000-0000000e0003','${BHAINS}','${FA}','ai', current_date-50, 'Nili-Ravi 3');
  insert into dairy_breeding_events (animal_id, farmer_id, event_type, pd_result, service_id) values ('${BHAINS}','${FA}','pd','positive','00000000-0000-0000-0000-0000000e0003'); ${reset}`);
await run(as(UA));
assert.equal(Number(await one(`select expected_calving - preg_service_date from v_dairy_repro_status where animal_id='${BHAINS}'`)), 310);
await run(reset);
pass("repro view: PD window, pregnant after +PD, cow 283 / buffalo 310, dry-off -60, one open pregnancy");

// calving RPC: calf created linked to mother, lactation +1
await run(`${as(UA)} select fn_dairy_record_calving('${RANI}', current_date, '${S1}', 'easy', '{"tag_no":"140","name":"Pari","sex":"F","alive":true}'::jsonb, 'aasaan'); ${reset}`);
const calf = (await rows(`select * from dairy_animals where tag_no='140'`))[0];
assert.equal(calf.dam_id, RANI); assert.equal(calf.status, "calf"); assert.equal(calf.sire_text, "Raja-07"); assert.equal(calf.farmer_id, FA);
const rani = (await rows(`select lactation_no, status, (last_calving_date = current_date) today from dairy_animals where id='${RANI}'`))[0];
assert.deepEqual([rani.lactation_no, rani.status, rani.today], [3, "milking", true]);
await throws(`${as(UA)} select fn_dairy_record_calving('${GORI}', current_date, null, 'easy', '{"tag_no":"140","alive":true}'::jsonb)`, /duplicate|unique/, "duplicate calf tag rejected");
await run(`${as(UA)} select fn_dairy_record_calving('${GORI}', current_date-1, null, 'vet', '{"tag_no":"141","alive":false}'::jsonb); ${reset}`);
assert.equal(Number(await one(`select count(*) from dairy_animals where tag_no='141'`)), 0);
assert.equal(Number(await one(`select lactation_no from dairy_animals where id='${GORI}'`)), 4);
await throws(`${as(UB)} select fn_dairy_record_calving('${RANI}', current_date, null, 'easy', '{}'::jsonb)`, /aap ka nahi/, "B cannot record A's calving");
// void calving -> lactation back
await run(`${as(UA)} update dairy_breeding_events set voided=true, void_reason='ghalat janwar' where animal_id='${GORI}' and event_type='calving'; ${reset}`);
assert.equal(Number(await one(`select lactation_no from dairy_animals where id='${GORI}'`)), 3);
await run(as(UA));
assert.equal(await one(`select pregnant from v_dairy_repro_status where animal_id='${RANI}'`), false);
await run(reset);
pass("calving: calf as new animal (dam + sire), lactation +1, dead calf no animal, dup tag blocked, void restores");

await throws(`${as(UA)} delete from dairy_breeding_events`, /permission denied/, "no delete");
await throws(`${as(UA)} update dairy_breeding_events set event_date=current_date-2 where id='${S1}'`, /badli nahi/, "date locked");
await run(`${as(UA)} update dairy_breeding_events set voided=true, void_reason='ghalat indraaj' where id='00000000-0000-0000-0000-0000000e0002'; ${reset}`);
await throws(`set role anon; select * from dairy_breeding_events`, /permission denied/, "anon blocked");
await run(as(UB)); assert.equal(Number(await one(`select count(*) from dairy_breeding_events`)), 0); assert.equal(Number(await one(`select count(*) from v_dairy_repro_status`)), 1); await run(reset);
await run(as(US)); assert.ok(Number(await one(`select count(*) from dairy_breeding_events`)) > 3); await run(reset);
await throws(`${as(US)} insert into dairy_breeding_events (animal_id, farmer_id, event_type) values ('${RANI}','${FA}','heat')`, /row-level/, "staff read-only");
pass("RLS: own only, staff read, anon none, no delete, date locked");

// AI linked to shop semen -> no new row; P&L once
await run(`${as(UA)} select fn_dairy_add_from_shop('00000000-0000-0000-0000-00000000b003'); ${reset}`);
const shopExp = await one(`select id from dairy_expenses where source_ref='00000000-0000-0000-0000-00000000b003'`);
await run(`${as(UA)} insert into dairy_breeding_events (id, animal_id, farmer_id, event_type, event_date, bull_name, cost, expense_id) values ('00000000-0000-0000-0000-0000000e0009','${GORI}','${FA}','ai', current_date, 'Sultan-12', 800, '${shopExp}'); ${reset}`);
assert.equal(Number(await one(`select count(*) from dairy_expenses where source_ref='00000000-0000-0000-0000-0000000e0009'`)), 0);
assert.equal(await one(`select expense_id from dairy_breeding_events where id='00000000-0000-0000-0000-0000000e0009'`), shopExp);
await throws(`${as(UA)} insert into dairy_breeding_events (animal_id, farmer_id, event_type, bull_name, expense_id) values ('${GORI}','${FA}','natural','Z','${shopExp}')`, /juRa/, "same shop expense cannot link twice");
const vetsToday = Number(await one(`select coalesce(sum(amount),0) from dairy_expenses where not voided and category='vets' and expense_date=current_date`));
assert.equal(vetsToday, 1300); // dukaan semen 800 + PD 500 -- semen dobara nahi
pass("cost no double count: shop-linked event adds nothing; link once only");

// ---- 570 health
await throws(`${as(UA)} insert into dairy_health_events (farmer_id, kind) values ('${FA}','vaccine')`, /check/, "vaccine needs code");
await throws(`${as(UA)} insert into dairy_health_events (farmer_id, kind, animal_id) values ('${FA}','treatment','${RANI}')`, /check/, "treatment needs medicine");
await throws(`${as(UA)} insert into dairy_health_events (farmer_id, kind, animal_id, medicine) values ('${FA}','treatment','${BANI}','X')`, /isi kisan/, "other farmer animal");
await run(`${as(UA)} insert into dairy_health_events (farmer_id, kind, vaccine_code, event_date, cost) values ('${FA}','vaccine','FMD', current_date-10, 2000); ${reset}`);
const fmd = (await rows(`select id, (next_due - event_date) gap, expense_id from dairy_health_events where vaccine_code='FMD'`))[0];
assert.ok(Number(fmd.gap) >= 181 && Number(fmd.gap) <= 184, "FMD next due +6 months");
assert.equal(Number(await one(`select count(*) from dairy_health_event_animals where event_id='${fmd.id}'`)), 5); // 5 janwar (aaj paida bachhi nahi)
pass("health: guards; FMD herd round fans out to animals alive then; next due +6m; cost row");

// treatment with withdrawal -> milk withheld forced inside window
await run(`${as(UA)} insert into dairy_health_events (id, farmer_id, animal_id, kind, diagnosis, medicine, event_date, last_dose_date, withdrawal_days, cost, vet_name)
  values ('00000000-0000-0000-0000-0000000f0001','${FA}','${GORI}','treatment','Thanela','Oxytet', current_date-7, current_date-5, 8, 1450, 'Dr. Imran'); ${reset}`);
assert.equal(Number(await one(`select withdrawal_until - current_date from dairy_health_events where id='00000000-0000-0000-0000-0000000f0001'`)), 3);
await run(`${as(UA)} insert into dairy_milk_yields (animal_id, farmer_id, shift, liters, withheld) values ('${GORI}','${FA}','am',7,false); ${reset}`);
assert.equal(await one(`select withheld from dairy_milk_yields where animal_id='${GORI}' and yield_date=current_date and shift='am'`), true);
await run(`${as(UA)} update dairy_milk_yields set withheld=false where animal_id='${GORI}' and shift='am'; ${reset}`);
assert.equal(await one(`select withheld from dairy_milk_yields where animal_id='${GORI}' and shift='am'`), true, "cannot unset inside window");
await run(`${as(UA)} select fn_dairy_bulk_milk(current_date, 'pm', '[{"animal_id":"${GORI}","liters":5,"withheld":false},{"animal_id":"${BHAINS}","liters":6}]'::jsonb); ${reset}`);
assert.deepEqual((await rows(`select a.tag_no, y.withheld from dairy_milk_yields y join dairy_animals a on a.id=y.animal_id where shift='pm' order by 1`)).map((x) => [x.tag_no, x.withheld]), [["117", true], ["201", false]]);
await run(`${as(UA)} insert into dairy_milk_yields (animal_id, farmer_id, yield_date, shift, liters) values ('${GORI}','${FA}',current_date-20,'am',6); ${reset}`);
assert.equal(await one(`select withheld from dairy_milk_yields where animal_id='${GORI}' and yield_date=current_date-20`), false, "before treatment not withheld");
pass("withdrawal: milk forced withheld in window (insert, update, bulk), free outside, other animals free");

// void health -> its expense voided; P&L drops
const hx = await one(`select expense_id from dairy_health_events where id='00000000-0000-0000-0000-0000000f0001'`);
assert.equal(Number(await one(`select amount from dairy_expenses where id='${hx}'`)), 1450);
await run(`${as(UA)} update dairy_health_events set voided=true, void_reason='ghalat janwar' where id='00000000-0000-0000-0000-0000000f0001'; ${reset}`);
assert.equal(await one(`select voided from dairy_expenses where id='${hx}'`), true);
await run(`${as(UA)} insert into dairy_milk_yields (animal_id, farmer_id, yield_date, shift, liters) values ('${GORI}','${FA}',current_date-1,'am',6); ${reset}`);
assert.equal(await one(`select withheld from dairy_milk_yields where animal_id='${GORI}' and yield_date=current_date-1`), false, "void lifts withdrawal");
// shop medicine link
await run(`${as(UA)} select fn_dairy_add_from_shop('00000000-0000-0000-0000-00000000b005'); ${reset}`);
const oxy = await one(`select id from dairy_expenses where source_ref='00000000-0000-0000-0000-00000000b005'`);
await run(`${as(UA)} insert into dairy_health_events (farmer_id, animal_id, kind, medicine, cost, expense_id, withdrawal_days) values ('${FA}','${KAJAL}','treatment','Oxytet', 870, '${oxy}', 0); ${reset}`);
await throws(`${as(UA)} insert into dairy_health_events (farmer_id, kind, medicine, expense_id) values ('${FA}','deworm','Albendazole','${shopExp}')`, /juRa/, "breeding-linked expense cannot link to health too");
await run(as(UA));
const pnl = JSON.parse(JSON.stringify(await one(`select fn_my_dairy_pnl(current_date-60, current_date, 'month')`)));
await run(reset);
const vets = pnl.reduce((s, p) => s + Number(p.expense?.vets ?? 0), 0);
assert.equal(vets, 650 + 500 + 800 + 2000 + 870, "P&L vets = AI 650 + PD 500 + semen 800 + FMD 2000 + oxytet 870 (void excluded, no duplicates)");
pass("health void cascades to expense + lifts withdrawal; shop medicine linked once; P&L vets exact");

// coverage
await run(as(UA));
const cov = Object.fromEntries((await rows(`select * from fn_my_vaccine_coverage()`)).map((c) => [c.code, [c.covered, c.eligible]]));
await run(reset);
assert.deepEqual(cov.FMD, [5, 5]); // bachhi Pari (aaj paida) 4 maah se chhoti -- eligible nahi
assert.deepEqual(cov.BQ, [0, 2]);  // BQ sirf 6 maah - 3 saal: Kajal + Raja
await throws(`${as(UA)} select * from fn_dairy_coverage_for('${FB}', current_date)`, /permission denied/, "internal coverage not callable");
pass("vaccine coverage: per code, age/species eligibility, internal helper locked");

// ---- 571 tasks
await run(`${as(UA)} insert into dairy_health_events (farmer_id, kind, medicine, event_date) values ('${FA}','deworm','Albendazole', current_date-100);
  insert into dairy_health_events (farmer_id, animal_id, kind, medicine, withdrawal_days) values ('${FA}','${BHAINS}','treatment','Penicillin', 4); ${reset}`);
await run(as(UA));
let tasks = await rows(`select * from fn_my_due_tasks(30)`);
await run(reset);
const kinds = (ts) => ts.map((x) => `${x.task}:${x.tag_no ?? x.info?.code ?? ''}:${x.severity}`).sort();
assert.deepEqual(kinds(tasks), ["deworm::overdue", "heat_watch:117:later", "vaccine_gap:BQ:later", "withheld:201:active"]);
assert.equal(tasks.find((x) => x.task === "withheld").info.medicine, "Penicillin");
await run(as(UB)); assert.equal((await rows(`select * from fn_my_due_tasks(30)`)).length, 0); await run(reset);
await throws(`${as(UA)} select * from fn_dairy_due_tasks_for('${FB}', current_date, 30)`, /permission denied/, "internal task fn locked");
await throws(`${as(US)} select * from fn_my_due_tasks(30)`, /Sirf kisan/, "staff has no own tasks");
// PD khirki (35-45 din) khuli ho to "aaj", band hone ke baad "overdue" (rollback -- baqi test par asar nahi)
await run(`begin; insert into dairy_breeding_events (farmer_id, animal_id, event_type, event_date, bull_name) values ('${FA}','${KAJAL}','ai', current_date-40, 'SPU-1');`);
const pdNow = (await rows(`select severity from fn_dairy_due_tasks_for('${FA}', current_date, 30) where task='pd_due' and animal_id='${KAJAL}'`)).map((x) => x.severity);
const pdLate = (await rows(`select severity from fn_dairy_due_tasks_for('${FA}', current_date+8, 30) where task='pd_due' and animal_id='${KAJAL}'`)).map((x) => x.severity);
await run(`rollback;`);
assert.deepEqual(pdNow, ["today"]); assert.deepEqual(pdLate, ["overdue"]);
pass("due tasks: heat watch, vaccine gap, deworm overdue, milk withheld; own only; internals locked; PD window");

// admin (before marking tasks)
await throws(`${as(US)} select * from fn_admin_breeding_totals(current_date)`, /Admin/, "sales staff denied");
await throws(`${as(UA)} select * from fn_admin_breeding_totals(current_date)`, /Admin/, "farmer denied");
await run(as(UO));
const adm = await rows(`select * from fn_admin_breeding_totals(current_date)`);
const up = await rows(`select * from fn_admin_breeding_upcoming(current_date, 300)`);
await run(reset);
const a1 = adm.find((x) => x.farmer_code === "FRM-1");
assert.deepEqual([a1.animals, a1.pregnant, a1.calvings_30, Number(a1.conception_pct), a1.services_known, Number(a1.fmd_pct), Number(a1.bq_pct), a1.withheld, a1.overdue, a1.customer_name],
  [6, 1, 0, 100, 2, 100, 0, 1, 1, "A dukaan"]);
assert.equal(adm.length, 2);
assert.deepEqual(up.map((x) => x.tag_no), ["201"]);
pass("admin: per-farmer totals (pregnant, conception, coverage, withheld, overdue); upcoming calvings; staff/farmer denied");

const key = (t) => tasks.find((x) => x.task === t).task_key;
await throws(`${as(UA)} select fn_dairy_task_set('${key("vaccine_gap")}', 'not_applicable', '')`, /Wajah/, "n/a needs reason");
await throws(`${as(UA)} select fn_dairy_task_set('${key("deworm")}', 'muted')`, /Ghalat/, "only prefs can be muted");
await run(`${as(UA)} select fn_dairy_task_set('${key("deworm")}', 'done'); select fn_dairy_task_set('${key("vaccine_gap")}', 'snoozed'); select fn_dairy_task_set('pref:heat_watch', 'muted'); ${reset}`);
await run(as(UA)); assert.deepEqual(kinds(await rows(`select * from fn_my_due_tasks(30)`)), ["withheld:201:active"]); await run(reset);
await run(`${as(UA)} select fn_dairy_task_set('pref:heat_watch', 'active'); ${reset}`);
await run(as(UA)); assert.deepEqual(kinds(await rows(`select * from fn_my_due_tasks(30)`)), ["heat_watch:117:later", "withheld:201:active"]); await run(reset);
await throws(`${as(UA)} insert into dairy_task_state (farmer_id, task_key, state) values ('${FA}','x:y','done')`, /permission denied/, "state only via RPC");
pass("task actions: done, snooze (till tomorrow), mute/unmute type, n/a needs reason; table write only via RPC");

// sweep (cron) -> in-app only, idempotent per day
const n1 = Number(await one(`select fn_dairy_reminder_sweep()`));
const n2 = Number(await one(`select fn_dairy_reminder_sweep()`));
assert.ok(n1 >= 1); assert.equal(n2, 0);
await run(as(UA)); assert.equal(Number(await one(`select count(*) from dairy_reminders`)), n1); assert.equal(Number(await one(`select fn_dairy_reminders_seen()`)), n1); await run(reset);
await run(as(UB)); assert.equal(Number(await one(`select count(*) from dairy_reminders`)), 0); await run(reset);
await throws(`${as(UA)} select fn_dairy_reminder_sweep()`, /permission denied/, "farmer cannot run sweep");
pass("reminder sweep: in-app rows only, once per day, own only, not callable by users");

console.log(`portal-breeding-sql: ${ok} passed`);
