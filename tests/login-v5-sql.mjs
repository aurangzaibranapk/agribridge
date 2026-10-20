// Real SQL test: 621 (login v5) ko PGlite (in-process Postgres) par chalata hai -- live DB nahi.
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const run = (sql) => db.exec(sql);
const q = async (sql) => (await db.query(sql)).rows;
const one = async (sql) => Object.values((await q(sql))[0] ?? { v: null })[0];
const mig = fs.readFileSync("supabase/migrations/621_login_v5.sql", "utf8");
const rb = fs.readFileSync("supabase/migrations/621_login_v5.rollback.sql", "utf8");

await run(fs.readFileSync("tests/sql/login-v5-stubs.sql", "utf8"));
assert.doesNotMatch(mig, /\bdrop table\b|\btruncate\b|\bdrop column\b|\bdelete from public\.(farmers|customers|profiles)\b/i, "additive only");

const U = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const OWNER = U(1), STAFF = U(2), HRSTAFF = U(3), DEALER = U(4), FARMER = U(5), OLDOTP = U(6), CUST = U(7), EMAILF = U(8);
await run(`
insert into auth.users (id, email, encrypted_password) values
 ('${OWNER}','owner@alranatraders.pk','$2a$x'), ('${STAFF}','staff@alranatraders.pk','$2a$x'), ('${HRSTAFF}','hr1@alranatraders.pk',''),
 ('${DEALER}','dealer@x.pk','$2a$x'), ('${FARMER}','3214445556@phone.agribridge.local','$2a$x'),
 ('${OLDOTP}','3226275476@phone.agribridge.local',''), ('${CUST}','c@x.pk','$2a$x'), ('${EMAILF}','3335556667@phone.agribridge.local','$2a$x');
insert into profiles (id, full_name, role, phone_number) values
 ('${OWNER}','Owner','owner','0322-6275476'), ('${STAFF}','Staff','sales_staff','03001112223'), ('${HRSTAFF}','HR Staff','warehouse',null),
 ('${DEALER}','Dealer','dealer',null), ('${FARMER}','Kisan','farmer',null), ('${OLDOTP}','Old','farmer',null), ('${CUST}','Cust','customer',null),
 ('${EMAILF}','EF','farmer',null);
insert into staff_details (profile_id, phone) values ('${HRSTAFF}','0311 7778889');
insert into dealers (user_id, phone_number) values ('${DEALER}','03124443332');
insert into farmers (user_id, full_name, phone_number, phone_key, username, registration_source, email) values
 ('${FARMER}','Kisan','03214445556','3214445556','kisan1','SELF',null),
 ('${OLDOTP}','FRM-102','03226275476','3226275476',null,'SELF',null),
 ('${EMAILF}','EF','03335556667','3335556667',null,'SELF','ef@gmail.com');
insert into customers (user_id, full_name, phone_number) values ('${CUST}','Cust','03451112222');
`);

// Seed exists BEFORE 621 (like live: old OTP farmer row on the owner number).
await run(mig);
await run(mig); // idempotent
// --- priority: owner number also has an old OTP-farmer login -> owner wins (the FRM-000102 bug)
const acc = await q(`select * from fn_login_accounts_for_phone('3226275476')`);
assert.equal(acc.length, 2);
assert.equal(acc[0].user_id, OWNER); assert.equal(acc[0].priority, 1);
let r = (await q(`select * from fn_login_resolve('phone','3226275476')`))[0];
assert.equal(r.user_id, OWNER); assert.equal(r.role, "owner"); assert.equal(r.has_password, true); assert.equal(r.real_email, true);

// --- staff via profiles.phone_number; HR staff via staff_details (no password yet -> first_time)
r = (await q(`select * from fn_login_resolve('phone','3001112223')`))[0];
assert.equal(r.user_id, STAFF); assert.equal(r.role, "sales_staff");
r = (await q(`select * from fn_login_resolve('phone','3117778889')`))[0];
assert.equal(r.user_id, HRSTAFF); assert.equal(r.has_password, false);
assert.equal(await one(`select fn_login_phone_is_staff('3117778889')`), true);
assert.equal(await one(`select fn_login_phone_is_staff('3214445556')`), false);

