// Real SQL test: 574-578 (Dairy hisaab, tasveer, admin) PGlite par -- live DB nahi.
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const run = (s) => db.exec(s);
const one = async (s) => Object.values((await db.query(s)).rows[0] ?? {})[0];
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
for (const f of ["566_dairy_animals", "567_dairy_milk_yields", "568_dairy_herd_seed_helper"]) await run(mig(f));
const NEW = ["574_dairy_photos", "575_dairy_expenses", "576_dairy_income", "577_dairy_pnl", "578_dairy_admin_totals"].map(mig);
for (const m of NEW) { await run(m); await run(m); }
let ok = 0; const pass = (n) => { ok++; console.log(`  ok  ${n}`); };
for (const m of NEW) assert.doesNotMatch(m, /\bdrop\s+table\b|\btruncate\b|\bdelete\s+from\b|\balter\s+table\s+public\.(farmers|milk_entries|milk_payments|pos_sales|pos_sale_items)\b/i);
pass("additive only; ERP tables untouched");

const UA = "00000000-0000-0000-0000-0000000000a1", UB = "00000000-0000-0000-0000-0000000000b1", US = "00000000-0000-0000-0000-0000000000c1", UO = "00000000-0000-0000-0000-0000000000d1";
const FA = "00000000-0000-0000-0000-00000000f00a", FB = "00000000-0000-0000-0000-00000000f00b";
const CA = "00000000-0000-0000-0000-00000000c00a", SV = "00000000-0000-0000-0000-0000000005a1", SG = "00000000-0000-0000-0000-0000000005a2";
await run(`insert into farmers (id,user_id,full_name,farmer_code,village) values ('${FA}','${UA}','A','FRM-1','Chak 1'),('${FB}','${UB}','B','FRM-2','Chak 2');
insert into profiles (id, role, is_active) values ('${US}','sales_staff',true),('${UO}','owner',true),('${UA}','farmer',true);
insert into customers (id, farmer_id, name) values ('${CA}','${FA}','A dukaan');
insert into shops values ('${SV}','Vets','vet'),('${SG}','Agri','agri_inputs');
insert into categories (id,name) values ('00000000-0000-0000-0000-0000000ca001','Cattle Feed'),('00000000-0000-0000-0000-0000000ca002','Fertilizer');
insert into products (id,name,category_id) values ('00000000-0000-0000-0000-0000000d0001','Khal Binola','00000000-0000-0000-0000-0000000ca001'),
  ('00000000-0000-0000-0000-0000000d0002','Urea','00000000-0000-0000-0000-0000000ca002'),('00000000-0000-0000-0000-0000000d0003','Oxytet',null);
insert into pos_sales (id, shop_id, customer_id) values ('00000000-0000-0000-0000-0000000aa001','${SG}','${CA}'),('00000000-0000-0000-0000-0000000aa002','${SV}','${CA}'),('00000000-0000-0000-0000-0000000aa003','${SG}',null);
insert into pos_sale_items (id, sale_id, product_id, quantity, unit_price, subtotal) values
  ('00000000-0000-0000-0000-00000000b001','00000000-0000-0000-0000-0000000aa001','00000000-0000-0000-0000-0000000d0001',5,4300,21500),
  ('00000000-0000-0000-0000-00000000b002','00000000-0000-0000-0000-0000000aa001','00000000-0000-0000-0000-0000000d0002',2,4500,9000),
  ('00000000-0000-0000-0000-00000000b003','00000000-0000-0000-0000-0000000aa002','00000000-0000-0000-0000-0000000d0003',1,870,870),
  ('00000000-0000-0000-0000-00000000b004','00000000-0000-0000-0000-0000000aa003','00000000-0000-0000-0000-0000000d0001',1,4300,4300);
insert into milk_entries (farmer_id, entry_date, shift, quantity_liters, total_amount) values ('${FA}', current_date, 'morning', 100, 18000), ('${FB}', current_date, 'morning', 50, 9000);
insert into milk_payments (farmer_id, amount, payment_date) values ('${FA}', 15000, current_date);`);
await run(`${as(UA)} insert into dairy_animals (id, farmer_id, tag_no, name) values ('00000000-0000-0000-0000-0000000a0001','${FA}','104','Rani'); ${reset}`);
await run(`${as(UB)} insert into dairy_animals (id, farmer_id, tag_no) values ('00000000-0000-0000-0000-0000000b0001','${FB}','1'); ${reset}`);
const RANI = "00000000-0000-0000-0000-0000000a0001", BANI = "00000000-0000-0000-0000-0000000b0001";

