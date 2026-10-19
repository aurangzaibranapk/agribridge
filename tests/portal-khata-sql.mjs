// Real SQL test: 565 (portal Mera Khata) ko PGlite par chalata hai -- live DB nahi.
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const run = (sql) => db.exec(sql);
const q = async (sql, p = []) => (await db.query(sql, p)).rows;
const one = async (sql, p = []) => Object.values((await q(sql, p))[0])[0];
const sql565 = fs.readFileSync("supabase/migrations/565_portal_own_khata.sql", "utf8");

await run(fs.readFileSync("tests/sql/portal-khata-stubs.sql", "utf8"));
await run(sql565);
await run(sql565); // idempotent

// read-only: koi DDL tor-phor ya data likhna nahi
assert.doesNotMatch(sql565, /\bdrop\s+(table|column)\b|\btruncate\b|\binsert\s+into\b|\bupdate\s+\w+\s+set\b|\bdelete\s+from\b|\balter\s+table\b/i);
for (const f of ["fn_my_khata_summary", "fn_my_khata_statement", "fn_my_khata_scope", "fn_khata_lines_for"]) {
  assert.equal(await one(`select prosecdef from pg_proc where proname='${f}'`), true, `${f} security definer`);
  assert.equal(await one(`select provolatile from pg_proc where proname='${f}'`), "s", `${f} stable (read-only)`);
}