// --- dealer, farmer, customer, unknown
assert.equal((await q(`select * from fn_login_resolve('phone','3124443332')`))[0].role, "dealer");
assert.equal((await q(`select * from fn_login_resolve('phone','3214445556')`))[0].user_id, FARMER);
assert.equal((await q(`select * from fn_login_resolve('phone','3451112222')`))[0].user_id, CUST);
assert.equal((await q(`select * from fn_login_resolve('phone','3999999999')`)).length, 0);
assert.equal((await q(`select * from fn_login_resolve('phone','12')`)).length, 0);
assert.equal(await one(`select fn_login_role_priority('admin')`), 1);
assert.equal(await one(`select fn_login_role_priority('hr')`), 2);
assert.equal(await one(`select fn_login_role_priority('machinery_vendor')`), 3);
assert.equal(await one(`select fn_login_role_priority('customer')`), 4);

// --- email / username -> same single account (one person = one account)
assert.equal((await q(`select * from fn_login_resolve('email',' OWNER@alranatraders.pk ')`))[0].user_id, OWNER);
r = (await q(`select * from fn_login_resolve('email','ef@gmail.com')`))[0];
assert.equal(r.user_id, EMAILF, "farmers.email links to the same phone account");
assert.equal(r.real_email, false);
assert.equal((await q(`select * from fn_login_resolve('phone','3335556667')`))[0].user_id, EMAILF);
assert.equal((await q(`select * from fn_login_resolve('username','KISAN1')`))[0].user_id, FARMER);
assert.equal((await q(`select * from fn_login_resolve('email','nobody@x.pk')`)).length, 0);

// --- DB rule: staff/owner can never become a member
const NEWU = U(20);
await run(`insert into auth.users (id, email) values ('${NEWU}','new@x.pk'); insert into profiles (id, role) values ('${NEWU}','farmer')`);
await assert.rejects(() => run(`insert into farmers (full_name, phone_number, phone_key, registration_source) values ('X','03226275476','3226275476','SELF')`), /staff_cannot_be_member/);
await assert.rejects(() => run(`insert into farmers (full_name, phone_number, registration_source) values ('X','0311-7778889','SELF')`), /staff_cannot_be_member/, "HR phone");
await assert.rejects(() => run(`insert into farmers (user_id, full_name, phone_number, phone_key, registration_source) values ('${STAFF}','X','03009998887','3009998887','STAFF')`), /staff_cannot_be_member/, "staff login");
await assert.rejects(() => run(`insert into customers (user_id, full_name, phone_number) values ('${OWNER}','X','0300')`), /staff_cannot_be_member/);
await assert.rejects(() => run(`insert into customers (user_id, full_name, phone_number) values ('${NEWU}','X','03001112223')`), /staff_cannot_be_member/, "customer login with staff phone");
await assert.rejects(() => run(`update farmers set user_id = '${OWNER}' where user_id = '${FARMER}'`), /staff_cannot_be_member/);
// allowed: real new member, and staff-entered (non-self) farmer records without a staff login
await run(`insert into farmers (user_id, full_name, phone_number, phone_key, registration_source) values ('${NEWU}','New','03017776665','3017776665','SELF')`);
await run(`insert into farmers (full_name, phone_number, phone_key, registration_source) values ('Walk-in','03226275476','3226275477','STAFF')`);
await run(`insert into customers (full_name, phone_number) values ('POS walk-in','03001112223')`);

