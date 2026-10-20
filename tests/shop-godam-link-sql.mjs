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

await run(fs.readFileSync("tests/sql/shop-godam-stubs.sql", "utf8"));
const M = fs.readFileSync("supabase/migrations/675_shop_godams.sql", "utf8");
const R = fs.readFileSync("supabase/migrations/675_shop_godams.rollback.sql", "utf8");
assert.doesNotMatch(M, /\bdelete\s+from\b|\btruncate\b|\bdrop\s+table\b/i);
await run(M);
await run(M);
pass("675 applies twice, no delete of business rows");

await run(`
  insert into organizations values ('${ORG_A}'), ('${ORG_B}');
  insert into shops values
    ('${SHOP_A}','Mahabali','${ORG_A}'),
    ('${SHOP_B}','Doosri','${ORG_A}'),
    ('${SHOP_C}','Door','${ORG_B}');
  insert into warehouses (id, name, organization_id, shop_id, is_quarantine) values
    ('${GODAM1}','Markaz','${ORG_A}',null,false),
    ('${GODAM2}','Doosra','${ORG_A}',null,false),
    ('${SHELF}','Shelf','${ORG_A}','${SHOP_A}',false),
    ('${QUAR}','Quarantine','${ORG_A}',null,true),
    ('${GODAM_B}','Door Godam','${ORG_B}',null,false);
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

await run(as(ADMIN));
await run(`insert into shop_godams (shop_id, warehouse_id, created_by) values ('${SHOP_A}','${GODAM1}','${ADMIN}')`);
await run(reset);
pass("admin of the same org can link a godam");

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
const none = await q(`select * from fn_shop_linked_godam_stock('${SHOP_B}', array['${P}']::uuid[])`);
await run(reset);
assert.equal(none.length, 0);
pass("shop with no link returns no godam rows");

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
assert.equal((await q(`select warehouse_id from shop_godams`)).length, 1);
await run(reset);
await run(as(STAFF_B));
assert.equal((await q(`select warehouse_id from shop_godams`)).length, 0);
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

await run(R);
assert.equal(await one(`select count(*)::int from information_schema.tables where table_schema = 'public' and table_name = 'shop_godams'`), 0);
assert.equal(await one(`select count(*)::int from pg_proc where proname = 'fn_shop_linked_godam_stock'`), 0);
assert.equal(await one(`select count(*)::int from features where key = 'shops.godam'`), 0);
await run(M);
pass("rollback drops the link, re-apply works");

console.log(`PASS: 675 shop_godams (${ok})`);
