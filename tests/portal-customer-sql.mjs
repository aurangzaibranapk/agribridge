// Real SQL test: 572-573 (Customer Portal) PGlite par -- live DB nahi.
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const run = (s) => db.exec(s);
const q = async (s) => (await db.query(s)).rows;
const one = async (s) => Object.values((await db.query(s)).rows[0] ?? {})[0];
const reset = "reset role; select set_config('test.uid','',false);";
const as = (u) => `set role authenticated; select set_config('test.uid','${u}',false);`;
const asOne = async (u, s) => { await run(as(u)); try { return await one(s); } finally { await run(reset); } };
const throws = async (s, re, msg) => {
  let err = null;
  try { await run(s); } catch (e) { err = e; }
  await run(reset);
  assert.ok(err, `expected error: ${msg}`);
  if (re) assert.match(String(err.message), re, `${msg} -> ${err.message}`);
};
const mig = (f) => fs.readFileSync(`supabase/migrations/${f}.sql`, "utf8");
await run(fs.readFileSync("tests/sql/portal-khata-stubs.sql", "utf8"));
await run(fs.readFileSync("tests/sql/portal-customer-stubs.sql", "utf8"));
await run(mig("565_portal_own_khata"));
const M572 = mig("572_customer_portal_read"), M573 = mig("573_customer_portal_requests");
for (const m of [M572, M573]) { await run(m); await run(m); } // idempotent
let ok = 0; const pass = (n) => { ok++; console.log(`  ok  ${n}`); };

// --- additive only
for (const m of [M572, M573]) {
  assert.doesNotMatch(m, /\bdrop\s+(table|column|function)\b|\btruncate\b|\bdelete\s+from\b/i);
  assert.doesNotMatch(m, /\balter\s+table\s+(public\.)?(customers|pos_sales|pos_sale_items|payment_promises|agri_orders|journal_lines|journal_entries|profiles)\b/i);
}
assert.doesNotMatch(M572, /\binsert\s+into\b|\bupdate\s+\w+\s+set\b|\bcreate\s+table\b/i);
for (const f of ["fn_my_customer_profile", "fn_my_bills", "fn_my_orders", "fn_my_returns", "fn_my_promises", "fn_my_payments"]) {
  assert.equal(await one(`select prosecdef from pg_proc where proname='${f}'`), true, `${f} definer`);
  assert.equal(await one(`select provolatile from pg_proc where proname='${f}'`), "s", `${f} stable/read-only`);
}
pass("572 read-only, 573 additive; ERP tables not altered; no drop/delete");

