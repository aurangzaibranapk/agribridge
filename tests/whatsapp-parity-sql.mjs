// Real SQL test: 610 + 613 (WhatsApp = App, Phase 1) PGlite par -- live DB nahi.
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const run = (s) => db.exec(s);
const q = async (s) => (await db.query(s)).rows;
const one = async (s) => Object.values((await db.query(s)).rows[0] ?? {})[0];
const throws = async (s, re) => {
  let err = null; try { await run(s); } catch (e) { err = e; }
  await run("reset role;");
  assert.ok(err, `expected error for: ${s}`); if (re) assert.match(String(err.message), re);
};
let ok = 0; const pass = (n) => { ok++; console.log(`  ok  ${n}`); };

await run(`
create role anon; create role authenticated; create role service_role bypassrls; -- Supabase jaisa
create schema auth; grant usage on schema auth to public;
-- Supabase ka asal auth.uid()
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $$;
create function public.fn_phone_key(p text) returns text language sql immutable as $$
  select nullif(right(regexp_replace(coalesce(p,''), '\\D', '', 'g'), 10), '') $$;
create table profiles (id uuid primary key, role text, branch_id uuid, full_name text, phone_number text, is_active boolean default true);
create table staff_details (profile_id uuid, whatsapp_number text, whatsapp_verified_at timestamptz);
create table farmers (id uuid primary key, user_id uuid, full_name text, phone text,
  phone_key text generated always as (right(regexp_replace(coalesce(phone,''), '\\D', '', 'g'), 10)) stored,
  is_deleted boolean default false, created_at timestamptz default now());
create table customers (id uuid primary key, user_id uuid, farmer_id uuid, branch_id uuid, name text, phone_number text, is_active boolean default true, is_deleted boolean default false);
create table admin_whatsapp_numbers (phone_key text, is_active boolean default true);
create table agri_orders (order_number text, status text, grand_total numeric, created_at timestamptz default now(), customer_id uuid);
create table pos_sales (total_amount numeric, payment_mode text, status text, branch_id uuid, created_at timestamptz default now());
create table finance_accounts (account_type text, current_balance numeric, is_active boolean default true);
-- 565 / 582 stubs: auth.uid() par chalte hain (asal jaise)
create function fn_my_khata_scope() returns table (customer_ids uuid[]) language sql stable as $$
  select coalesce(array_agg(c.id), array[]::uuid[]) from customers c
   where c.user_id = auth.uid() or c.farmer_id in (select f.id from farmers f where f.user_id = auth.uid()) $$;
create function fn_my_khata_summary(p uuid) returns jsonb language sql stable as $$
  select jsonb_build_object('who', auth.uid(), 'owed', (select count(*) from customers c where c.id = any(coalesce((select s.customer_ids from fn_my_khata_scope() s), array[]::uuid[])))) $$;
create function fn_my_khata_statement(p_from date, p_to date) returns table (entry_date date, ref text, category text, tafseel text, udhaar numeric, adaigi numeric, baqaya numeric, is_opening boolean)
  language sql stable as $$ select current_date, 'INV-' || auth.uid()::text, 'sale', null::text, 1::numeric, 0::numeric, 1::numeric, false where auth.uid() is not null $$;
create function public.fn_is_any_staff() returns boolean language sql stable as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role not in ('farmer','customer')) $$;
create table pos_returns (id uuid primary key default gen_random_uuid(), return_number text, branch_id uuid,
  total_amount numeric, created_by uuid, admin_review_status text, created_at timestamptz default now());
create table leave_requests (id uuid primary key default gen_random_uuid(), profile_id uuid, manager_id uuid, leave_type text, status text, created_at timestamptz default now());
create table data_health_findings (id uuid primary key default gen_random_uuid(), title text, amount numeric, status text, detected_at timestamptz default now());
create table features (key text primary key, route text, is_active boolean default true);
create table user_feature_permissions (profile_id uuid, feature_key text, actions text[], starts_at timestamptz, expires_at timestamptz);
create view v_user_feature_access as select u.profile_id, f.key as feature_key, f.route, u.actions from user_feature_permissions u
  join features f on f.key = u.feature_key and f.is_active where (u.expires_at is null or u.expires_at > now());
`);

await run(fs.readFileSync("supabase/migrations/582_admin_pending_badges.sql", "utf8")); // ASAL 582 (stub nahi)

const M610 = fs.readFileSync("supabase/migrations/610_whatsapp_identity.sql", "utf8");
const M613 = fs.readFileSync("supabase/migrations/613_whatsapp_read_reports.sql", "utf8");
for (const M of [M610, M613]) {
  const code = M.replace(/--.*$/gm, "")
    // 610 ka sirf apna naya wamid log table jaiz hai
    .replace(/create table if not exists public\.whatsapp_processed_messages/g, "")
    .replace(/alter table public\.whatsapp_processed_messages enable row level security/g, "")
    .replace(/insert into public\.whatsapp_processed_messages/g, "");
  assert.doesNotMatch(code, /\bdrop\s|\btruncate\b|\bdelete\s+from\b|\bupdate\s+public\.|\binsert\s+into\b|\balter\s+table\b|\bcreate\s+table\b/i);
  assert.doesNotMatch(code, /net\.http|pg_net|whatsapp_send|send_email/i);
}
await run(M610); await run(M610); await run(M613); await run(M613);
const R = ["610_whatsapp_identity", "613_whatsapp_read_reports"].map((n) => fs.readFileSync(`supabase/rollbacks/${n}.rollback.sql`, "utf8"));
pass("610/613 additive (no DDL on tables, no DML, no sends), idempotent, rollbacks present");

