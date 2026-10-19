// Real SQL test: 566-568 (portal Dairy) PGlite par -- live DB nahi.
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const run = (s) => db.exec(s);
const one = async (s, p = []) => Object.values((await db.query(s, p)).rows[0] ?? {})[0];
const throws = async (s, re, msg) => {
  let err = null;
  try { await run(s); } catch (e) { err = e; }
  assert.ok(err, `expected error: ${msg}`);
  if (re) assert.match(String(err.message), re, msg);
  await run("reset role; select set_config('test.uid','',false)");
};
const M = ["566_dairy_animals", "567_dairy_milk_yields", "568_dairy_herd_seed_helper"].map((f) => fs.readFileSync(`supabase/migrations/${f}.sql`, "utf8"));
await run(fs.readFileSync("tests/sql/portal-dairy-stubs.sql", "utf8"));
for (const m of M) { await run(m); await run(m); } // idempotent
let ok = 0; const pass = (n) => { ok++; console.log(`  ok  ${n}`); };

for (const m of M) assert.doesNotMatch(m, /\bdrop\s+table\b|\btruncate\b|\bdelete\s+from\b|\balter\s+table\s+public\.(farmers|milk_entries)\b/i);
pass("additive only (no drop/truncate/delete, ERP tables untouched)");

const UA = "00000000-0000-0000-0000-0000000000a1", UB = "00000000-0000-0000-0000-0000000000b1", US = "00000000-0000-0000-0000-0000000000c1";
const FA = "00000000-0000-0000-0000-00000000f00a", FB = "00000000-0000-0000-0000-00000000f00b";
await run(`insert into farmers (id,user_id,full_name,cow_count) values ('${FA}','${UA}','A',10),('${FB}','${UB}','B',3);
insert into profiles values ('${US}','admin',true),('${UA}','farmer',true);
insert into farms (id,farmer_id,name) values ('00000000-0000-0000-0000-0000000fa00b','${FB}','B farm');
insert into milk_entries (farmer_id,entry_date,shift,quantity_liters,rate_per_liter) values ('${FA}',current_date,'morning',30,180),('${FA}',current_date,'evening',25,180),('${FB}',current_date,'morning',99,180);`);
const as = (u) => `set role authenticated; select set_config('test.uid','${u}',false);`;
const reset = "reset role; select set_config('test.uid','',false);";

// Kisan A apna janwar banata hai
await run(`${as(UA)} insert into dairy_animals (farmer_id, tag_no, name, breed) values ('${FA}',' 104 ','Rani','Sahiwal'); ${reset}`);
assert.equal(await one(`select tag_no from dairy_animals`), "104");
pass("farmer adds own animal (tag trimmed)");
await throws(`${as(UA)} insert into dairy_animals (farmer_id, tag_no) values ('${FB}','x1')`, /row-level security/, "cannot add for another farmer");
await throws(`${as(UA)} insert into dairy_animals (farmer_id, tag_no) values ('${FA}','104')`, /duplicate|unique/, "tag unique per farmer");
await run(`${as(UB)} insert into dairy_animals (farmer_id, tag_no, name) values ('${FB}','104','B ki gaye'); ${reset}`);
pass("same tag allowed for a different farmer; cross-farmer insert blocked; duplicate tag blocked");

await run(as(UB));
assert.equal(Number(await one(`select count(*) from dairy_animals`)), 1);
assert.equal(await one(`select name from dairy_animals`), "B ki gaye");
await run(reset);
await run(as(UA));
const RANI = await one(`select id from dairy_animals where name='Rani'`);
await run(`update dairy_animals set name='hack' where farmer_id='${FB}'`);
await run(reset);
assert.equal(await one(`select name from dairy_animals where farmer_id='${FB}'`), "B ki gaye");
pass("farmer sees/updates only own animals (RLS)");

await throws(`${as(UA)} delete from dairy_animals where id='${RANI}'`, /permission denied/, "no delete for farmer");
await throws(`delete from dairy_animals where id='${RANI}'`, /delete nahi/, "trigger blocks delete even for owner role");
pass("no deletes (grant revoked + trigger)");

const BID = await one(`select id from dairy_animals where farmer_id='${FB}'`);
await throws(`${as(UA)} insert into dairy_animals (farmer_id, tag_no, dam_id) values ('${FA}','105','${BID}')`, /Maa/, "dam must be own");
await throws(`${as(UA)} insert into dairy_animals (farmer_id, tag_no, farm_id) values ('${FA}','106','00000000-0000-0000-0000-0000000fa00b')`, /Farm/, "farm must be own");
pass("dam and farm must belong to the same farmer");

