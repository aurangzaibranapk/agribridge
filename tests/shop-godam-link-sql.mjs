// 675 shop_godams — PGlite. Live / Testing par apply nahi hota.
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const run = (s) => db.exec(s);
const q = async (s) => (await db.query(s)).rows;
const one = async (s) => Object.values((await db.query(s)).rows[0] ?? {})[0];
const reset = "reset role; select set_config('test.uid','',false);";
const as = (u) => `set role authenticated; select set_config('test.uid','${u}',false);`;
const throws = async (s, msg) => {
  let err = null;
  try { await run(s); } catch (e) { err = e; }
  await run(reset);
  assert.ok(err, `expected error: ${msg}`);
  return String(err?.message ?? err);
};
let ok = 0;
const pass = (n) => { ok++; console.log(`  ok  ${n}`); };

const ORG_A = "00000000-0000-0000-0000-0000000000a1";
const ORG_B = "00000000-0000-0000-0000-0000000000b1";
const SHOP_A = "00000000-0000-0000-0000-00000000a501";
const SHOP_B = "00000000-0000-0000-0000-00000000b501";
const SHOP_C = "00000000-0000-0000-0000-00000000c501";
const GODAM1 = "00000000-0000-0000-0000-0000000000d1";
const GODAM2 = "00000000-0000-0000-0000-0000000000d2";
const SHELF = "00000000-0000-0000-0000-0000000000d3";
const QUAR = "00000000-0000-0000-0000-0000000000d4";
const GODAM_B = "00000000-0000-0000-0000-0000000000d5";
const ADMIN = "00000000-0000-0000-0000-0000000000e1";
const OWNER = "00000000-0000-0000-0000-0000000000e2";
const STAFF_A = "00000000-0000-0000-0000-0000000000e3";
const STAFF_B = "00000000-0000-0000-0000-0000000000e4";
const ADMIN_B = "00000000-0000-0000-0000-0000000000e5";
const CASHIER = "00000000-0000-0000-0000-0000000000e6";
const P = "00000000-0000-0000-0000-0000000000f1";
const COUNTER = "00000000-0000-0000-0000-0000000000c1";
const SHOP_OFF = "00000000-0000-0000-0000-00000000a502";
const SHOP_NEW = "00000000-0000-0000-0000-00000000a503";
const ORG_E = "00000000-0000-0000-0000-0000000000e9";
const SHOP_E = "00000000-0000-0000-0000-00000000e501";
const WH_HQ = "00000000-0000-0000-0000-0000000000d6";
const WH_MAIN = "00000000-0000-0000-0000-0000000000d7";
const ORG_U = "00000000-0000-0000-0000-0000000000c9";
const SHOP_U = "00000000-0000-0000-0000-00000000c502";
const WH_COLD = "00000000-0000-0000-0000-0000000000d8";
const WH_SIDE = "00000000-0000-0000-0000-0000000000d9";

await run(fs.readFileSync("tests/sql/shop-godam-stubs.sql", "utf8"));
const M = fs.readFileSync("supabase/migrations/675_shop_godams.sql", "utf8");
const R = fs.readFileSync("supabase/migrations/675_shop_godams.rollback.sql", "utf8");
const H = fs.readFileSync("supabase/migrations/676_shop_hq_godam_default.sql", "utf8");
const HR = fs.readFileSync("supabase/migrations/676_shop_hq_godam_default.rollback.sql", "utf8");
assert.doesNotMatch(M, /\bdelete\s+from\b|\btruncate\b|\bdrop\s+table\b/i);
assert.doesNotMatch(H, /\bdelete\s+from\b|\btruncate\b|\bdrop\s+table\b/i);
assert.match(H, /on conflict \(shop_id, warehouse_id\) do nothing/i);
assert.match(H, /raise notice/i);
await run(M);
await run(M);
pass("675 applies twice, no delete of business rows");