// 574 photos
assert.equal(await one(`select public from storage.buckets where id='dairy-photos'`), false);
assert.equal(Number(await one(`select file_size_limit from storage.buckets where id='dairy-photos'`)), 8388608);
await run(`${as(UA)} insert into storage.objects (bucket_id, name) values ('dairy-photos','${FA}/${RANI}/x.webp'); ${reset}`);
await throws(`${as(UA)} insert into storage.objects (bucket_id, name) values ('dairy-photos','${FB}/${BANI}/x.webp')`, /row-level/, "cannot upload into other's folder");
await run(as(UB)); assert.equal(Number(await one(`select count(*) from storage.objects`)), 0); await run(reset);
await run(as(US)); assert.equal(Number(await one(`select count(*) from storage.objects`)), 1); await run(reset);
await run(`${as(UA)} update dairy_animals set photo_path='${FA}/${RANI}/x.webp', photo_thumb_path='${FA}/${RANI}/x_thumb.webp' where id='${RANI}'; ${reset}`);
await throws(`${as(UA)} update dairy_animals set photo_path='${FB}/z.webp' where id='${RANI}'`, /apne folder/, "photo path must be own folder");
pass("photos: private bucket, own folder only, staff read, path guard");

// 575 expenses
await run(`${as(UA)} insert into dairy_expenses (farmer_id, category, sub_type, qty, unit, rate, amount) values ('${FA}','chara','green',40,'maund',450,18000); ${reset}`);
await throws(`${as(UA)} insert into dairy_expenses (farmer_id, category, qty, rate, amount) values ('${FA}','wanda',2,100,250)`, /check/, "amount must equal qty*rate");
await throws(`${as(UA)} insert into dairy_expenses (farmer_id, category, sub_type, amount) values ('${FA}','wanda','green',100)`, /check/, "sub_type only for chara");
await throws(`${as(UA)} insert into dairy_expenses (farmer_id, category, amount) values ('${FB}','wanda',100)`, /row-level/, "not for other farmer");
await throws(`${as(UA)} insert into dairy_expenses (farmer_id, category, amount, animal_id) values ('${FA}','vets',100,'${BANI}')`, /Janwar/, "animal must be own");
await throws(`${as(UA)} insert into dairy_expenses (farmer_id, category, amount, expense_date) values ('${FA}','vets',100,current_date+1)`, /Aage/, "no future");
await throws(`${as(UA)} insert into dairy_expenses (farmer_id, category, amount, source, source_ref) values ('${FA}','khal',21500,'erp_pos','00000000-0000-0000-0000-00000000b001')`, /Shamil/, "fake shop entry blocked");
await throws(`${as(UA)} delete from dairy_expenses`, /permission denied/, "no delete");
await throws(`set role anon; select * from dairy_expenses`, /permission denied/, "anon blocked");
pass("expenses: qty*rate, chara sub-type, own farmer/animal, no future, no fake shop rows, no delete, anon blocked");

await run(as(UA));
const sug = (await db.query(`select * from fn_my_shop_dairy_suggestions(null,null) order by amount desc`)).rows;
await run(reset);
assert.deepEqual(sug.map((r) => [r.product, r.category, r.added]), [["Khal Binola", "khal", false], ["Oxytet", "vets", false]]);
pass("shop suggestions: own POS only, khal/vets detected, urea ignored");
await run(`${as(UA)} select fn_dairy_add_from_shop('00000000-0000-0000-0000-00000000b001'); ${reset}`);
await throws(`${as(UA)} select fn_dairy_add_from_shop('00000000-0000-0000-0000-00000000b001')`, /Pehle se/, "no double add");
await throws(`${as(UB)} select fn_dairy_add_from_shop('00000000-0000-0000-0000-00000000b003')`, /aap ki nahi/, "B cannot add A's purchase");
await throws(`${as(UA)} select fn_dairy_add_from_shop('00000000-0000-0000-0000-00000000b004')`, /aap ki nahi/, "walk-in sale not mine");
await throws(`${as(UA)} update dairy_expenses set amount=1 where source='erp_pos'`, /sirf void/, "shop row cannot be edited");
  await throws(`${as(UA)} update dairy_expenses set source_ref='00000000-0000-0000-0000-00000000b003' where category='chara'`, /Source/, "cannot claim shop item by edit");
