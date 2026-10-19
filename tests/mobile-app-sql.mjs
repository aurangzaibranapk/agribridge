// Real SQL test: mobile migrations 583-588 ko PGlite (in-process Postgres)
// par chalata hai -- live DB nahi. RLS "authenticated" role ban kar jaanchte hain.
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const run = (s) => db.exec(s);
const q = async (s) => (await db.query(s)).rows;
const one = async (s) => (await q(s))[0];
const FILES = [
  "583_mobile_devices_account_deletion.sql",
  "584_mobile_service_requests.sql",
  "585_mobile_catalog_dashboard.sql",
  "586_mobile_my_summary.sql",
  "587_mobile_farmer_grain_machinery.sql",
  "588_mobile_order_request.sql",
];
await run(fs.readFileSync("tests/sql/mobile-app-stubs.sql", "utf8"));
for (const f of FILES) {
  const sql = fs.readFileSync(`supabase/migrations/${f}`, "utf8").replace(/^notify pgrst.*$/gm, "");
  assert.doesNotMatch(sql, /\bdrop table\b|\btruncate\b|\bdrop column\b|\bdelete from\b/i, f + " sirf additive");
  const definers = (sql.match(/security definer/gi) || []).length, paths = (sql.match(/set search_path/gi) || []).length;
  assert.ok(definers <= paths, f + " har security definer ke saath search_path");
  await run(sql);
  await run(sql); // idempotent
}

const ORG = "10000000-0000-0000-0000-000000000001", ORG2 = "10000000-0000-0000-0000-000000000002";
const BR = "20000000-0000-0000-0000-000000000001", SHOP = "30000000-0000-0000-0000-000000000001";
const OWNER = "00000000-0000-0000-0000-00000000000a", MGR = "00000000-0000-0000-0000-00000000000b",
  FARM = "00000000-0000-0000-0000-00000000000c", FARM2 = "00000000-0000-0000-0000-00000000000d",
  STAFF = "00000000-0000-0000-0000-00000000000e", OUT = "00000000-0000-0000-0000-00000000000f",
  CUST = "00000000-0000-0000-0000-000000000010";
const P_OK = "40000000-0000-0000-0000-000000000001", P_UNVER = "40000000-0000-0000-0000-000000000002",
  P_EXP = "40000000-0000-0000-0000-000000000003", P_OTHER = "40000000-0000-0000-0000-000000000004";
await run(`
  insert into organizations (id,name) values ('${ORG}','ART'),('${ORG2}','Doosri');
  insert into branches (id,name,organization_id) values ('${BR}','Mahabali','${ORG}');
  insert into shops (id,name) values ('${SHOP}','Karyana');
  insert into profiles (id,full_name,role,organization_id,branch_id,shop_id) values
    ('${OWNER}','Owner','owner','${ORG}',null,null),('${MGR}','Manager','manager','${ORG}','${BR}',null),
    ('${FARM}','Kisan','farmer','${ORG}','${BR}',null),('${FARM2}','Kisan 2','farmer','${ORG}','${BR}',null),
    ('${STAFF}','Sales','sales_staff','${ORG}','${BR}','${SHOP}'),('${OUT}','Bahar','admin','${ORG2}',null,null),
    ('${CUST}','Customer','customer','${ORG}','${BR}',null);
  insert into farmers (user_id,organization_id,branch_id,full_name,phone_number) values
    ('${FARM}','${ORG}','${BR}','Aslam Kisan','03001234567'),('${FARM2}','${ORG}','${BR}','Bashir Kisan','03007654321');
  insert into customers (user_id,name) values ('${CUST}','Dukan Customer');
  insert into products (id,name,selling_price,purchase_price,organization_id,is_verified,expiry_date) values
    ('${P_OK}','Urea',4200,3900,'${ORG}',true,null),('${P_UNVER}','Nayi',100,90,'${ORG}',false,null),
    ('${P_EXP}','Purani',100,90,'${ORG}',true,current_date - 3),('${P_OTHER}','Doosri org',100,90,'${ORG2}',true,null);
  insert into warehouses (id,branch_id) values ('50000000-0000-0000-0000-000000000001','${BR}');
  insert into inventory (product_id,warehouse_id,shop_id,quantity_on_hand) values
    ('${P_OK}','50000000-0000-0000-0000-000000000001',null,40),('${P_OK}',null,'${SHOP}',7);
`);
const as = async (uid) => { await run(`reset role; set test.uid = '${uid}'; set role authenticated`); };
const asNobody = async () => { await run(`reset role; reset test.uid; set role authenticated`); };
const su = async () => { await run(`reset role; reset test.uid`); };