await run(`
  insert into organizations values ('${ORG_A}'), ('${ORG_B}'), ('${ORG_E}'), ('${ORG_U}');
  insert into shops (id, name, organization_id, is_active) values
    ('${SHOP_A}','Mahabali','${ORG_A}',true),
    ('${SHOP_B}','Doosri','${ORG_A}',true),
    ('${SHOP_C}','Door','${ORG_B}',true),
    ('${SHOP_OFF}','Band','${ORG_A}',false),
    ('${SHOP_E}','HQ Shop','${ORG_E}',true);
  insert into warehouses (id, name, code, organization_id, shop_id, is_quarantine) values
    ('${GODAM1}','Markaz','MARKAZ','${ORG_A}',null,false),
    ('${GODAM2}','Doosra','DOOSRA','${ORG_A}',null,false),
    ('${SHELF}','Shelf','SHELF','${ORG_A}','${SHOP_A}',false),
    ('${QUAR}','Main Quarantine','MAINQ','${ORG_A}',null,true),
    ('${GODAM_B}','Door Godam','DOOR','${ORG_B}',null,false),
    ('${WH_HQ}','HQ Godam','HQ','${ORG_E}',null,false),
    ('${WH_MAIN}','Main Warehouse','MAIN','${ORG_E}',null,false),
    ('${WH_COLD}','Cold Room','COLD','${ORG_U}',null,false),
    ('${WH_SIDE}','Side Store','SIDE','${ORG_U}',null,false);
  insert into inventory (product_id, warehouse_id, quantity_on_hand) values
    ('${P}','${GODAM1}',10),
    ('${P}','${GODAM1}',5),
    ('${P}','${GODAM1}',-3),
    ('${P}','${GODAM2}',100),
    ('${P}','${SHELF}',999),
    ('${P}','${QUAR}',7);
  insert into profiles (id, role, organization_id, shop_id, full_name) values
    ('${ADMIN}','admin','${ORG_A}',null,'Admin'),
    ('${OWNER}','owner','${ORG_A}',null,'Owner'),
    ('${STAFF_A}','sales_staff','${ORG_A}','${SHOP_A}','A'),
    ('${STAFF_B}','sales_staff','${ORG_A}','${SHOP_B}','B'),
    ('${ADMIN_B}','admin','${ORG_B}',null,'Admin B'),
    ('${CASHIER}','sales_staff','${ORG_A}',null,'Cashier');
  insert into pos_counters (id, shop_id, is_active) values ('${COUNTER}','${SHOP_A}',true);
  insert into pos_counter_staff (profile_id, counter_id, is_active) values ('${CASHIER}','${COUNTER}',true);
`);

await run(H);
await run(H);
const linkOf = async (shop) => (await q(`select warehouse_id::text as warehouse_id from shop_godams where shop_id = '${shop}' order by warehouse_id`)).map((r) => r.warehouse_id);
assert.deepEqual(await linkOf(SHOP_A), [GODAM1]);
assert.deepEqual(await linkOf(SHOP_B), [GODAM1]);
assert.deepEqual(await linkOf(SHOP_OFF), []);
assert.deepEqual(await linkOf(SHOP_C), [GODAM_B]);
assert.deepEqual(await linkOf(SHOP_E), [WH_HQ]);
pass("676: active shops get one HQ; inactive skipped; HQ beats Main; single central used; rerun does not duplicate");

await run(`insert into shops (id, name, organization_id, is_active) values ('${SHOP_NEW}','Nayi','${ORG_A}',true), ('${SHOP_U}','Unnamed','${ORG_U}',true)`);
assert.deepEqual(await linkOf(SHOP_NEW), [GODAM1]);
assert.deepEqual(await linkOf(SHOP_U), []);
pass("new shop links to HQ; two unnamed centrals do not guess");