// grants: sirf service_role
for (const f of ["fn_wa_resolve_identity", "fn_wa_identity_candidates", "fn_wa_today_sales", "fn_wa_cash_position", "fn_wa_my_khata", "fn_wa_my_orders", "fn_wa_my_recent_lines", "fn_wa_pending_counts", "fn_wa_act_as", "fn_wa_role", "fn_wa_claim_message"]) {
  const oid = await one(`select oid from pg_proc where proname='${f}'`);
  for (const r of ["anon", "authenticated", "public"]) {
    const has = r === "public"
      ? await one(`select exists(select 1 from pg_proc p, aclexplode(p.proacl) a where p.oid=${oid} and a.grantee=0)`)
      : await one(`select has_function_privilege('${r}', ${oid}, 'execute')`);
    assert.equal(has, false, `${f} ${r}`);
  }
  assert.equal(await one(`select has_function_privilege('service_role', ${oid}, 'execute')`), true, f);
}
await throws(`set role authenticated; select fn_wa_my_khata('00000000-0000-0000-0000-0000000000a1')`, /permission denied/);
pass("execute only for service_role (authenticated can't read someone else by passing a user id)");

const OWN = "00000000-0000-0000-0000-0000000000a1", ADM = "00000000-0000-0000-0000-0000000000a2";
const FIN = "00000000-0000-0000-0000-0000000000a3", STK = "00000000-0000-0000-0000-0000000000a4";
const FRM = "00000000-0000-0000-0000-0000000000a5", CUS = "00000000-0000-0000-0000-0000000000a6";
const MGR = "00000000-0000-0000-0000-0000000000a7", X1 = "00000000-0000-0000-0000-0000000000a8", X2 = "00000000-0000-0000-0000-0000000000a9";
const B1 = "00000000-0000-0000-0000-0000000000b1", B2 = "00000000-0000-0000-0000-0000000000b2";
const F1 = "00000000-0000-0000-0000-0000000000f1", C1 = "00000000-0000-0000-0000-0000000000c1", C2 = "00000000-0000-0000-0000-0000000000c2", C3 = "00000000-0000-0000-0000-0000000000c3";
await run(`
insert into profiles values ('${OWN}','owner',null,'Owner','03226275476',true),('${ADM}','admin',null,'Admin','03126513294',true),
 ('${FIN}','finance',null,'Fin',null,true),('${STK}','store_keeper','${B1}','Store',null,true),('${FRM}','farmer',null,'Kisan',null,true),
 ('${CUS}','customer',null,'Cust',null,true),('${MGR}','manager','${B1}','Mgr','03000000007',true),
 ('${X1}','sales_staff',null,'A','03000000009',true),('${X2}','sales_staff',null,'B','+92 300 0000009',true);
insert into staff_details values ('${FIN}','923000000002', now()), ('${STK}','923000000001', null);
insert into farmers (id,user_id,full_name,phone) values ('${F1}','${FRM}','Kisan','03000000003');
insert into customers values ('${C1}','${CUS}',null,'${B1}','Cust','03457583294',true,false),('${C2}',null,'${F1}','${B1}','KisanCust','03000000003',true,false),
 ('${C3}',null,null,'${B1}','Other','03111111111',true,false);
insert into admin_whatsapp_numbers values ('3126513294',true);
insert into agri_orders values ('ORD-C1','confirmed',100,now(),'${C1}'),('ORD-C2','confirmed',200,now(),'${C2}'),('ORD-C3','confirmed',300,now(),'${C3}');
insert into pos_sales values (100,'cash','completed','${B1}',now()),(50,'khata','returned','${B2}',now()),(999,'cash','completed','${B1}',now()-interval '3 days');
insert into finance_accounts values ('cash',500,true),('bank',900,true),('cash',7,false);
`);
await run("set role service_role;");
const id = async (k) => (await q(`select * from fn_wa_resolve_identity('${k}')`))[0];
assert.equal((await id("3226275476")).kind, "owner");
assert.equal((await id("923126513294")).kind, "admin");
assert.equal((await id("3126513294")).listed_admin, true);
assert.equal((await id("3000000002")).kind, "staff");   // verified staff WA
assert.equal((await id("3000000001")).kind, "unknown"); // unverified staff WA => nahi
let f = await id("3000000003"); assert.equal(f.kind, "farmer"); assert.equal(f.user_id, FRM); assert.deepEqual(f.customer_ids, [C2]);
assert.equal((await id("3457583294")).kind, "customer");
assert.equal((await id("3111111111")).kind, "unknown");  // customer bina login
assert.equal((await id("3000000009")).kind, "ambiguous"); // do accounts
assert.equal((await id("12")).kind, "unknown");
pass("identity: owner/admin/staff(verified only)/farmer/customer, unknown, ambiguous");

