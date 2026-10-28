// 686 shop_allowed_categories — PGlite. Live / Testing par apply nahi hota.
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const run = (s) => db.exec(s);
const q = async (s) => (await db.query(s)).rows;
const reset = "reset role; select set_config('test.uid','',false);";
const as = (u) => `set role authenticated; select set_config('test.uid','${u}',false);`;
let ok = 0;
const pass = (n) => { ok++; console.log(`  ok  ${n}`); };
const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;

const ORG = id(1), HQ = id(10), SIDE = id(11);
const KAR = id(21), AGRI = id(22), VET = id(23), MILK = id(24), PROC = id(25), OTHER = id(26);
const SHELF_KAR = id(31);
const C = { grocery: id(41), rice: id(42), bev: id(43), fert: id(44), urea: id(45), feed: id(46), cattle: id(47), vet: id(48), dairy: id(49), milk: id(50), grain: id(51), eggs: id(52) };
const P = { cola: id(61), rice: id(62), urea: id(63), cattle: id(64), vetmed: id(65), grain: id(66), nocat: id(67), eggs: id(68) };
const ADMIN = id(71), STAFF_KAR = id(72), STAFF_VET = id(73);

await run(fs.readFileSync("tests/sql/shop-godam-stubs.sql", "utf8"));
await run(`
  alter table public.shops add column business_type text;
  create table public.categories (id uuid primary key, name text, parent_category_id uuid references public.categories(id), category_kind text);
  create table public.products (id uuid primary key, name text, category_id uuid references public.categories(id));
  grant select on public.categories, public.products to authenticated;
`);
await run(fs.readFileSync("supabase/migrations/675_shop_godams.sql", "utf8"));
await run(`
  insert into organizations values ('${ORG}');
  insert into shops (id, name, organization_id, is_active, business_type) values
    ('${KAR}','Karyana','${ORG}',true,'karyana'),('${AGRI}','Kisan Dukan','${ORG}',true,'agri_inputs'),
    ('${VET}','Vets','${ORG}',true,'vet'),('${MILK}','Milk','${ORG}',true,'dairy'),
    ('${PROC}','Procurement','${ORG}',true,'grain_procurement'),('${OTHER}','Other','${ORG}',true,'misc');
  insert into warehouses (id, name, code, organization_id, shop_id) values
    ('${HQ}','Company HQ','HQ','${ORG}',null),('${SIDE}','Side Store','SIDE','${ORG}',null),
    ('${SHELF_KAR}','Karyana shelf','KS','${ORG}','${KAR}');
  insert into categories values
    ('${C.grocery}','Grocery',null,'agri'),('${C.rice}','Rice & Grains','${C.grocery}','agri'),('${C.bev}','Beverages','${C.grocery}','agri'),
    ('${C.eggs}','Eggs',null,'karyana'),
    ('${C.fert}','Fertilizer',null,'agri'),('${C.urea}','Nitrogen (Urea)','${C.fert}','agri'),
    ('${C.feed}','Animal Feed (Wanda)',null,'agri'),('${C.cattle}','Cattle/Dairy Feed','${C.feed}','agri'),
    ('${C.vet}','Veterinary Medicines',null,'agri'),('${C.dairy}','Dairy Products',null,'agri'),('${C.milk}','Milk & Dairy',null,'karyana'),
    ('${C.grain}','Raw Grain (Procurement)',null,'agri');
  insert into products values
    ('${P.cola}','Cola','${C.bev}'),('${P.rice}','Rice','${C.rice}'),('${P.urea}','Urea','${C.urea}'),('${P.cattle}','Wanda','${C.cattle}'),
    ('${P.vetmed}','Vet med','${C.vet}'),('${P.grain}','Wheat','${C.grain}'),('${P.nocat}','No cat',null),('${P.eggs}','Eggs','${C.eggs}');
  insert into inventory (product_id, warehouse_id, quantity_on_hand)
    select p.id, '${HQ}', 10 from products p;
  insert into inventory (product_id, warehouse_id, quantity_on_hand) values ('${P.urea}','${SIDE}',5),('${P.urea}','${SHELF_KAR}',3);
  insert into profiles (id, role, organization_id, shop_id, full_name) values
    ('${ADMIN}','admin','${ORG}',null,'Admin'),('${STAFF_KAR}','sales_staff','${ORG}','${KAR}','K'),('${STAFF_VET}','sales_staff','${ORG}','${VET}','V');
`);
await run(fs.readFileSync("supabase/migrations/676_shop_hq_godam_default.sql", "utf8"));
await run(`insert into shop_godams (shop_id, warehouse_id) values ('${AGRI}','${SIDE}')`);