await run(as(ADMIN));
await run(`insert into shop_godams (shop_id, warehouse_id, created_by) values ('${SHOP_A}','${GODAM2}','${ADMIN}')`);
await run(reset);
assert.equal((await linkOf(SHOP_A)).length, 2);
await run(as(ADMIN));
await run(`delete from shop_godams where shop_id = '${SHOP_A}' and warehouse_id = '${GODAM2}'`);
await run(reset);
assert.deepEqual(await linkOf(SHOP_A), [GODAM1]);
pass("admin can add and remove a godam; default HQ stays unless removed");

const shelfErr = await throws(
  `${as(ADMIN)} insert into shop_godams (shop_id, warehouse_id) values ('${SHOP_A}','${SHELF}')`,
  "shelf"
);
assert.match(shelfErr, /shelf/);
const quarErr = await throws(
  `${as(ADMIN)} insert into shop_godams (shop_id, warehouse_id) values ('${SHOP_A}','${QUAR}')`,
  "quarantine"
);
assert.match(quarErr, /Quarantine/);
const orgErr = await throws(
  `${as(ADMIN)} insert into shop_godams (shop_id, warehouse_id) values ('${SHOP_A}','${GODAM_B}')`,
  "other org warehouse"
);
assert.match(orgErr, /karobar/);
await throws(
  `${as(ADMIN_B)} insert into shop_godams (shop_id, warehouse_id) values ('${SHOP_A}','${GODAM1}')`,
  "other org admin"
);
pass("shelf, quarantine, and other-org links rejected");

await run(as(STAFF_A));
const seen = await q(`select * from fn_shop_linked_godam_stock('${SHOP_A}', array['${P}']::uuid[])`);
await run(reset);
assert.equal(seen.length, 1);
assert.equal(seen[0].warehouse_id, GODAM1);
assert.equal(Number(seen[0].qty), 15);
assert.equal(seen[0].warehouse_name, "Markaz");
pass("shop A sees only its linked godam (15), not godam2 100 or shelf 999");

await run(as(STAFF_B));
const shopB = await q(`select * from fn_shop_linked_godam_stock('${SHOP_B}', array['${P}']::uuid[])`);
await run(reset);
assert.equal(shopB.length, 1);
assert.equal(shopB[0].warehouse_id, GODAM1);
assert.equal(Number(shopB[0].qty), 15);
await run(as(ADMIN));
const off = await q(`select * from fn_shop_linked_godam_stock('${SHOP_OFF}', array['${P}']::uuid[])`);
await run(reset);
assert.equal(off.length, 0);
pass("default HQ is Markaz (15, not Doosra 100); inactive shop with no link stays empty");

const otherShop = await throws(
  `${as(STAFF_B)} select * from fn_shop_linked_godam_stock('${SHOP_A}', array['${P}']::uuid[])`,
  "other shop"
);
assert.match(otherShop, /nahi dekh sakte/);
const otherOrg = await throws(
  `${as(ADMIN_B)} select * from fn_shop_linked_godam_stock('${SHOP_A}', array['${P}']::uuid[])`,
  "other org shop"
);
assert.match(otherOrg, /nahi mili/);
pass("other shop and other org cannot read this shop's godam");

await run(as(OWNER));
assert.equal((await q(`select * from fn_shop_linked_godam_stock('${SHOP_A}', array['${P}']::uuid[])`)).length, 1);
await run(reset);
await run(as(ADMIN));
assert.equal((await q(`select * from fn_shop_linked_godam_stock('${SHOP_A}', array['${P}']::uuid[])`)).length, 1);
await run(reset);
await run(as(CASHIER));
assert.equal((await q(`select * from fn_shop_linked_godam_stock('${SHOP_A}', array['${P}']::uuid[])`)).length, 1);
await run(reset);
pass("owner, admin, and assigned counter can read");

await run(as(STAFF_A));
assert.deepEqual((await q(`select shop_id::text as shop_id from shop_godams`)).map((r) => r.shop_id), [SHOP_A]);
await run(reset);
await run(as(STAFF_B));
assert.deepEqual((await q(`select shop_id::text as shop_id from shop_godams`)).map((r) => r.shop_id), [SHOP_B]);
await run(reset);
await throws(
  `${as(STAFF_A)} insert into shop_godams (shop_id, warehouse_id) values ('${SHOP_A}','${GODAM2}')`,
  "staff cannot write"
);
pass("RLS: own shop can see the link, other shop cannot, staff cannot write");