// --- data
const B1 = "00000000-0000-0000-0000-0000000000e1", B2 = "00000000-0000-0000-0000-0000000000e2";
const UA = "00000000-0000-0000-0000-0000000000a1", UB = "00000000-0000-0000-0000-0000000000b1", UC = "00000000-0000-0000-0000-0000000000c1";
const UOWN = "00000000-0000-0000-0000-0000000000d1", UFIN = "00000000-0000-0000-0000-0000000000d2", USAL = "00000000-0000-0000-0000-0000000000d3";
const USAL2 = "00000000-0000-0000-0000-0000000000d4", UDEPT = "00000000-0000-0000-0000-0000000000d5", UHR = "00000000-0000-0000-0000-0000000000d6";
const FA = "00000000-0000-0000-0000-00000000f00a";
const CA = "00000000-0000-0000-0000-00000000c00a", CB = "00000000-0000-0000-0000-00000000c00b", CC = "00000000-0000-0000-0000-00000000c00c";
const S1 = "00000000-0000-0000-0000-00000000aa01", S2 = "00000000-0000-0000-0000-00000000aa02", P1 = "00000000-0000-0000-0000-0000000000f1";
const FIN = "00000000-0000-0000-0000-0000000fa001";
await run(`
insert into branches values ('${B1}','Mahabali'),('${B2}','HQ');
insert into auth.users (id, last_sign_in_at) values ('${UC}', now()), ('${UB}', now());
insert into profiles (id, role, branch_id) values ('${UA}','farmer',null),('${UB}','customer',null),('${UC}','customer',null),
  ('${UOWN}','owner',null),('${UFIN}','finance',null),('${USAL}','sales_staff','${B1}'),('${USAL2}','sales_staff','${B2}'),
  ('${UDEPT}','manager',null),('${UHR}','hr','${B1}');
insert into farmers (id, user_id, full_name, farmer_code) values ('${FA}','${UA}','Kisan A','FRM-000066');
insert into customers (id, user_id, farmer_id, name, credit_limit, branch_id, phone_number, cnic, address) values
  ('${CA}', null, '${FA}', 'A dukaan', 300000, '${B1}', '03001234521', '3520212345673', 'Chak 9'),
  ('${CB}', '${UB}', null, 'B traders', 50000, '${B2}', '03111111111', null, null),
  ('${CC}', '${UC}', null, 'C store', 20000, '${B1}', '03222222222', null, 'Mahabali');
insert into products (id, name) values ('${P1}','DAP');
insert into pos_sales (id, crm_customer_id, total_amount, cash_paid, khata_amount, total_cogs, profit) values
  ('${S1}','${CC}', 31200, 0, 31200, 26000, 5200), ('${S2}','${CB}', 777, 0, 777, 500, 277);
insert into pos_sale_items (sale_id, product_id, quantity, unit_price, subtotal, unit_cost, line_cogs) values ('${S1}','${P1}', 2, 15600, 31200, 13000, 26000);
insert into pos_returns (id, sale_id, return_number, total_amount) values (gen_random_uuid(), '${S1}', 'RT-0412', 4800);
insert into agri_orders (id, order_number, customer_id, grand_total, status, credit_limit, existing_outstanding, notes, sales_verified_by, sales_verified_at)
  values ('00000000-0000-0000-0000-00000000ab01','AO-0015','${CC}', 18600, 'pending', 999999, 123456, 'andar ka note', '${USAL}', now()),
         ('00000000-0000-0000-0000-00000000ab02','AO-B','${CB}', 1, 'pending', 1, 1, null, null, null);
insert into agri_order_items (order_id, product_name, order_qty, net_price, line_total) values ('00000000-0000-0000-0000-00000000ab01','Zinc 10kg', 6, 3100, 18600);
insert into payment_promises (party_type, party_id, promised_amount, promise_date, status, fulfilled_amount, notes, assigned_to)
  values ('customer','${CC}', 50000, current_date + 9, 'open', 0, 'staff ka raaz note', '${USAL}'), ('customer','${CB}', 1, current_date, 'open', 0, null, null);
insert into journal_entries (id, entry_number, entry_date, description, source_module) values
  ('00000000-0000-0000-0000-0000000e0001','POS-1', current_date - 5, 'POS', 'pos'), ('00000000-0000-0000-0000-0000000e0002','RCP-1', current_date - 3, 'Cash', 'customer_udhaar');
insert into journal_lines (entry_id, account_code, debit, credit, party_type, party_id) values
  ('00000000-0000-0000-0000-0000000e0001','1100', 31200, 0, 'customer', '${CC}'), ('00000000-0000-0000-0000-0000000e0002','1100', 0, 20000, 'customer', '${CC}');
`);

// --- own data only
await run(as(UC));
const prof = await one(`select fn_my_customer_profile()`);
assert.equal(prof.customers.length, 1); assert.equal(prof.customers[0].name, "C store"); assert.equal(prof.customers[0].branch, "Mahabali");
const bills = await one(`select fn_my_bills(null, null, 50)`);
assert.equal(bills.length, 1); assert.equal(bills[0].total, 31200); assert.equal(bills[0].items[0].rate, 15600);
const orders = await one(`select fn_my_orders(50)`);
assert.equal(orders.length, 1); assert.equal(orders[0].number, "AO-0015"); assert.equal(orders[0].steps.sales, true); assert.equal(orders[0].steps.finance, false);
const promises = await one(`select fn_my_promises()`);
assert.equal(promises.length, 1); assert.equal(Number(promises[0].amount), 50000);
const pays = await one(`select fn_my_payments(null, null)`);
assert.equal(pays.length, 1); assert.equal(Number(pays[0].amount), 20000);
const rets = await one(`select fn_my_returns()`); assert.equal(rets.length, 1); assert.equal(rets[0].ref, "RT-0412");
await run(reset);
pass("customer sees own profile, bills, orders, returns, promises, payments");