// ---------- 583: devices + account deletion ----------
const TOKEN = "fcm-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
await as(FARM);
const dev = (await one(`select mobile_register_device('${TOKEN}','android','production','1.0.0') id`)).id;
assert.ok(dev);
await assert.rejects(() => run(`insert into mobile_devices (profile_id,push_token,platform) values ('${FARM}','x-token-bbbbbbbbbbbbbbbbbbbbbbbb','android')`), /permission denied/);
await assert.rejects(() => q(`select mobile_register_device('short')`), /token durust nahi/);
await assert.rejects(() => q(`select mobile_register_device('${TOKEN}','symbian')`), /Platform/);
await as(FARM2); // wahi phone, naya login -> token naye bande ka
await run(`select mobile_register_device('${TOKEN}','android')`);
assert.equal((await q(`select * from mobile_devices`)).length, 1, "FARM2 apna token dekhta hai");
await as(FARM);
assert.equal((await q(`select * from mobile_devices`)).length, 0, "FARM ka token ab nahi");
await asNobody();
await assert.rejects(() => q(`select mobile_register_device('${TOKEN}')`), /Login zaroori/);

await as(FARM);
const del1 = (await one(`select mobile_request_account_deletion('Ab app istemal nahi karta') id`)).id;
const del2 = (await one(`select mobile_request_account_deletion('dobara') id`)).id;
assert.equal(del1, del2, "ek waqt ek pending");
assert.equal((await one(`select mobile_my_account_deletion()->>'status' s`)).s, "pending");
await su();
const dr = await one(`select * from portal_account_delete_requests where id='${del1}'`);
assert.equal(dr.target_user_id, FARM); assert.equal(dr.requested_by, FARM); assert.match(dr.reason, /^Mobile app: /);
await assert.rejects(() => run(`update portal_account_delete_requests set status='approved', decided_by='${FARM}' where id='${del1}'`), /maker_checker/);
await run(`update portal_account_delete_requests set status='approved', decided_by='${OWNER}' where id='${del1}'`);
assert.equal((await one(`select has_function_privilege('anon','public.mobile_request_account_deletion(text)','execute') p`)).p, false);

// ---------- 584: service requests ----------
await as(FARM);
const sr = (await one(`select mobile_submit_service_request('machinery_booking','{"acres":"5"}'::jsonb) id`)).id;
const row = await one(`select * from mobile_service_requests where id='${sr}'`);
assert.equal(row.organization_id, ORG); assert.equal(row.branch_id, BR); assert.equal(row.status, "submitted");
await assert.rejects(() => q(`select mobile_submit_service_request('loan','{}'::jsonb)`), /qism/);
await assert.rejects(() => q(`select mobile_submit_service_request('crop_doctor','[1]'::jsonb)`), /Tafseel/);
await assert.rejects(() => run(`insert into mobile_service_requests (organization_id,profile_id,request_type) values ('${ORG}','${FARM}','crop_doctor')`), /permission denied/);
await assert.rejects(() => run(`update mobile_service_requests set status='approved' where id='${sr}'`), /khud faisla/);
await assert.rejects(() => run(`update mobile_service_requests set details='{}' where id='${sr}'`), /permission denied/);
await as(FARM2);
assert.equal((await q(`select * from mobile_service_requests`)).length, 0, "doosre kisan ko nahi dikhti");
await as(STAFF);
assert.equal((await q(`select * from mobile_service_requests`)).length, 0, "sales staff inbox nahi");
await as(OUT);
assert.equal((await q(`select * from mobile_service_requests`)).length, 0, "doosri org ka admin nahi");
assert.equal((await q(`update mobile_service_requests set status='approved' where id='${sr}' returning id`)).length, 0);
await as(MGR);
assert.equal((await q(`select * from mobile_service_requests`)).length, 1);
await run(`update mobile_service_requests set status='scheduled', status_note='Kal subah' where id='${sr}'`);
let after = await one(`select * from mobile_service_requests where id='${sr}'`);
assert.equal(after.status, "scheduled"); assert.equal(after.decided_by, MGR); assert.ok(after.decided_at);
// manager apni darkhwast par khud faisla nahi
const own = (await one(`select mobile_submit_service_request('crop_doctor','{}'::jsonb) id`)).id;
await assert.rejects(() => run(`update mobile_service_requests set status='approved' where id='${own}'`), /khud faisla/);
await as(OWNER);
await run(`update mobile_service_requests set status='approved' where id='${own}'`);
await as(FARM);
await run(`update mobile_service_requests set status='cancelled' where id='${sr}'`);
await as(MGR);
await assert.rejects(() => run(`update mobile_service_requests set status='approved' where id='${sr}'`), /Band darkhwast/);
await su();
await assert.rejects(() => run(`insert into mobile_service_requests (organization_id,profile_id,request_type,decided_by) values ('${ORG}','${FARM}','crop_doctor','${FARM}')`), /no_self_decision/);
for (let i = 0; i < 9; i++) await run(`insert into mobile_service_requests (organization_id,profile_id,request_type) values ('${ORG}','${FARM2}','crop_doctor')`);
await as(FARM2);
await run(`select mobile_submit_service_request('crop_doctor','{}'::jsonb)`);
await assert.rejects(() => q(`select mobile_submit_service_request('crop_doctor','{}'::jsonb)`), /10 se zyada/);