await run(as(UA));
assert.equal(await one(`select added from fn_my_shop_dairy_suggestions(null,null) where product='Khal Binola'`), true);
await run(reset);
pass("add from shop: once only, own only, locked (void only)");

await throws(`${as(UA)} update dairy_expenses set voided=true where category='chara'`, /check/, "void needs reason");
await run(`${as(UA)} update dairy_expenses set voided=true, void_reason='ghalat indraaj' where category='chara'; ${reset}`);
await throws(`${as(UA)} update dairy_expenses set voided=false where category='chara'`, /Void/, "voided stays voided");
await run(`${as(UA)} insert into dairy_expenses (farmer_id, category, sub_type, qty, unit, rate, amount) values ('${FA}','chara','silage',10,'maund',500,5000); ${reset}`);
pass("void with reason; voided row locked");

// 576 income
await run(`${as(UA)} insert into dairy_income (farmer_id, kind, qty, rate, amount) values ('${FA}','home_milk',10,180,1800),('${FA}','animal_sale',null,null,10200); ${reset}`);
await throws(`${as(UA)} insert into dairy_income (farmer_id, kind, amount) values ('${FB}','other',5)`, /row-level/, "income own only");
// regression: income ko edit/void karna kaam kare (guard mein dairy_expenses ka 'source' column na chhue)
await run(`${as(UA)} insert into dairy_income (farmer_id, kind, amount, note) values ('${FA}','other',777,'ghalat'); update dairy_income set note='theek' where amount=777; update dairy_income set voided=true, void_reason='ghalat indraaj' where amount=777; ${reset}`);
await throws(`${as(UA)} update dairy_income set voided=false where amount=777`, /Void/, "voided income stays voided");
await run(reset);
await run(as(UA));
const cm = (await db.query(`select * from fn_my_centre_milk_income(null,null)`)).rows[0];
await run(reset);
assert.deepEqual([Number(cm.litres), Number(cm.value), Number(cm.paid)], [100, 18000, 15000]);
for (const f of ["fn_dairy_centre_for(uuid,date,date)", "fn_dairy_pnl_for(uuid,date,date,text)"])
  assert.equal(await one(`select has_function_privilege('authenticated','public.${f}','execute')`), false, f);
pass("income own only; centre milk read-only from ERP (own); internal helpers not callable");

// 577 P&L
await run(`${as(UA)} insert into dairy_milk_yields (animal_id, farmer_id, shift, liters) values ('${RANI}','${FA}','am',20); ${reset}`);
await run(as(UA));
const pnl = JSON.parse(JSON.stringify(await one(`select fn_my_dairy_pnl(current_date, current_date, 'month')`)));
await run(reset);
const p = pnl[pnl.length - 1];
assert.equal(Number(p.expense_total), 26500); // khal 21500 + silage 5000 (void chara excluded)
assert.equal(Number(p.income_total), 30000);  // centre 18000 + home 1800 + sale 10200
assert.equal(Number(p.profit), 3500);
assert.equal(Number(p.cost_per_litre), 1325);
assert.equal(Number(p.feed_per_animal), 26500);
assert.equal(Number(p.expense.khal), 21500);
await throws(`${as(US)} select fn_my_dairy_pnl(current_date, current_date, 'month')`, /Sirf kisan/, "staff has no own P&L");
pass("P&L: income/expense/profit, void excluded, cost per litre, feed per animal");

// 578 admin
await throws(`${as(US)} select * from fn_admin_dairy_totals(current_date-30, current_date)`, /Admin/, "sales staff denied");
await throws(`${as(UA)} select * from fn_admin_dairy_totals(current_date-30, current_date)`, /Admin/, "farmer denied");
await run(as(UO));
const tot = (await db.query(`select * from fn_admin_dairy_totals(current_date-30, current_date)`)).rows;
const drill = await one(`select fn_admin_dairy_farmer('${FA}', current_date-30, current_date)`);
await run(reset);
assert.equal(tot.length, 2);
const a = tot.find((r) => r.farmer_code === "FRM-1");
assert.deepEqual([Number(a.expense), Number(a.income), Number(a.profit), a.customer_name, a.animals], [26500, 30000, 3500, "A dukaan", 1]);
assert.equal(Number(tot.find((r) => r.farmer_code === "FRM-2").income), 9000);
assert.equal(drill.farmer.farmer_code, "FRM-1"); assert.equal(drill.animals.length, 1); assert.ok(drill.recent.length >= 4);
pass("admin: owner sees totals + drill-down; staff/farmer denied");

console.log(`portal-dairy-pl-sql: ${ok} passed`);