// --- lockout: 5 wrong passwords -> 15 min; next lock doubles; success clears
assert.equal(await one(`select fn_login_lock_remaining('${FARMER}')`), 0);
for (let i = 1; i <= 4; i++) assert.equal(await one(`select fn_login_password_failed('${FARMER}','h','1.1.1.1')`), 0);
let secs = await one(`select fn_login_password_failed('${FARMER}','h','1.1.1.1')`);
assert.equal(secs, 900);
const rem = await one(`select fn_login_lock_remaining('${FARMER}')`);
assert.ok(rem > 890 && rem <= 900);
// lock expires -> 5 more wrong -> 30 min
await run(`update auth_lockouts set locked_until = now() - interval '1 second'`);
assert.equal(await one(`select fn_login_lock_remaining('${FARMER}')`), 0);
for (let i = 1; i <= 4; i++) assert.equal(await one(`select fn_login_password_failed('${FARMER}','h','1.1.1.1')`), 0);
assert.equal(await one(`select fn_login_password_failed('${FARMER}','h','1.1.1.1')`), 1800);
await run(`select fn_login_password_ok('${FARMER}','h','1.1.1.1')`);
assert.equal(await one(`select fn_login_lock_remaining('${FARMER}')`), 0);
assert.equal(await one(`select count(*)::int from auth_lockouts`), 0);
// cap 24h
await run(`insert into auth_lockouts (user_id, locked_until, level) values ('${CUST}', now() - interval '1 second', 20)`);
for (let i = 1; i <= 4; i++) await run(`select fn_login_password_failed('${CUST}','c','2.2.2.2')`);
assert.equal(await one(`select fn_login_password_failed('${CUST}','c','2.2.2.2')`), 86400);

// --- rate limits
await run(`delete from login_attempts`);
for (let i = 0; i < 10; i++) {
  assert.equal(await one(`select fn_login_guard('3.3.3.3','id${i}','lookup')`), 0);
  await run(`select fn_login_log('lookup','id${i}',null,'3.3.3.3')`);
}
assert.ok(await one(`select fn_login_guard('3.3.3.3','fresh','lookup')`) > 0, "10 lookups/IP/minute");
assert.equal(await one(`select fn_login_guard('4.4.4.4','fresh','lookup')`), 0);
await run(`insert into login_attempts (event, identifier_hash, ip, created_at) select 'lookup','same','9.9.'||g, now() - interval '10 minutes' from generate_series(1,30) g`);
assert.ok(await one(`select fn_login_guard('5.5.5.5','same','lookup')`) > 0, "30 lookups/identifier/hour");
await run(`insert into login_attempts (event, identifier_hash, ip) select 'pw_fail','p'||g,'6.6.6.6' from generate_series(1,20) g`);
assert.ok(await one(`select fn_login_guard('6.6.6.6','x','password')`) > 0, "20 passwords/IP/10min");
await run(`insert into login_attempts (event, identifier_hash, ip) select 'otp_send','o'||g,'7.7.7.7' from generate_series(1,10) g`);
assert.ok(await one(`select fn_login_guard('7.7.7.7','x','otp_send')`) > 0, "10 OTP sends/IP/hour");
await assert.rejects(() => run(`select fn_login_guard('1.1.1.1','x','bogus')`), /Ghalat event/);
await assert.rejects(() => run(`select fn_login_log('bogus','x')`), /check/i);

// --- signup grant: single use, expiry
await run(`select fn_login_signup_grant_issue('g1','email','','New@Mail.com',10)`);
let g = (await q(`select * from fn_login_signup_grant_consume('g1')`))[0];
assert.equal(g.email, "new@mail.com"); assert.equal(g.phone_key, null);
assert.equal((await q(`select * from fn_login_signup_grant_consume('g1')`)).length, 0, "single use");
await run(`select fn_login_signup_grant_issue('g2','whatsapp','3017776665',null,10)`);
await run(`update login_signup_grants set expires_at = now() - interval '1 second' where token_hash = 'g2'`);
assert.equal((await q(`select * from fn_login_signup_grant_consume('g2')`)).length, 0, "expired");
await assert.rejects(() => run(`select fn_login_signup_grant_issue('g3','email','','',10)`), /check/i);

// --- email OTP rows allowed
await run(`insert into farmer_login_otps (phone_key, code_hash, sent_via, expires_at) values ('e:abc','h','email', now() + interval '5 minutes')`);

// --- rollback works and leaves data tables renamed (not dropped)
await run(rb);
assert.equal(await one(`select to_regclass('public.login_attempts_rb621') is not null`), true);
assert.equal(await one(`select to_regproc('public.fn_login_resolve') is null`), true);
await run(`insert into farmers (full_name, phone_number, phone_key, registration_source) values ('after rb','03226275476','3226275400','SELF')`);
console.log("login-v5-sql: all assertions passed");