// ---------- 585: catalog + dashboard ----------
await as(STAFF);
let cat = (await one(`select mobile_product_catalog(100) c`)).c;
assert.deepEqual(cat.map((p) => p.name), ["Urea"], "sirf verified, bina expiry, apni org");
assert.equal(cat[0].warehouse_stock, 40); assert.equal(cat[0].shop_stock, 7);
assert.equal(cat[0].purchase_price, undefined, "cost kabhi nahi");
await as(OUT);
assert.deepEqual((await one(`select mobile_product_catalog(100) c`)).c.map((p) => p.name), ["Doosri org"]);
await asNobody();
await assert.rejects(() => q(`select mobile_product_catalog(10)`), /Login zaroori/);
await as(MGR);
let dash = (await one(`select mobile_role_dashboard_summary() d`)).d;
assert.equal(dash.office_service_inbox >= 10, true, "manager ko doosron ki khuli darkhwast");

// ---------- 586: summary on unified khata ----------
await su();
const FID = (await one(`select id from farmers where user_id='${FARM}'`)).id;
await run(`insert into khata_test values ('${FARM}', 12500), ('${CUST}', 800);
  insert into wallets (owner_type,owner_id,balance) values ('farmer','${FID}',300);
  insert into milk_entries (farmer_id,entry_date,quantity_liters,total_amount,fat_percentage,snf_percentage,status) values
   ('${FID}',current_date,10,1500,4,9,null),('${FID}',current_date,5,750,5,9,'rejected');`);
await as(FARM);
let sum = (await one(`select mobile_my_farmer_summary() s`)).s;
assert.equal(Number(sum.khata_owed), 12500); assert.equal(Number(sum.week_liters), 10, "rejected doodh nahi gina");
assert.equal(Number(sum.wallet_balance), 300); assert.equal(sum.farmer_id, FID);
await as(CUST);
sum = (await one(`select mobile_my_farmer_summary() s`)).s;
assert.equal(Number(sum.khata_owed), 800); assert.equal(sum.farmer_id, null); assert.equal(sum.wallet_balance, null);

// ---------- 587: grain + machinery ----------
await su();
await run(`insert into grain_farmer_balances values ('${FID}',100000,40000,60000);
  insert into grain_procurement_entries (farmer_id,entry_date,grain_type,weight_kg,total_amount) values ('${FID}',current_date,'wheat',1000,100000);
  insert into machinery_bookings (id,booking_number,farmer_id,booking_date,status,total_amount,vendor_payable) values
    ('60000000-0000-0000-0000-000000000001','MB-1','${FID}',current_date,'completed',20000,15000);
  insert into machinery_payments (booking_id,payment_date,amount,verification_status,finance_account_id) values
    ('60000000-0000-0000-0000-000000000001',current_date,5000,'verified',gen_random_uuid()),
    ('60000000-0000-0000-0000-000000000001',current_date,9999,'pending',null);`);
await as(FARM);
const g = (await one(`select mobile_my_grain_summary() g`)).g;
assert.equal(Number(g.balance_due), 60000); assert.equal(g.entries.length, 1);
const mb = (await one(`select mobile_my_machinery_bookings() m`)).m;
assert.equal(mb.length, 1); assert.equal(mb[0].payments.length, 1, "sirf verified adaigi");
assert.equal(mb[0].vendor_payable, undefined, "vendor ka hisaab nahi");
assert.equal(mb[0].payments[0].finance_account_id, undefined);
await as(CUST);
await assert.rejects(() => q(`select mobile_my_grain_summary()`), /Kisan profile/);
await as(FARM2);
assert.equal((await one(`select mobile_my_machinery_bookings() m`)).m.length, 0);

