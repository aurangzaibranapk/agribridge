// Real SQL test: 560 + backfill ko PGlite (in-process Postgres) par chalata hai -- live DB nahi.
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const run = (sql) => db.exec(sql);
const q = async (sql, p = []) => (await db.query(sql, p)).rows;
const one = async (sql, p = []) => { const r = await q(sql, p); return r.length ? Object.values(r[0])[0] : undefined; };
const sql560 = fs.readFileSync("supabase/migrations/560_auto_profile_self_heal.sql", "utf8");
const backfill = fs.readFileSync("supabase/backfills/560_orphan_profiles_backfill.sql", "utf8");
let n = 0;
const ok = (m) => { n += 1; console.log("  ok -", m); };

await run(fs.readFileSync("tests/sql/auto-profile-stubs.sql", "utf8"));
await run(sql560);
await run(sql560); // idempotent
await run(`create trigger trg_on_auth_user_created after insert on auth.users for each row execute function public.fn_handle_new_user();`);
assert.doesNotMatch(sql560, /\bdrop table\b|\btruncate\b|\bdrop column\b|\bdelete from\b/i);
assert.doesNotMatch(backfill, /\bdelete from\b|\btruncate\b|\bdrop\b|\bupdate\s+public\.profiles\b/i);
ok("560 additive aur dobara chal sakti hai; backfill kuch mitata/badalta nahi");

const ORG2 = "00000000-0000-0000-0000-0000000000a2", BR = "00000000-0000-0000-0000-0000000000b1";
const ADMIN = "00000000-0000-0000-0000-000000000001", OWNERF = "8264b01b-0000-0000-0000-000000000002",
  CUST = "00000000-0000-0000-0000-000000000003", VEND = "00000000-0000-0000-0000-000000000004",
  DEAL = "00000000-0000-0000-0000-000000000005", GHOST = "00000000-0000-0000-0000-000000000006",
  DELF = "00000000-0000-0000-0000-000000000007", NEWF = "00000000-0000-0000-0000-000000000008";

// pehla signup super_admin, baqi metadata ke mutabiq
await run(`insert into auth.users (id, email, raw_user_meta_data) values
  ('${ADMIN}','admin@x.pk','{"full_name":"Admin"}'),
  ('${OWNERF}','3226275476@phone.agribridge.local','{"full_name":"Aurangzaib","role":"farmer"}'),
  ('${CUST}','c@x.pk','{}'), ('${VEND}','v@alranatraders.pk','{"full_name":"Vendor"}'),
  ('${DEAL}','d@x.pk','{"role":"dealer"}'), ('${GHOST}','zai@gmail.com','{"role":"sales_staff","full_name":"Ghost"}'),
  ('${DELF}','old@x.pk','{"role":"farmer"}')`);
assert.equal(await one(`select role::text from profiles where id='${ADMIN}'`), "super_admin");
assert.equal(await one(`select role::text from profiles where id='${OWNERF}'`), "farmer");
assert.equal(await one(`select role::text from profiles where id='${GHOST}'`), "customer", "sales_staff metadata se staff nahi banta (355)");
// trigger ka on conflict: profile pehle se ho to signup nahi tootta
await run(`insert into profiles (id, full_name, role) values ('${NEWF}','Pehle','farmer') on conflict do nothing`).catch(() => {});
ok("signup trigger chalta hai (pehla super_admin, metadata role, staff nahi)");

await run(`insert into farmers (user_id, full_name, phone_number, organization_id, branch_id) values ('${OWNERF}','Aurangzaib Rana','03226275476','${ORG2}','${BR}');
  insert into farmers (user_id, full_name, is_deleted) values ('${DELF}','Purana', true);
  insert into customers (user_id, name, phone_number, organization_id) values ('${CUST}','Gahak','0300','${ORG2}');
  insert into machinery_vendors (user_id, vendor_name, phone) values ('${VEND}','Noman Shah','0301');
  insert into dealers (user_id, business_name, organization_id) values ('${DEAL}','Dealer Co','${ORG2}');`);

// 17 Oct wali soorat: profile gum, login baqi
await run(`delete from profiles where id in ('${OWNERF}','${CUST}','${VEND}','${DEAL}','${GHOST}','${DELF}')`);
const list = await q(`select user_id::text, seed_role, seed_source from fn_auth_users_without_profile()`);
assert.equal(list.length, 6);
assert.deepEqual(list.find((r) => r.user_id === OWNERF), { user_id: OWNERF, seed_role: "farmer", seed_source: "farmers" });
assert.equal(list.find((r) => r.user_id === GHOST).seed_role, null);
assert.equal(list.find((r) => r.user_id === DELF).seed_role, null, "mitaya hua kisan seed nahi");
ok("fn_auth_users_without_profile fehrist + juRa record");

assert.equal(await one(`select fn_ensure_profile('${OWNERF}')`), "farmer");
const p = (await q(`select full_name, phone_number, organization_id::text org, branch_id::text br, is_active from profiles where id='${OWNERF}'`))[0];
assert.deepEqual(p, { full_name: "Aurangzaib Rana", phone_number: "03226275476", org: ORG2, br: BR, is_active: true });
assert.equal(await one(`select fn_ensure_profile('${CUST}')`), "customer");
assert.equal(await one(`select organization_id::text from profiles where id='${CUST}'`), ORG2);
assert.equal(await one(`select fn_ensure_profile('${VEND}')`), "machinery_vendor");
assert.equal(await one(`select organization_id::text from profiles where id='${VEND}'`), "00000000-0000-0000-0000-0000000000a1", "default org");
assert.equal(await one(`select fn_ensure_profile('${DEAL}')`), "customer", "dealer app ke usool par customer");
ok("fn_ensure_profile juRe record se sahi darja/org/branch/phone");

