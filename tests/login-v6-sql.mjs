// Real SQL test: 621 + 686 (login v6) on PGlite (in-process Postgres) -- live DB nahi.
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const mig = fs.readFileSync("supabase/migrations/686_login_v6_identity.sql", "utf8");
const rb = fs.readFileSync("supabase/migrations/686_login_v6_identity.rollback.sql", "utf8");
assert.doesNotMatch(mig, /\bdrop table\b|\btruncate\b|\bdrop column\b|\bdelete from\b/i, "additive only");
assert.doesNotMatch(mig, /function public\.fn_phone_key/i, "fn_phone_key not redefined");

async function fresh() {
  const db = new PGlite({ extensions: {} });
  await db.exec(fs.readFileSync("tests/sql/login-v5-stubs.sql", "utf8"));
  await db.exec(`alter table farmers add column cnic text; create table reserved_usernames (name text primary key); insert into reserved_usernames values ('admin');`);
  await db.exec(fs.readFileSync("supabase/migrations/621_login_v5.sql", "utf8"));
  return db;
}
const U = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;

// 1. clean data: all indexes created, idempotent, resolve/taken/userid work
{
  const db = await fresh();
  const q = async (s) => (await db.query(s)).rows;
  const one = async (s) => Object.values((await q(s))[0] ?? { v: null })[0];
  await db.exec(`
    insert into auth.users (id, email, encrypted_password) values ('${U(1)}','3214445556@phone.agribridge.local','$2a$x'), ('${U(2)}','staff@x.pk','$2a$x');
    insert into profiles (id, full_name, role, phone_number) values ('${U(1)}','Kisan','farmer',null), ('${U(2)}','Staff','sales_staff','0300-1112223');
    insert into farmers (user_id, full_name, phone_number, phone_key, username, registration_source, email, cnic) values
      ('${U(1)}','Kisan','03214445556','3214445556','kisan1','SELF','kisan@gmail.com','35202-1234567-1');`);
  await db.exec(mig); await db.exec(mig);
  const idx = (await q(`select indexname from pg_indexes where indexname in ('profiles_cnic_uniq','profiles_username_uniq','profiles_phone_key_uniq','farmers_email_lower_uniq','farmers_cnic_key_uniq') order by 1`)).map((r) => r.indexname);
  assert.equal(idx.length, 5, "all 5 unique indexes");
  assert.equal(await one(`select count(*)::int from login_identity_duplicates`), 0);
  // resolve by cnic (farmers dashed) and digits
  assert.equal((await q(`select * from fn_login_resolve('cnic','3520212345671')`))[0].user_id, U(1));
  assert.equal((await q(`select * from fn_login_resolve('cnic','35202-1234567-1')`))[0].user_id, U(1));
  assert.equal((await q(`select * from fn_login_resolve('cnic','123')`)).length, 0);
  // phone + username still as 621
  assert.equal((await q(`select * from fn_login_resolve('phone','3001112223')`))[0].user_id, U(2));
  assert.equal((await q(`select * from fn_login_resolve('username','kisan1')`))[0].user_id, U(1));
  // identity taken
  assert.deepEqual(await one(`select fn_login_identity_taken('3214445556','KISAN@gmail.com','3520212345671')`), ["phone", "email", "cnic"]);
  assert.deepEqual(await one(`select fn_login_identity_taken('3009998887','new@x.pk','3520299999991')`), []);
  // user id
  assert.equal(await one(`select fn_login_userid_available('kisan1')`), "taken");
  assert.equal(await one(`select fn_login_userid_available('admin')`), "reserved");
  assert.equal(await one(`select fn_login_userid_available('9bad')`), "shape");
  assert.equal(await one(`select fn_login_set_userid('${U(2)}','staff.one')`), "ok");
  assert.equal(await one(`select fn_login_set_userid('${U(2)}','staff.two')`), "already");
  assert.equal((await q(`select * from fn_login_resolve('username','staff.one')`))[0].user_id, U(2));
  assert.equal(await one(`select fn_login_userid_available('STAFF.ONE')`), "taken");
  // DB rejects duplicates
  await db.exec(`insert into auth.users (id,email) values ('${U(3)}','x@x.pk'); insert into profiles (id, full_name, role, phone_number, cnic) values ('${U(3)}','X','farmer','03001112223',null)`).then(
    () => assert.fail("duplicate mobile must fail"), (e) => assert.match(String(e.message), /profiles_phone_key_uniq/));
  await db.exec(`insert into profiles (id, full_name, role, cnic) values ('${U(4)}','Y','farmer','3520211111111'); `);
  await db.exec(`insert into profiles (id, full_name, role, cnic) values ('${U(5)}','Z','farmer','3520211111111')`).then(
    () => assert.fail("duplicate cnic must fail"), (e) => assert.match(String(e.message), /profiles_cnic_uniq/));
  await db.exec(`insert into profiles (id, full_name, role, cnic) values ('${U(6)}','Z','farmer','35202-1')`).then(
    () => assert.fail("bad cnic shape must fail"), (e) => assert.match(String(e.message), /chk_profiles_cnic_13/));
  await db.exec(`insert into farmers (full_name, phone_key, email) values ('D', '3110000000', 'Kisan@Gmail.com')`).then(
    () => assert.fail("case-insensitive duplicate email must fail"), (e) => assert.match(String(e.message), /farmers_email_lower_uniq/));
  // rollback runs
  await db.exec(rb);
  assert.equal(await one(`select count(*)::int from pg_proc where proname = 'fn_login_identity_taken'`), 0);
  assert.equal((await q(`select * from fn_login_resolve('phone','3001112223')`))[0].user_id, U(2), "621 resolve back");
}

// 2. existing duplicates: migration does NOT fail, reports them, skips only that index
{
  const db = await fresh();
  const q = async (s) => (await db.query(s)).rows;
  await db.exec(`
    insert into profiles (id, full_name, role, phone_number) values ('${U(1)}','A','farmer','03001234567'), ('${U(2)}','B','sales_staff','+92 300 1234567');
    insert into farmers (full_name, phone_key, email, cnic) values ('F1','3111111111','dup@x.pk','35202-1234567-1'), ('F2','3122222222','DUP@x.pk','3520212345671');`);
  await db.exec(mig);
  const rep = (await q(`select field, row_count from login_identity_duplicates order by field`)).map((r) => `${r.field}:${r.row_count}`);
  assert.deepEqual(rep, ["farmer_cnic:2", "farmer_email:2", "profile_mobile:2"]);
  const idx = (await q(`select indexname from pg_indexes where indexname like '%uniq' and indexname in ('profiles_cnic_uniq','profiles_username_uniq','profiles_phone_key_uniq','farmers_email_lower_uniq','farmers_cnic_key_uniq') order by 1`)).map((r) => r.indexname);
  assert.deepEqual(idx, ["profiles_cnic_uniq", "profiles_username_uniq"]);
}
console.log("login-v6-sql: all assertions passed");