// anon
await throws(`set role anon; select * from dairy_animals`, /permission denied/, "anon blocked animals");
await throws(`set role anon; select * from dairy_milk_yields`, /permission denied/, "anon blocked yields");
for (const f of ["fn_my_milk_collection(date,date)", "fn_dairy_bulk_milk(date,text,jsonb)", "fn_staff_seed_animals_from_cow_count(uuid)", "fn_dairy_my_farmer_id()"])
  assert.equal(await one(`select has_function_privilege('anon','public.${f}','execute')`), false, f);
pass("anon blocked from tables and functions");

// Milk
await run(`${as(UA)} insert into dairy_milk_yields (animal_id, farmer_id, shift, liters) values ('${RANI}','${FA}','am',5.2); ${reset}`);
await throws(`${as(UA)} insert into dairy_milk_yields (animal_id, farmer_id, shift, liters) values ('${RANI}','${FA}','am',6)`, /duplicate|unique/, "one per animal/date/shift");
await throws(`${as(UA)} insert into dairy_milk_yields (animal_id, farmer_id, shift, liters) values ('${BID}','${FA}','am',6)`, /row-level|aap ka/, "cannot log milk for B's animal");
await throws(`${as(UA)} insert into dairy_milk_yields (animal_id, farmer_id, yield_date, shift, liters) values ('${RANI}','${FA}',current_date+1,'pm',6)`, /Aage/, "no future date");
await throws(`${as(UA)} insert into dairy_milk_yields (animal_id, farmer_id, shift, liters) values ('${RANI}','${FA}','pm',80)`, /check/, "liters cap");
pass("milk: unique shift, own animal only, no future, sane litres");

await run(`${as(UA)} select fn_dairy_bulk_milk(current_date,'pm','[{"animal_id":"${RANI}","liters":4.1,"fat":4.2},{"animal_id":"${RANI}","liters":""}]'::jsonb); ${reset}`);
await run(`${as(UA)} select fn_dairy_bulk_milk(current_date,'am','[{"animal_id":"${RANI}","liters":5.5}]'::jsonb); ${reset}`);
assert.equal(Number(await one(`select total from v_dairy_animal_daily where animal_id='${RANI}'`)), 9.6);
await throws(`${as(UA)} select fn_dairy_bulk_milk(current_date,'am','[{"animal_id":"${BID}","liters":5}]'::jsonb)`, /aap ka/, "bulk rejects other's animal");
await throws(`${as(US)} select fn_dairy_bulk_milk(current_date,'am','[]'::jsonb)`, /Sirf kisan/, "bulk only for farmers");
await run(as(UB));
assert.equal(Number(await one(`select count(*) from v_dairy_herd_daily`)), 0, "B sees no A milk in view");
await run(reset);
pass("bulk upsert works, views respect RLS");

await run(as(UA));
const rows = (await db.query(`select * from fn_my_milk_collection(null,null)`)).rows;
await run(reset);
assert.equal(rows.length, 1);
assert.equal(Number(rows[0].am), 30); assert.equal(Number(rows[0].pm), 25);
assert.ok(!("rate_per_liter" in rows[0]));
pass("ERP collection: own rows only, read-only, no rates");

// Sold animal: no new milk; no delete of milk
await run(`${as(UA)} update dairy_animals set status='sold' where id='${RANI}'; ${reset}`);
await throws(`${as(UA)} insert into dairy_milk_yields (animal_id, farmer_id, yield_date, shift, liters) values ('${RANI}','${FA}',current_date-1,'am',3)`, /Bika/, "sold blocks milk");
await throws(`${as(UA)} delete from dairy_milk_yields`, /permission denied/, "no milk delete");
pass("sold/dead blocks new milk; milk cannot be deleted");

// 568 staff only
await throws(`${as(UA)} select fn_staff_seed_animals_from_cow_count('${FA}')`, /Sirf staff/, "farmer cannot seed");
await run(as(US));
assert.equal(Number(await one(`select fn_staff_seed_animals_from_cow_count('${FA}')`)), 9);
assert.equal(Number(await one(`select fn_staff_seed_animals_from_cow_count('${FA}')`)), 0);
await run(reset);
assert.equal(Number(await one(`select count(*) from dairy_animals where farmer_id='${FA}'`)), 10);
pass("568: staff-only, fills up to cow_count, idempotent");

console.log(`portal-dairy-sql: ${ok} passed`);