await run(as(ADMIN));
assert.equal((await q(`select * from fn_shop_linked_godam_stock('${SHOP_A}', array[]::uuid[])`)).length, 0);
await run(reset);
const tooMany = await throws(
  `${as(ADMIN)} select * from fn_shop_linked_godam_stock('${SHOP_A}', (select array_agg(gen_random_uuid()) from generate_series(1,501)))`,
  "500"
);
assert.match(tooMany, /500/);
pass("empty product list is empty; over 500 is refused");

assert.equal(await one(`select (c.relrowsecurity and c.relforcerowsecurity) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'shop_godams'`), true);
assert.equal(await one(`select has_function_privilege('anon', 'public.fn_shop_linked_godam_stock(uuid, uuid[])', 'execute')`), false);
assert.equal(await one(`select count(*)::int from features where key = 'shops.godam'`), 1);
assert.equal(await one(`select count(*)::int from dashboard_features where feature_key = 'shops.godam' and dashboard_key = 'shops'`), 1);
assert.equal(await one(`select count(*)::int from feature_help where feature_key = 'shops.godam'`), 2);
pass("RLS forced, anon cannot execute, feature rows exist");

await run(`alter table shop_godams disable trigger trg_shop_godams_guard;
  insert into shop_godams (shop_id, warehouse_id, organization_id) values ('${SHOP_A}','${SHELF}','${ORG_A}');
  alter table shop_godams enable trigger trg_shop_godams_guard;`);
await run(as(STAFF_A));
const still = await q(`select warehouse_id::text as warehouse_id, qty from fn_shop_linked_godam_stock('${SHOP_A}', array['${P}']::uuid[])`);
await run(reset);
assert.deepEqual(still.map((r) => r.warehouse_id), [GODAM1]);
assert.equal(Number(still[0].qty), 15);
pass("even a forced shelf link is not returned as godam stock");

await run(as(ADMIN));
await run(`delete from shop_godams where shop_id = '${SHOP_B}'`);
await run(reset);
await run(as(STAFF_B));
assert.equal((await q(`select * from fn_shop_linked_godam_stock('${SHOP_B}', array['${P}']::uuid[])`)).length, 0);
await run(reset);
pass("admin hata de to HQ wapas nahi judta");

await run(HR);
assert.equal(await one(`select count(*)::int from pg_trigger where tgname = 'trg_shop_link_hq_godam'`), 0);
await run(`insert into shops (id, name, organization_id, is_active) values ('00000000-0000-0000-0000-00000000a599','Bina trigger','${ORG_A}',true)`);
assert.equal(await one(`select count(*)::int from shop_godams where shop_id = '00000000-0000-0000-0000-00000000a599'`), 0);
pass("676 rollback removes the auto-link trigger, leaves the table");

await run(R);
assert.equal(await one(`select count(*)::int from information_schema.tables where table_schema = 'public' and table_name = 'shop_godams'`), 0);
assert.equal(await one(`select count(*)::int from pg_proc where proname = 'fn_shop_linked_godam_stock'`), 0);
assert.equal(await one(`select count(*)::int from pg_proc where proname = 'fn_hq_godam_id'`), 0);
assert.equal(await one(`select count(*)::int from features where key = 'shops.godam'`), 0);
await run(M);
await run(H);
assert.equal(await one(`select count(*)::int from shop_godams where shop_id = '${SHOP_A}'`), 1);
assert.equal(await one(`select count(*)::int from shop_godams where shop_id = '${SHOP_OFF}'`), 0);
pass("rollback drops the link, re-apply seeds HQ again");

console.log(`PASS: 675+676 shop godam (${ok})`);