assert.equal(await one(`select fn_ensure_profile('${GHOST}')`), null);
assert.equal(await one(`select count(*)::int from profiles where id='${GHOST}'`), 0);
assert.equal(await one(`select fn_ensure_profile('${DELF}')`), null);
assert.equal(await one(`select fn_ensure_profile(null)`), null);
assert.equal(await one(`select fn_ensure_profile('00000000-0000-0000-0000-0000000000ff')`), null, "auth user hi nahi");
ok("koi juRa record nahi -> kuch nahi banta, staff kabhi nahi");

// mojooda profile ko kabhi nahi chhuta (band farmer band hi rahe)
await run(`update profiles set is_active=false, status='suspended' where id='${OWNERF}'`);
assert.equal(await one(`select fn_ensure_profile('${OWNERF}')`), "farmer");
assert.equal(await one(`select is_active from profiles where id='${OWNERF}'`), false);
await run(`update profiles set role='finance' where id='${ADMIN}'`);
assert.equal(await one(`select fn_ensure_profile('${ADMIN}')`), "finance");
ok("mojooda profile nahi badalti (suspend/role wahi)");

// fn_ensure_my_profile: sirf apni
await run(`delete from profiles where id='${CUST}'`);
await run(`select set_config('test.uid', '${CUST}', false)`);
assert.equal(await one(`select fn_ensure_my_profile()`), "customer");
await run(`select set_config('test.uid', '', false)`);
assert.equal(await one(`select fn_ensure_my_profile()`), null);
ok("fn_ensure_my_profile sirf auth.uid() ki");

// ijazat: anon kuch nahi; authenticated sirf apni wali
const can = (role, fn) => one(`select has_function_privilege('${role}', '${fn}', 'execute')`);
assert.equal(await can("anon", "public.fn_ensure_my_profile()"), false);
assert.equal(await can("authenticated", "public.fn_ensure_my_profile()"), true);
assert.equal(await can("authenticated", "public.fn_ensure_profile(uuid)"), false);
assert.equal(await can("anon", "public.fn_ensure_profile(uuid)"), false);
assert.equal(await can("authenticated", "public.fn_auth_users_without_profile()"), false);
assert.equal(await can("service_role", "public.fn_ensure_profile(uuid)"), true);
ok("ijazat: anon band, authenticated sirf apni, baqi service_role");

// ---- backfill: live ke 3 orphan (prefix) + ek juRa hua
await run(`delete from profiles where id='${DEAL}'`);
const O1 = "259b48ec-0000-0000-0000-000000000001", O2 = "ec0d62d3-0000-0000-0000-000000000002", O3 = "4ac65571-0000-0000-0000-000000000003";
await run(`alter table auth.users disable trigger trg_on_auth_user_created;
  insert into auth.users (id, email, raw_user_meta_data) values ('${O1}','zah@gmail.com','{"full_name":"Z"}'),('${O2}','ran@gmail.com','{"full_name":"R"}'),('${O3}','zai@gmail.com','{"full_name":"Zai","role":"sales_staff"}');
  alter table auth.users enable trigger trg_on_auth_user_created;`);
const before = await one(`select count(*)::int from fn_auth_users_without_profile()`);
assert.equal(before, 6); // GHOST, DELF, DEAL, O1, O2, O3
await run(backfill);
const left = (await q(`select user_id::text from fn_auth_users_without_profile() order by 1`)).map((r) => r.user_id);
assert.deepEqual(left, [GHOST, DELF].sort(), "sirf naam se chune 3 + juRe wale theek; baqi ko nahi chhuta");
assert.equal(await one(`select role::text from profiles where id='${DEAL}'`), "customer");
for (const id of [O1, O2, O3]) {
  const r = (await q(`select role::text, is_active, status from profiles where id='${id}'`))[0];
  assert.deepEqual(r, { role: "customer", is_active: false, status: "suspended" }, id);
}
assert.equal(await one(`select full_name from profiles where id='${O3}'`), "Zai");
await run(backfill); // dobara -- kuch nahi badalta
assert.equal(await one(`select count(*)::int from profiles where id in ('${O1}','${O2}','${O3}')`), 3);
ok("backfill: 3 orphan band customer, juRe wale sahi darja, dobara chalna mehfooz");

// auth user hatao -> profile cascade se jati hai (naya delete tarteeb ka asal)
await run(`delete from auth.users where id='${O1}'`);
assert.equal(await one(`select count(*)::int from profiles where id='${O1}'`), 0);
await assert.rejects(() => db.exec(`delete from auth.users where id='${OWNERF}'`), /foreign key/i, "farmers.user_id auth delete rokta hai");
assert.equal(await one(`select count(*)::int from profiles where id='${OWNERF}'`), 1, "fail hone par profile baqi");
ok("auth delete pehle: kamyab ho to profile saath, fail ho to kuch nahi mitta");

console.log(`\n${n} SQL tests pass`);
