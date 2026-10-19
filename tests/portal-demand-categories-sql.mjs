// Real SQL test: 604 (demand category karyana/other) PGlite par -- live DB nahi.
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
await db.exec(`
create table public.farmer_product_demands (id serial primary key, product_name text not null,
  category text constraint farmer_product_demands_category_check check (category is null or category in ('wanda','khal','chowker','moomni','seed','pesticide','fertilizer','micronutrient')));
insert into farmer_product_demands (product_name, category) values ('DAP','fertilizer'), ('Wanda','wanda'), ('X', null);
`);
let ok = 0; const pass = (n) => { ok++; console.log(`  ok  ${n}`); };
const bad = async (sql) => { try { await db.exec(sql); return false; } catch { return true; } };

assert.ok(await bad(`insert into farmer_product_demands (product_name, category) values ('Ghee','karyana')`), "pehle karyana mana");
const M = fs.readFileSync("supabase/migrations/604_demand_category_karyana_other.sql", "utf8");
assert.ok(!/drop\s+table|delete\s+from|truncate|drop\s+column/i.test(M), "koi data/table drop nahi");
await db.exec(M); await db.exec(M);
pass("604 applies twice (idempotent), no destructive SQL");

await db.exec(`insert into farmer_product_demands (product_name, category) values ('Ghee','karyana'), ('Steel','other')`);
for (const c of ['wanda','khal','chowker','moomni','seed','pesticide','fertilizer','micronutrient']) await db.exec(`insert into farmer_product_demands (product_name, category) values ('t','${c}')`);
assert.ok(await bad(`insert into farmer_product_demands (product_name, category) values ('t','bogus')`), "bogus ab bhi mana");
assert.equal((await db.query(`select count(*)::int n from farmer_product_demands`)).rows[0].n, 13);
pass("all 10 values allowed, bogus still rejected, old rows intact");

const R = fs.readFileSync("supabase/rollbacks/604_demand_category_karyana_other.rollback.sql", "utf8");
await db.exec(R);
assert.equal((await db.query(`select count(*)::int n from farmer_product_demands where category in ('karyana','other')`)).rows[0].n, 0);
assert.equal((await db.query(`select count(*)::int n from farmer_product_demands`)).rows[0].n, 13, "rollback rows delete nahi karta");
assert.ok(await bad(`insert into farmer_product_demands (product_name, category) values ('Ghee','karyana')`));
pass("rollback restores old check, keeps rows (category -> null)");
console.log(`\n${ok} checks passed`);