const M = fs.readFileSync("supabase/migrations/686_shop_allowed_categories.sql", "utf8");
assert.doesNotMatch(M, /\bdelete\s+from\b|\btruncate\b|\bdrop\s+table\b/i);
await run(M);
await run(M);
pass("686 applies twice, no business delete");

const cats = async (shop) => (await q(`select c.name from shop_allowed_categories a join categories c on c.id=a.category_id where a.shop_id='${shop}' and a.include order by 1`)).map((r) => r.name);
assert.deepEqual(await cats(KAR), ["Eggs", "Grocery", "Milk & Dairy"]);
assert.deepEqual(await cats(AGRI), ["Animal Feed (Wanda)", "Fertilizer"]);
assert.deepEqual(await cats(VET), ["Veterinary Medicines"]);
assert.deepEqual(await cats(MILK), ["Dairy Products", "Milk & Dairy"]);
assert.deepEqual(await cats(PROC), ["Raw Grain (Procurement)"]);
assert.deepEqual(await cats(OTHER), []);
pass("default seed: karyana-kind + Grocery, feed only Kisan Dukan (sub via parent), vets only vet meds");

const all = Object.values(P).map((p) => `'${p}'`).join(",");
const stock = async (user, shop) => {
  await run(as(user));
  const rows = await q(`select product_id::text p, warehouse_id::text w, qty::int n from fn_shop_linked_godam_stock('${shop}', array[${all}]::uuid[]) order by 1,2`);
  await run(reset);
  return rows;
};
const prods = (rows, w = HQ) => rows.filter((r) => r.w === w).map((r) => r.p).sort();
assert.deepEqual(prods(await stock(STAFF_KAR, KAR)), [P.cola, P.rice, P.eggs].sort());
pass("karyana sees Grocery subs (cola, rice) + Eggs from HQ only; no urea/feed/no-category");
assert.deepEqual(prods(await stock(STAFF_VET, VET)), [P.vetmed]);
const agri = await stock(ADMIN, AGRI);
assert.deepEqual(prods(agri), [P.urea, P.cattle].sort());
assert.deepEqual(prods(agri, SIDE), [P.urea]);
pass("vets only vet meds; kisan dukan fert+feed; non-HQ godam not filtered");
assert.equal(prods(await stock(ADMIN, OTHER)).length, Object.keys(P).length);
pass("empty list = everything from HQ");

// Override: Rice & Grains Karyana se hata kar Procurement ko.
await run(as(ADMIN));
await run(`insert into shop_allowed_categories (shop_id, category_id, include, created_by) values ('${KAR}','${C.rice}',false,'${ADMIN}'),('${PROC}','${C.rice}',true,'${ADMIN}')`);
await run(reset);
assert.deepEqual(prods(await stock(STAFF_KAR, KAR)), [P.cola, P.eggs].sort());
assert.deepEqual(prods(await stock(ADMIN, PROC)), [P.grain, P.rice].sort());
pass("subcategory override both ways (exclude under parent / include without parent)");

// RLS + audit
let err = null;
try { await run(`${as(STAFF_KAR)} insert into shop_allowed_categories (shop_id, category_id) values ('${KAR}','${C.fert}')`); } catch (e) { err = e; }
await run(reset);
assert.ok(err, "staff cannot write");
await run(as(STAFF_KAR));
assert.ok((await q(`select 1 from shop_allowed_categories`)).length > 0, "staff can read");
assert.equal((await q(`select 1 from shop_allowed_categories_log`)).length, 0, "staff cannot read audit");
await run(reset);
const log = await q(`select action, changed_by::text u from shop_allowed_categories_log where changed_by='${ADMIN}'`);
assert.equal(log.length, 2);
pass("RLS: staff read-only, admin writes, audit rows with who");

// Shelf untouched: function never returns shelf rows.
assert.ok(!(await stock(STAFF_KAR, KAR)).some((r) => r.w === SHELF_KAR));
pass("shop shelf not in godam function (POS shelf stays full)");
console.log(`shop-allowed-categories-sql: ${ok} ok`);