const UA = "00000000-0000-0000-0000-0000000000a1", UB = "00000000-0000-0000-0000-0000000000b1", UC = "00000000-0000-0000-0000-0000000000c1";
const FA = "00000000-0000-0000-0000-00000000f00a", FB = "00000000-0000-0000-0000-00000000f00b";
const CA = "00000000-0000-0000-0000-00000000c00a", CB = "00000000-0000-0000-0000-00000000c00b", CC = "00000000-0000-0000-0000-00000000c00c";
const SK = "00000000-0000-0000-0000-0000000005a1", SA = "00000000-0000-0000-0000-0000000005a2";
await run(`
insert into farmers (id, user_id, full_name, credit_limit) values ('${FA}','${UA}','Kisan A', 500000), ('${FB}','${UB}','Kisan B', 0);
insert into customers (id, user_id, farmer_id, name, credit_limit) values ('${CA}', null, '${FA}', 'A dukaan', 1000000),
  ('${CB}', null, '${FB}', 'B dukaan', 0), ('${CC}', '${UC}', null, 'Sirf customer', 20000);
insert into shops (id, name, business_type) values ('${SK}','Karyana','karyana'), ('${SA}','Agri','agri_inputs');
insert into products (id, name) values ('00000000-0000-0000-0000-0000000000d1','Urea'), ('00000000-0000-0000-0000-0000000000d2','DAP');
insert into pos_sales (id, shop_id) values ('00000000-0000-0000-0000-00000000aa01','${SA}'), ('00000000-0000-0000-0000-00000000aa02','${SK}');
insert into pos_sale_items (sale_id, product_id, quantity, subtotal) values
  ('00000000-0000-0000-0000-00000000aa01','00000000-0000-0000-0000-0000000000d1', 2, 9000),
  ('00000000-0000-0000-0000-00000000aa01','00000000-0000-0000-0000-0000000000d2', 1, 1000);
insert into journal_entries (id, entry_number, entry_date, description, source_module, source_id) values
  ('00000000-0000-0000-0000-0000000e0001','POS-1','2026-08-01','POS','pos','00000000-0000-0000-0000-00000000aa01'),
  ('00000000-0000-0000-0000-0000000e0002','POS-2','2026-10-10','POS','pos','00000000-0000-0000-0000-00000000aa02'),
  ('00000000-0000-0000-0000-0000000e0003','RCP-1','2026-09-01','Easypaisa 25,000 Riaz ko diye','customer_udhaar',null),
  ('00000000-0000-0000-0000-0000000e0004','POS-B','2026-10-01','B ka bill','pos',null),
  ('00000000-0000-0000-0000-0000000e0005','GRN-1','2026-10-05','Gandum','grain_procurement',null),
  ('00000000-0000-0000-0000-0000000e0006','FC-1','2026-10-06','khad gl','farmer_credit',null),
  ('00000000-0000-0000-0000-0000000e0007','C-1','2026-10-09','cust only','pos',null);
insert into journal_lines (entry_id, account_code, debit, credit, party_type, party_id, memo) values
  ('00000000-0000-0000-0000-0000000e0001','1100',10000,0,'customer','${CA}','x'),
  ('00000000-0000-0000-0000-0000000e0001','4000',0,10000,null,null,'revenue'),
  ('00000000-0000-0000-0000-0000000e0002','1100',5000,0,'customer','${CA}',null),
  ('00000000-0000-0000-0000-0000000e0003','1100',0,4000,'customer','${CA}','Riaz Qadi ko diye'),
  ('00000000-0000-0000-0000-0000000e0004','1100',777,0,'customer','${CB}',null),
  ('00000000-0000-0000-0000-0000000e0005','2040',0,3000,'farmer','${FA}',null),
  ('00000000-0000-0000-0000-0000000e0005','5020',3000,0,'farmer','${FA}',null),
  ('00000000-0000-0000-0000-0000000e0006','1150',2500,0,'farmer','${FA}',null),
  ('00000000-0000-0000-0000-0000000e0007','1100',1200,0,'customer','${CC}',null);
insert into farmer_credit_ledger (farmer_id, source_type, ledger_type, amount, notes, created_at) values
  ('${FA}','fertilizer','debit',2500,'Sikandar ke khate se','2026-10-06 10:00+05'),
  ('${FB}','fertilizer','debit',999,null,'2026-10-06 10:00+05');
insert into milk_entries (farmer_id, entry_date, quantity_liters, total_amount, status) values
  ('${FA}','2026-10-12',10,1500,null), ('${FA}','2026-10-12',5,750,null), ('${FA}','2026-10-13',4,600,'rejected');
insert into milk_payments (farmer_id, amount, payment_date, payment_method) values ('${FA}', 1000, '2026-10-14', 'cash');
insert into payment_promises (party_type, party_id, promised_amount, promise_date, status) values
  ('customer','${CA}', 2870, '2026-11-15', 'open'), ('customer','${CB}', 1, '2026-10-20', 'open');
insert into score_snapshots (subject_type, subject_id, snapshot_date, score, band, state) values ('farmer','${FA}','2026-10-17',100,'platinum','active');
insert into qist_plans (id, party_type, party_id, status) values ('00000000-0000-0000-0000-000000000901','farmer','${FA}','active'),
  ('00000000-0000-0000-0000-000000000902','farmer','${FB}','active');
insert into qist_installments (plan_id, due_date, amount_due, amount_deducted, status) values
  ('00000000-0000-0000-0000-000000000901','2026-10-30',2000,500,'partial'), ('00000000-0000-0000-0000-000000000901','2026-11-30',2000,0,'due'),
  ('00000000-0000-0000-0000-000000000901','2026-09-30',2000,2000,'paid'), ('00000000-0000-0000-0000-000000000902','2026-10-30',9999,0,'due');
`);

const as = (uid) => run(`select set_config('test.uid', '${uid ?? ""}', false)`);
const sum = async () => (await q(`select fn_my_khata_summary('2026-10-17') s`))[0].s;
const stmt = async (from = null, to = null) =>
  q(`select * from fn_my_khata_statement($1::date, $2::date)`, [from, to]);
const day = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d));

// Login nahi -> kuch nahi
await as(null);
assert.equal(await sum(), null);
assert.equal((await stmt()).length, 0);