// --- no cost / internal fields anywhere
await run(as(UC));
const all = JSON.stringify([await one(`select fn_my_customer_profile()`), await one(`select fn_my_bills(null,null,50)`), await one(`select fn_my_orders(50)`),
  await one(`select fn_my_promises()`), await one(`select fn_my_returns()`)]);
await run(reset);
for (const bad of ["unit_cost", "line_cogs", "total_cogs", "profit", "26000", "5200", "13000", "credit_limit\":999999", "existing_outstanding", "123456",
  "andar ka note", "staff ka raaz", "assigned_to", "sales_verified_by", USAL, "notes"]) assert.ok(!all.includes(bad), `leak: ${bad}`);
assert.ok(!all.includes("03222222222"), "phone masked"); assert.ok(all.includes("0322-•••-2222"));
pass("no cost/profit/internal notes/approver ids exposed; phone masked");

// --- cross-customer denial
await run(as(UB));
assert.equal((await one(`select fn_my_bills(null,null,50)`))[0].total, 777);
assert.ok(!JSON.stringify(await one(`select fn_my_orders(50)`)).includes("AO-0015"));
await run(reset);
await throws(as(UB) + `select fn_my_submit_payment_claim(100, 'cash', current_date, null, null, null, '${CC}')`, /Sirf apna/, "B cannot claim for C");
await throws(as(UB) + `select fn_my_request_change('address', 'x', '${CC}')`, /Sirf apna/, "B cannot change C");
pass("customer B never sees or writes customer C");

// --- anon blocked
await throws(`set role anon; select fn_my_bills(null,null,10)`, /permission denied/, "anon bills");
await throws(`set role anon; select fn_my_requests()`, /permission denied/, "anon requests");
await throws(`set role anon; select * from customer_payment_claims`, /permission denied/, "anon table");
pass("anon blocked from functions and tables");

// --- direct writes blocked (only RPCs)
await throws(as(UC) + `insert into customer_payment_claims (customer_id, amount, method, paid_on, created_by) values ('${CC}', 5, 'cash', current_date, '${UC}')`, /permission denied/, "direct insert");
// --- customer requests via RPC
await run(as(UC));
const CL = await one(`select fn_my_submit_payment_claim(12000, 'jazzcash', current_date, 'JC-55120', '${CC}/p1.jpg', null, null)`);
const CH = await one(`select fn_my_request_change('address', 'Chak 10, Mahabali', null)`);
const PR = await one(`select fn_my_request_promise(50000, current_date + 9, 'v3', true, null)`);
const DS = await one(`select fn_my_open_dispute('rate galat', 'POS-1', null)`);
const mine = await one(`select fn_my_requests()`);
await run(reset);
assert.equal(mine.claims.length, 1); assert.equal(mine.changes[0].field, "address"); assert.equal(mine.promises.length, 1); assert.equal(mine.disputes.length, 1);
await throws(as(UC) + `select fn_my_submit_payment_claim(1, 'cash', current_date, null, '${CB}/x.jpg', null, null)`, /apne folder/, "proof other folder");
await throws(as(UC) + `select fn_my_submit_payment_claim(1, 'cash', current_date + 1, null, null, null, null)`, /Tareekh/, "future date");
await throws(as(UC) + `select fn_my_request_promise(10, current_date + 40, 'v3', true, null)`, /30 din/, "promise > 30 days");
await throws(as(UC) + `select fn_my_request_promise(10, current_date + 4, 'v3', false, null)`, /Sharaait/, "terms not accepted");
await throws(as(UC) + `select fn_my_request_change('address', 'again', null)`, /pehle se/, "duplicate pending change");
await throws(as(UC) + `update customer_payment_claims set amount = 1 where id = '${CL}'`, /permission denied/, "direct update");
pass("customer creates requests only via checked RPCs (folder, date, terms, duplicates, no direct writes)");

