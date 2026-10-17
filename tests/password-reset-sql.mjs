// Real SQL test: 559 ko PGlite (in-process Postgres) par chalata hai -- live DB nahi.
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const run = (sql) => db.exec(sql);
const q = async (sql, p = []) => (await db.query(sql, p)).rows;
const one = async (sql, p = []) => Object.values((await q(sql, p))[0])[0];
const sql559 = fs.readFileSync("supabase/migrations/559_password_reset_otp.sql", "utf8");

await run(fs.readFileSync("tests/sql/password-reset-stubs.sql", "utf8"));
await run(sql559);
await run(sql559); // idempotent

// additive only: koi table drop/truncate nahi
assert.doesNotMatch(sql559, /\bdrop table\b|\btruncate\b|\bdrop column\b/i);

const OWNER = "00000000-0000-0000-0000-00000000000a", FARMER = "00000000-0000-0000-0000-00000000000b",
  STAFF = "00000000-0000-0000-0000-00000000000c", PHONE = "00000000-0000-0000-0000-00000000000d";
await run(`insert into auth.users (id, email) values ('${OWNER}','owner@alranatraders.pk'),('${FARMER}','f@x.pk'),
  ('${STAFF}','staff@alranatraders.pk'),('${PHONE}','3226275476@phone.agribridge.local');
  insert into profiles (id, full_name, role, phone_number) values ('${OWNER}','Owner','owner',null),('${STAFF}','Staff','sales_staff','0300-1112223');
  insert into farmers (user_id, full_name, phone_number, phone_key) values ('${FARMER}','Kisan','03214445556','3214445556');`);

// user lookup
assert.equal(await one(`select fn_password_reset_user_for_email('  OWNER@alranatraders.pk ')`), OWNER);
assert.equal(await one(`select fn_password_reset_user_for_email('aurangzaibranapk@gmail.com')`), null);
assert.equal(await one(`select fn_password_reset_user_for_phone('3214445556')`), FARMER);
assert.equal(await one(`select fn_password_reset_user_for_phone('3001112223')`), STAFF);
assert.equal(await one(`select fn_password_reset_user_for_phone('3226275476')`), PHONE);
assert.equal(await one(`select fn_password_reset_user_for_phone('3999999999')`), null);

// rate limit: cooldown 60s, 5/ghanta per identifier, 20/ghanta per IP
assert.equal(await one(`select fn_password_reset_guard('1.1.1.1','h1','request')`), 0);
await run(`select fn_password_reset_log('request','whatsapp','h1',null,'1.1.1.1','ua',null)`);
const cool = await one(`select fn_password_reset_guard('1.1.1.1','h1','request')`);
assert.ok(cool > 0 && cool <= 60, "60s cooldown");
await run(`update password_reset_audit set created_at = now() - interval '2 minutes'`);
assert.equal(await one(`select fn_password_reset_guard('1.1.1.1','h1','request')`), 0);
await run(`insert into password_reset_audit (event, channel, identifier_hash, ip, created_at)
  select 'request','whatsapp','h1','2.2.2.2', now() - interval '10 minutes' from generate_series(1,4)`);
assert.ok(await one(`select fn_password_reset_guard('3.3.3.3','h1','request')`) > 60, "5/ghanta per identifier");
await run(`insert into password_reset_audit (event, channel, identifier_hash, ip, created_at)
  select 'request','email','x'||g,'9.9.9.9', now() - interval '5 minutes' from generate_series(1,20) g`);
assert.ok(await one(`select fn_password_reset_guard('9.9.9.9','fresh','request')`) > 0, "20/ghanta per IP");
assert.equal(await one(`select fn_password_reset_guard('8.8.8.8','fresh','request')`), 0);
await run(`insert into password_reset_audit (event, channel, identifier_hash, ip)
  select 'verify_fail','whatsapp','v','7.7.7.7' from generate_series(1,30)`);
assert.ok(await one(`select fn_password_reset_guard('7.7.7.7','v','verify')`) > 0, "30 verify/ghanta per IP");
await assert.rejects(() => db.exec(`select fn_password_reset_log('bogus','email','h')`), /check/i);

// token: issue -> consume once -> expired rejected; naya token purana band karta hai
const t1 = await one(`select fn_password_reset_issue('${OWNER}','hashA','whatsapp',10)`);
assert.ok(t1);
const t2 = await one(`select fn_password_reset_issue('${OWNER}','hashB','whatsapp',10)`);
assert.ok(t2);
assert.equal(await one(`select fn_password_reset_consume('hashA')`), null, "purana token band");
assert.equal(await one(`select fn_password_reset_consume('hashB')`), OWNER);
assert.equal(await one(`select fn_password_reset_consume('hashB')`), null, "sirf ek dafa");
await run(`select fn_password_reset_issue('${OWNER}','hashC','email',30); update password_reset_tokens set expires_at = now() - interval '1 second' where token='hashC'`);
assert.equal(await one(`select fn_password_reset_consume('hashC')`), null, "expired");
await assert.rejects(() => db.exec(`select fn_password_reset_issue('${OWNER}','h','sms',5)`), /channel/);

// sessions revoke
await run(`insert into auth.sessions (user_id) values ('${OWNER}'),('${OWNER}'),('${STAFF}');
  insert into auth.refresh_tokens (user_id, token) values ('${OWNER}','r1'),('${STAFF}','r2');
  select fn_password_reset_revoke_sessions('${OWNER}');`);
assert.equal(await one(`select count(*)::int from auth.sessions where user_id='${OWNER}'`), 0);
assert.equal(await one(`select count(*)::int from auth.sessions`), 1, "doosron ke session salamat");
assert.equal(await one(`select count(*)::int from auth.refresh_tokens`), 1);

// permissions: anon/authenticated functions nahi chala sakte; audit sirf admin parhe
for (const role of ["anon", "authenticated"]) {
  assert.equal(await one(`select has_function_privilege('${role}','public.fn_password_reset_consume(text)','execute')`), false);
  assert.equal(await one(`select has_function_privilege('${role}','public.fn_password_reset_user_for_email(text)','execute')`), false);
}
assert.equal(await one(`select has_function_privilege('service_role','public.fn_password_reset_issue(uuid,text,text,integer)','execute')`), true);
assert.equal(await one(`select has_table_privilege('anon','public.password_reset_audit','select')`), false);
assert.equal(await one(`select relrowsecurity from pg_class where relname='password_reset_audit'`), true);

console.log("PASS: 559 password reset (lookup, rate limit, one-time token, sessions, grants)");
