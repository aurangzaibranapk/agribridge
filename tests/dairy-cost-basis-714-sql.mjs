// 714: lagat/litre — ghar agar > 0, warna centre. Dono jama nahi. PGlite. Live/Testing DB nahi.
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const run = (s) => db.exec(s);
const one = async (s) => (await db.query(s)).rows[0];
const mig = (f) => fs.readFileSync(`supabase/migrations/${f}.sql`, "utf8");
await run(fs.readFileSync("tests/sql/portal-dairy-stubs.sql", "utf8"));
await run(fs.readFileSync("tests/sql/portal-dairy-pl-stubs.sql", "utf8"));
for (const f of ["566_dairy_animals", "567_dairy_milk_yields", "575_dairy_expenses", "576_dairy_income", "577_dairy_pnl", "578_dairy_admin_totals"]) {
  await run(mig(f));
}
const M = mig("714_dairy_cost_per_litre_basis");
assert.doesNotMatch(M, /\bdrop\s+table\b|\btruncate\b|\bdelete\s+from\b/i);
await run(M);
await run(M);

const UO = "00000000-0000-0000-0000-0000000000d1";
const FH = "00000000-0000-0000-0000-00000000f0a1";
const FC = "00000000-0000-0000-0000-00000000f0b1";
const FB = "00000000-0000-0000-0000-00000000f0c1";
const FZ = "00000000-0000-0000-0000-00000000f0d1";
const AH = "00000000-0000-0000-0000-0000000aa0a1";
const AB = "00000000-0000-0000-0000-0000000aa0b1";
await run(`insert into profiles (id, role, is_active) values ('${UO}','owner',true);
insert into farmers (id, full_name, farmer_code) values
  ('${FH}','Home','FRM-H'),('${FC}','Centre','FRM-C'),('${FB}','Both','FRM-B'),('${FZ}','Zero','FRM-Z');
insert into dairy_animals (id, farmer_id, tag_no) values ('${AH}','${FH}','H1'),('${AB}','${FB}','B1');
insert into dairy_milk_yields (animal_id, farmer_id, shift, liters) values
  ('${AH}','${FH}','am',40),('${AB}','${FB}','am',20);
insert into dairy_expenses (farmer_id, category, amount) values
  ('${FH}','wanda',2000),('${FC}','chara',4000),('${FB}','khal',3000),('${FZ}','vets',500);
insert into milk_entries (farmer_id, entry_date, shift, quantity_liters, total_amount) values
  ('${FC}', current_date, 'morning', 80, 12000),
  ('${FB}', current_date, 'morning', 100, 15000);`);

const last = (raw) => {
  const rows = typeof raw === "string" ? JSON.parse(raw) : raw;
  return rows[rows.length - 1];
};
const pnl = async (id) => {
  const row = await one(`select fn_dairy_pnl_for('${id}', current_date, current_date, 'month') as j`);
  return last(row.j);
};

const home = await pnl(FH);
assert.equal(Number(home.litres_home), 40);
assert.equal(Number(home.litres_centre), 0);
assert.equal(home.cost_basis, "home");
assert.equal(Number(home.cost_per_litre), 50);
assert.equal(Number(home.litres), 40);

const centre = await pnl(FC);
assert.equal(Number(centre.litres_home), 0);
assert.equal(Number(centre.litres_centre), 80);
assert.equal(centre.cost_basis, "centre");
assert.equal(Number(centre.cost_per_litre), 50);
assert.notEqual(Number(centre.cost_per_litre), null);

const both = await pnl(FB);
assert.equal(Number(both.litres_home), 20);
assert.equal(Number(both.litres_centre), 100);
assert.equal(both.cost_basis, "home");
assert.equal(Number(both.cost_per_litre), 150);
assert.notEqual(Number(both.cost_per_litre), 25);

const zero = await pnl(FZ);
assert.equal(Number(zero.litres_home), 0);
assert.equal(Number(zero.litres_centre), 0);
assert.equal(zero.cost_basis, null);
assert.equal(zero.cost_per_litre, null);

await run(`set role authenticated; select set_config('test.uid','${UO}',false);`);
const tot = (await db.query(`select farmer_code, litres_home, litres_centre, cost_basis, cost_per_litre from fn_admin_dairy_totals(current_date, current_date)`)).rows;
await run(`reset role; select set_config('test.uid','',false);`);
const by = Object.fromEntries(tot.map((r) => [r.farmer_code, r]));
assert.equal(by["FRM-H"].cost_basis, "home");
assert.equal(Number(by["FRM-H"].cost_per_litre), 50);
assert.equal(by["FRM-C"].cost_basis, "centre");
assert.equal(Number(by["FRM-C"].litres_home), 0);
assert.equal(Number(by["FRM-C"].litres_centre), 80);
assert.equal(Number(by["FRM-C"].cost_per_litre), 50);
assert.equal(by["FRM-B"].cost_basis, "home");
assert.equal(Number(by["FRM-B"].cost_per_litre), 150);
assert.equal(by["FRM-Z"].cost_basis, null);
assert.equal(by["FRM-Z"].cost_per_litre, null);

await run(fs.readFileSync("supabase/migrations/714_dairy_cost_per_litre_basis.rollback.sql", "utf8"));
const rolled = await pnl(FC);
assert.equal(rolled.cost_basis, undefined);
assert.equal(rolled.cost_per_litre, null);
assert.equal(Number(rolled.litres), 0);

console.log("dairy-cost-basis-714-sql: ok");