// --- staff scope: branch, shared dept login, hr
assert.equal(await asOne(USAL, `select fn_cp_staff_can('${CC}')`), true);
assert.equal(await asOne(USAL, `select fn_cp_staff_can('${CB}')`), false, "other branch");
assert.equal(await asOne(UDEPT, `select fn_cp_staff_can('${CC}')`), false, "shared dept login (no branch) blocked");
assert.equal(await asOne(UHR, `select fn_cp_staff_can('${CC}')`), false, "hr not customer-facing");
assert.equal(await asOne(UOWN, `select fn_cp_staff_can('${CB}')`), true);
assert.equal(await asOne(UC, `select fn_cp_staff_can('${CC}')`), false, "customer is not staff for self");
await throws(as(UDEPT) + `select fn_admin_customer_portal()`, /ijazat/, "dept login admin page");
assert.equal(await asOne(UC, `select jsonb_array_length(fn_cp_queue())`), 0, "customer queue empty");
assert.equal(await asOne(USAL2, `select count(*) from customer_payment_claims`), 0, "other branch staff sees no rows");
assert.equal(await asOne(UB, `select count(*) from customer_payment_claims`), 0, "other customer sees no rows");
assert.equal(await asOne(UC, `select count(*) from customer_payment_claims`), 1);
assert.equal(await asOne(UOWN, `select count(*) from customer_payment_claims`), 1);
const adm = await asOne(UOWN, `select fn_admin_customer_portal()`);
assert.equal(adm.length, 3); assert.equal(adm.find((x) => x.name === "C store").portal, "active"); assert.equal(adm.find((x) => x.name === "A dukaan").portal, "none");
assert.equal(adm.find((x) => x.name === "C store").pending, 4);
assert.equal((await asOne(USAL, `select fn_admin_customer_portal()`)).length, 2, "branch staff: own branch only");
pass("RLS + scope: own rows / own branch / admin all; shared dept logins and hr blocked");

// --- maker-checker
await throws(as(UC) + `select fn_cp_check('claim', '${CL}', null)`, /ijazat|Apni/, "customer cannot check own");
await throws(as(UFIN) + `select fn_cp_approve('claim', '${CL}', '${FIN}')`, /Pehle doosra/, "approve before check");
await run(as(USAL) + `select fn_cp_check('claim', '${CL}', 'screenshot match')`); await run(reset);
await throws(as(USAL) + `select fn_cp_approve('claim', '${CL}', '${FIN}')`, /maker-checker|Check karne wala/, "maker cannot approve");
const balBefore = Number(await one(`select coalesce(sum(debit-credit),0) from journal_lines where party_id='${CC}' and account_code='1100'`));
assert.equal(balBefore, 11200, "balance unchanged after submit + check");
await throws(`update customer_payment_claims set approved_by = checked_by, status='approved', journal_entry_id=gen_random_uuid() where id='${CL}'`, /cpc_checker_not_maker/, "DB constraint: approver != maker (even as superuser)");
await run(as(UFIN)); const res = await one(`select fn_cp_approve('claim', '${CL}', '${FIN}')`); await run(reset);
assert.equal(res.ok, true);
const balAfter = Number(await one(`select coalesce(sum(debit-credit),0) from journal_lines where party_id='${CC}' and account_code='1100'`));
assert.equal(balAfter, balBefore - 12000, "balance changes only on checker approval");
await throws(as(UOWN) + `select fn_cp_reject('claim', '${CL}', 'late')`, /Faisla/, "approved claim locked");
await throws(`update customer_payment_claims set amount = 1 where id='${CL}'`, /Faisla ho chuka/, "approved row locked even for superuser");
pass("maker-checker in DB: self-approval blocked, maker != checker, balance moves only on approval, approved row locked");

