// Real SQL test: 580 ko PGlite (in-process Postgres) par chalata hai -- live DB nahi.
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const run = (s) => db.exec(s);
const q = async (s) => (await db.query(s)).rows;
const sql = fs.readFileSync("supabase/migrations/580_portal_accounts.sql", "utf8");
await run(fs.readFileSync("tests/sql/portal-accounts-stubs.sql", "utf8"));
await run(sql); await run(sql); // idempotent
assert.doesNotMatch(sql, /\bdrop table\b|\btruncate\b|\bdrop column\b|\bdelete from\b/i, "sirf additive");

const OWNER = "00000000-0000-0000-0000-00000000000a", ADMIN2 = "00000000-0000-0000-0000-00000000000e", FARM = "00000000-0000-0000-0000-00000000000b",
  GMAIL = "00000000-0000-0000-0000-00000000000c", STAFF = "00000000-0000-0000-0000-00000000000d", CUST = "00000000-0000-0000-0000-00000000000f";
await run(`insert into auth.users (id,email,banned_until) values ('${OWNER}','owner@x.pk',null),('${ADMIN2}','admin@x.pk',null),
  ('${FARM}','3226275476@phone.agribridge.local',null),('${GMAIL}','g@gmail.com', now()+interval '876000 hours'),('${STAFF}','s@x.pk',null),('${CUST}','c@x.pk',null);
  insert into profiles (id,full_name,role) values ('${OWNER}','Owner','owner'),('${ADMIN2}','Admin','admin'),('${FARM}','Kisan','farmer'),('${STAFF}','Staff','sales_staff'),('${CUST}','Cust','customer');
  insert into farmers (user_id,full_name,farmer_code,phone_number) values ('${FARM}','Aurangzaib Rana','FRM-000003','03226275476');
  insert into customers (user_id,name,phone_number) values ('${CUST}','Ali Customer','03001112223');`);

// service role (uid null): sirf portal + bina-profile accounts, staff/owner nahi
let rows = await q(`select * from fn_portal_accounts()`);
const ids = rows.map((r) => r.user_id).sort();
assert.deepEqual(ids, [FARM, GMAIL, CUST].sort());
const f = rows.find((r) => r.user_id === FARM);
assert.equal(f.record_code, "FRM-000003"); assert.equal(f.record_type, "farmer"); assert.equal(f.has_profile, true);
const g = rows.find((r) => r.user_id === GMAIL);
assert.equal(g.has_profile, false); assert.ok(g.banned_until); assert.equal(g.record_type, null);
assert.equal(rows.find((r) => r.user_id === CUST).record_type, "customer");

// admin parh sakta, staff / kisan nahi
await run(`set test.uid = '${OWNER}'`);
assert.equal((await q(`select fn_is_portal_admin() a`))[0].a, true);
assert.equal((await q(`select * from fn_portal_accounts()`)).length, 3);
await run(`set test.uid = '${STAFF}'`);
assert.equal((await q(`select fn_is_portal_admin() a`))[0].a, false);
await assert.rejects(() => q(`select * from fn_portal_accounts()`), /Sirf Owner ya Admin/);
await run(`set test.uid = '${FARM}'`);
await assert.rejects(() => q(`select * from fn_portal_accounts()`), /Sirf Owner ya Admin/);
await run(`update profiles set is_active=false where id='${ADMIN2}'; set test.uid = '${ADMIN2}'`);
assert.equal((await q(`select fn_is_portal_admin() a`))[0].a, false, "band admin nahi");
await run(`reset test.uid`);

// maker-checker + ek waqt ek pending
await run(`insert into portal_account_delete_requests (target_user_id,reason,requested_by) values ('${FARM}','test','${OWNER}')`);
await assert.rejects(() => run(`insert into portal_account_delete_requests (target_user_id,reason,requested_by) values ('${FARM}','dobara','${ADMIN2}')`), /duplicate|unique/i);
await assert.rejects(() => run(`update portal_account_delete_requests set status='approved', decided_by='${OWNER}'`), /maker_checker/);
await run(`update portal_account_delete_requests set status='approved', decided_by='${ADMIN2}'`);
assert.equal((await q(`select pending_delete_id from fn_portal_accounts() where user_id='${FARM}'`))[0].pending_delete_id, null);

// logs: checks
await assert.rejects(() => run(`insert into portal_account_actions (actor_id,target_user_id,action,reason) values ('${OWNER}','${GMAIL}','bogus','x')`), /check/i);
await assert.rejects(() => run(`insert into portal_account_actions (actor_id,target_user_id,action,reason) values ('${OWNER}','${GMAIL}','suspend','  ')`), /check/i);
await run(`insert into portal_account_actions (actor_id,target_user_id,action,reason) values ('${OWNER}','${GMAIL}','suspend','Owner ne 17 Oct ko band karwaya')`);
await assert.rejects(() => run(`insert into portal_whatsapp_sends (sent_by,target_user_id,status) values ('${OWNER}','${FARM}','maybe')`), /check/i);
await run(`insert into portal_whatsapp_sends (sent_by,target_user_id,phone,template,status) values ('${OWNER}','${FARM}','03226275476','account_created_notice','sent')`);
assert.ok((await q(`select last_whatsapp_at from fn_portal_accounts() where user_id='${FARM}'`))[0].last_whatsapp_at);

// RLS on, anon ke paas kuch nahi
for (const t of ["portal_account_actions", "portal_account_delete_requests", "portal_whatsapp_sends"]) {
  assert.equal((await q(`select relrowsecurity r from pg_class where relname='${t}'`))[0].r, true, t + " RLS");
  assert.equal((await q(`select has_table_privilege('anon','public.${t}','select') p`))[0].p, false, t + " anon");
  assert.equal((await q(`select has_table_privilege('authenticated','public.${t}','insert') p`))[0].p, false, t + " client insert");
}
assert.equal((await q(`select has_function_privilege('anon','public.fn_portal_accounts()','execute') p`))[0].p, false);

// auth user mitne par khata bachta hai (FK set null)
await run(`delete from auth.users where id='${CUST}'`);
assert.equal((await q(`select count(*)::int n from customers where name='Ali Customer' and user_id is null`))[0].n, 1);
console.log("portal-accounts SQL (PGlite): OK");