// Kisan A: sirf apna
await as(UA);
const a = await sum();
// dukaan 10000+5000-4000 = 11000; gandum -3000; khaad (ledger) 2500 (GL farmer_credit nahi); doodh -2250 +1000 (rejected nahi)
assert.equal(Number(a.owed), 11000 - 3000 + 2500 - 2250 + 1000);
const cat = Object.fromEntries(a.by_category.map((c) => [c.category, Number(c.balance)]));
assert.equal(cat.khaad, 10000 + 2500, "agri dukaan POS + khaad ledger = khaad");
assert.equal(cat.karyana, 5000);
assert.equal(cat.adaigi, -4000);
assert.equal(cat.gandum, -3000);
assert.equal(cat.doodh, -1250);
assert.equal(a.customer_count, 1);
assert.equal(Number(a.credit_limit), 1000000, "had: farmer/customer mein bara");
assert.equal(a.score.band, "platinum");
assert.equal(a.level, "standard");
assert.equal(Number(a.promise.amount), 2870, "apna wada, B ka nahi");
assert.equal(a.promise.days_left, 29);
assert.equal(Number(a.qist.remaining), 3500);
assert.equal(a.qist.next_due, "2026-10-30");
assert.equal(a.qist.plans, 1);
// umar FIFO: kul credits = 4000+3000+2250 = 9250 -> 1-Aug ke 10000 mein se 750 baqi (77 din)
assert.equal(Number(a.aging.d60_plus), 750);
assert.equal(a.aging.oldest_days, 77);
assert.equal(Number(a.last_payment.amount), 4000, "aakhri adaigi = asal adaigi (gandum ki raqam nahi)");

const all = await stmt();
const txt = JSON.stringify(all);
assert.doesNotMatch(txt, /Riaz|Sikandar|777|999|B ka bill/, "doosre ka naam/raqam nahi");
assert.ok(all.some((r) => /Urea x2, DAP x1/.test(r.tafseel)), "POS bill par apni cheezein");
assert.equal(Number(all.at(-1).baqaya), Number(a.owed), "chalta baqaya = kul");
for (let i = 1; i < all.length; i++) {
  assert.equal(Number(all[i].baqaya), Number(all[i - 1].baqaya) + Number(all[i].udhaar) - Number(all[i].adaigi));
}
assert.ok(!all.some((r) => r.ref === "FC-1"), "farmer_credit GL do dafa nahi");
assert.equal(all.filter((r) => r.category === "doodh" && Number(r.adaigi) > 0).length, 1, "doodh din ka ek jor, rejected bahar");

// tareekh filter: pichhla baqaya + sirf range
const oct = await stmt("2026-10-01", "2026-10-10");
assert.equal(oct[0].is_opening, true);
assert.equal(Number(oct[0].baqaya), 10000 - 4000);
assert.ok(oct.slice(1).every((r) => day(r.entry_date) >= "2026-10-01" && day(r.entry_date) <= "2026-10-10"));
assert.equal(Number(oct.at(-1).baqaya), 6000 - 3000 + 2500 + 5000);

// Kisan B ko A ka kuch nahi
await as(UB);
const b = await sum();
assert.equal(Number(b.owed), 777 + 999);
assert.doesNotMatch(JSON.stringify(await stmt()), /Urea|POS-1|RCP-1/);
assert.equal(Number(b.promise.amount), 1);

// Sirf customer (customers.user_id se)
await as(UC);
const c = await sum();
assert.equal(Number(c.owed), 1200);
assert.equal(c.has_farmer, false);
assert.equal(c.score, null);

// Ajnabi user
await as("00000000-0000-0000-0000-0000000000ee");
assert.equal(await sum(), null);

// Ijazat: anon kuch nahi; helper sirf service_role
for (const fn of ["fn_my_khata_summary(date)", "fn_my_khata_statement(date,date)", "fn_my_khata_scope()"]) {
  assert.equal(await one(`select has_function_privilege('anon','public.${fn}','execute')`), false, `${fn} anon`);
  assert.equal(await one(`select has_function_privilege('authenticated','public.${fn}','execute')`), true, `${fn} authenticated`);
}
for (const role of ["anon", "authenticated"]) {
  assert.equal(await one(`select has_function_privilege('${role}','public.fn_khata_lines_for(uuid,uuid[])','execute')`), false);
}
assert.equal(await one(`select has_function_privilege('service_role','public.fn_khata_lines_for(uuid,uuid[])','execute')`), true);

console.log("portal-khata-sql (565): sab theek");