// --- change + promise + dispute
await run(as(USAL) + `select fn_cp_check('change', '${CH}', null); select fn_cp_check('promise', '${PR}', null);`); await run(reset);
await throws(as(USAL) + `select fn_cp_approve('change', '${CH}', null)`, /Check karne wala|Owner/, "sales cannot approve");
await run(as(UOWN) + `select fn_cp_approve('change', '${CH}', null); select fn_cp_approve('promise', '${PR}', null);`); await run(reset);
assert.equal(await one(`select address from customers where id='${CC}'`), "Chak 10, Mahabali");
const np = await q(`select * from payment_promises where party_id='${CC}' and signature_ref like 'portal:%'`);
assert.equal(np.length, 1); assert.equal(np[0].terms_accepted_by, UC); assert.equal(np[0].approved_by, UOWN); assert.notEqual(np[0].approved_by, np[0].terms_accepted_by);
await throws(as(USAL) + `select fn_cp_dispute_update('${DS}', 'closed', 'x')`, /Note/, "dispute note needed");
await run(as(USAL) + `select fn_cp_dispute_update('${DS}', 'reviewed', 'rate check kiya, sahi hai')`); await run(reset);
assert.equal(await one(`select status from customer_khata_disputes where id='${DS}'`), "reviewed");
const R2 = await asOne(UC, `select fn_my_submit_payment_claim(500, 'cash', current_date, null, null, null, null)`);
await throws(as(USAL) + `select fn_cp_reject('claim', '${R2}', '')`, /Wajah/, "reject needs reason");
await run(as(USAL) + `select fn_cp_reject('claim', '${R2}', 'raseed nahi mili')`); await run(reset);
pass("change applied + promise created only on checker approval; dispute note; reject needs reason");

// --- no delete, for anyone
await throws(as(UOWN) + `delete from customer_payment_claims where id='${R2}'`, /permission denied/, "owner delete via API");
await throws(`delete from customer_payment_claims where id='${R2}'`, /mitayi nahi/, "superuser delete blocked by trigger");
await throws(`delete from customer_khata_disputes`, /mitayi nahi/, "dispute delete");
assert.equal(await one(`select count(*) from pg_policies where tablename like 'customer_%' and cmd in ('DELETE','INSERT','UPDATE','ALL')`), 0);
assert.equal(await one(`select count(*) from pg_policies where tablename='objects' and policyname like 'customer_proofs%' and cmd in ('DELETE','UPDATE')`), 0);
pass("no delete for anyone (trigger + no policy); proofs bucket has no update/delete policy");

// --- storage folder
await run(as(UC) + `insert into storage.objects (bucket_id, name) values ('customer-proofs', '${CC}/a.jpg')`); await run(reset);
await throws(as(UC) + `insert into storage.objects (bucket_id, name) values ('customer-proofs', '${CB}/a.jpg')`, /row-level security/, "other folder upload");
assert.equal(await asOne(UB, `select count(*) from storage.objects where bucket_id='customer-proofs'`), 0);
assert.equal(await asOne(USAL, `select count(*) from storage.objects where bucket_id='customer-proofs'`), 1);
assert.equal(await one(`select public from storage.buckets where id='customer-proofs'`), false);
pass("proof uploads: private bucket, own folder only, branch staff read");

// --- rate limit
await run(as(UC));
for (let i = 0; i < 9; i++) await run(`select fn_my_open_dispute('msg ${i}', null, null)`);
await run(reset);
await throws(as(UC) + `select fn_my_open_dispute('one more', null, null)`, /had poori/, "rate limit 10/day");
pass("rate limit 10 per day per table");

console.log(`portal-customer-sql: ${ok} passed`);