// impersonation + scoping
const k = await one(`select fn_wa_my_khata('${CUS}')`); assert.equal(k.who, CUS);
assert.deepEqual((await q(`select order_number from fn_wa_my_orders('${CUS}', 5)`)).map((r) => r.order_number), ["ORD-C1"]);
assert.deepEqual((await q(`select order_number from fn_wa_my_orders('${FRM}', 5)`)).map((r) => r.order_number), ["ORD-C2"]);
assert.equal((await q(`select * from fn_wa_my_recent_lines('${FRM}', 5)`))[0].ref, "INV-" + FRM);
// set_config(..., true): claim transaction ke baad baqi nahi rehta
assert.equal(await one(`select auth.uid()`), null);
pass("farmer/customer see only own khata/orders/lines; impersonation is transaction-local");

const s = await one(`select fn_wa_today_sales('${OWN}')`); assert.equal(Number(s.total), 150); assert.equal(Number(s.cash), 100); assert.equal(Number(s.returned_bills), 1);
assert.equal(Number((await one(`select fn_wa_today_sales('${MGR}')`)).total), 100, "manager: own branch only");
assert.equal(Number((await one(`select fn_wa_today_sales('${FIN}')`)).total), 150);
for (const u of [STK, FRM, CUS]) await throws(`set role service_role; select fn_wa_today_sales('${u}')`, /ijazat nahi/);
const c = await one(`select fn_wa_cash_position('${ADM}')`); assert.equal(Number(c.cash), 500); assert.equal(Number(c.bank), 900);
for (const u of [MGR, STK, FRM, CUS]) await throws(`set role service_role; select fn_wa_cash_position('${u}')`, /ijazat nahi/);
await run("set role service_role;");
for (const u of [FRM, CUS]) await throws(`set role service_role; select * from fn_wa_pending_counts('${u}')`, /sirf staff/);
await throws(`set role service_role; select fn_wa_act_as(null)`, /zaroori/);
pass("role refusals in DB: sales/cash/pending blocked for wrong roles; manager branch-scoped");

// --- dept + branch scope at DB level (asal 582 ke sath)
await run(`reset role;
insert into pos_returns (return_number, branch_id, total_amount, created_by, admin_review_status) values
  ('RET-1','${B1}',10,null,'pending'),('RET-2','${B1}',20,null,'pending'),('RET-3','${B2}',30,null,'pending');
insert into leave_requests (profile_id, manager_id, leave_type, status) values ('${X1}','${STK}','casual','pending');
insert into features values ('pos-returns','/admin/pos'),('hr-leave','/admin/hr'),('old','/admin/pos/returns');
insert into user_feature_permissions values ('${STK}','pos-returns','{view}',null,null),
  ('${MGR}','pos-returns','{edit}',null,null), ('${MGR}','hr-leave','{view}',null,now() - interval '1 day');
update features set is_active = false where key = 'old';`);
await run("set role service_role;");
const pc = async (u) => Object.fromEntries((await q(`select * from fn_wa_pending_counts('${u}')`)).map((r) => [r.category, r]));
let p = await pc(STK);
assert.deepEqual(Object.keys(p), ["pos_returns"], "staff: sirf apne department ki category");
assert.equal(p.pos_returns.pending, 2, "staff: sirf apni branch (B1)");
assert.deepEqual(Object.keys(await pc(MGR)), [], "view nahi / ijazat expire => kuch nahi");
assert.deepEqual(Object.keys(await pc(X1)), [], "koi ijazat nahi => kuch nahi");
p = await pc(ADM); assert.equal(p.pos_returns.pending, 3, "admin: sab branches"); assert.ok("leave" in p || Object.keys(p).length > 1);
pass("pending counts: staff limited to own department (feature view) + own branch in DB; admin all");

// --- idempotency
assert.equal(await one(`select fn_wa_claim_message('wamid.A', '3226275476')`), true);
assert.equal(await one(`select fn_wa_claim_message('wamid.A', '3226275476')`), false, "retry");
assert.equal(await one(`select fn_wa_claim_message('wamid.B')`), true);
assert.equal(await one(`select count(*)::int from whatsapp_processed_messages`), 2);
await throws(`set role service_role; select fn_wa_claim_message('  ')`, /zaroori/);
await throws(`set role authenticated; select fn_wa_claim_message('wamid.C')`, /permission denied/);
await throws(`set role authenticated; select * from whatsapp_processed_messages`, /permission denied/);
await throws(`set role anon; insert into whatsapp_processed_messages values ('x', null, now())`, /permission denied/);
await run("reset role;");
pass("wamid claim: first true, retry false; table/fn closed to anon/authenticated");

// rollback
await run("reset role;"); for (const r of R) await run(r);
assert.equal(await one(`select count(*)::int from pg_proc where proname like 'fn_wa\\_%'`), 0);
assert.equal(await one(`select to_regclass('public.whatsapp_processed_messages') is null`), true);
pass("rollbacks remove every fn_wa_* function");
console.log(`\n${ok} passed`);