// ---------- 588: safe checkout ----------
await as(FARM);
const items = (arr) => `'${JSON.stringify(arr)}'::jsonb`;
const oid = (await one(`select mobile_submit_agri_order(${items([{ product_id: P_OK, quantity: 2 }])},'Cash','Jaldi') id`)).id;
const ord = await one(`select * from agri_orders where id='${oid}'`);
assert.equal(Number(ord.grand_total), 8400, "qeemat server se"); assert.equal(ord.status, "submitted");
assert.equal(ord.order_to_type, "Farmer"); assert.equal(ord.mobile_number, "03001234567"); assert.equal(ord.party_link_state, "unlinked_unknown");
assert.equal((await q(`select * from agri_order_items where order_id='${oid}'`)).length, 1);
assert.equal((await q(`select * from agri_order_timeline where order_id='${oid}'`)).length, 1);
await assert.rejects(() => q(`select mobile_submit_agri_order(${items([{ product_id: P_OK, quantity: 1 }])},'Credit')`), /Khata\/udhaar/);
await assert.rejects(() => q(`select mobile_submit_agri_order(${items([{ product_id: P_UNVER, quantity: 1 }])})`), /dastiyab nahi/);
await assert.rejects(() => q(`select mobile_submit_agri_order(${items([{ product_id: P_EXP, quantity: 1 }])})`), /dastiyab nahi/);
await assert.rejects(() => q(`select mobile_submit_agri_order(${items([{ product_id: P_OTHER, quantity: 1 }])})`), /dastiyab nahi/);
await assert.rejects(() => q(`select mobile_submit_agri_order(${items([{ product_id: P_OK, quantity: 1.5 }])})`), /tadaad/);
await assert.rejects(() => q(`select mobile_submit_agri_order(${items([{ product_id: P_OK, quantity: -1 }])})`), /tadaad/);
await assert.rejects(() => q(`select mobile_submit_agri_order(${items([{ product_id: "abc", quantity: 1 }])})`), /durust nahi/);
await assert.rejects(() => q(`select mobile_submit_agri_order(${items([{ product_id: P_OK, quantity: 1 }, { product_id: P_OK, quantity: 2 }])})`), /do dafa/);
await assert.rejects(() => q(`select mobile_submit_agri_order('[]'::jsonb)`), /1 se 30/);
assert.equal((await q(`select * from agri_orders`)).length, 1, "kisan sirf apna order");
await as(FARM2);
assert.equal((await q(`select * from agri_orders`)).length, 0, "doosre ka order nahi");
assert.equal((await q(`select * from agri_order_items`)).length, 0);
await as(CUST);
await assert.rejects(() => q(`select mobile_submit_agri_order(${items([{ product_id: P_OK, quantity: 1 }])})`), /Kisan profile/);
await as(FARM);
for (let i = 0; i < 9; i++) await run(`select mobile_submit_agri_order(${items([{ product_id: P_OK, quantity: 1 }])})`);
await assert.rejects(() => q(`select mobile_submit_agri_order(${items([{ product_id: P_OK, quantity: 1 }])})`), /10 se zyada/);

// ---------- grants: anon kuch nahi chala sakta ----------
await su();
for (const fn of ["mobile_register_device(text,text,text,text)", "mobile_request_account_deletion(text)", "mobile_my_account_deletion()",
  "mobile_submit_service_request(text,jsonb)", "mobile_product_catalog(integer)", "mobile_role_dashboard_summary()",
  "mobile_my_farmer_summary()", "mobile_my_grain_summary()", "mobile_my_machinery_bookings()", "mobile_submit_agri_order(jsonb,text,text)"]) {
  assert.equal((await one(`select has_function_privilege('anon','public.${fn}','execute') p`)).p, false, fn + " anon");
  assert.equal((await one(`select has_function_privilege('authenticated','public.${fn}','execute') p`)).p, true, fn + " authenticated");
}
for (const t of ["mobile_devices", "mobile_service_requests"]) {
  assert.equal((await one(`select relrowsecurity r from pg_class where relname='${t}'`)).r, true, t + " RLS");
  assert.equal((await one(`select has_table_privilege('anon','public.${t}','select') p`)).p, false, t + " anon");
  assert.equal((await one(`select has_table_privilege('authenticated','public.${t}','insert') p`)).p, false, t + " client insert");
}
console.log("mobile-app SQL 583-588 (PGlite): OK");
