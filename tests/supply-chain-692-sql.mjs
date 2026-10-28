// 692 Supply Chain: migration additive hai, 2 dafa chal sakti hai, rollback saaf hai, aur RPC ke number TS hisaab se milte hain.
// Sirf LOCAL Postgres (SC_PGHOST / SC_PGPORT). Live ko kabhi nahi chhoota. Postgres na mile to SQL hissa skip.
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const mig = fs.readFileSync("supabase/migrations/692_supply_chain_dashboard.sql", "utf8");
const rb = fs.readFileSync("supabase/migrations/692_supply_chain_dashboard.rollback.sql", "utf8");
const code = mig.replace(/--.*$/gm, "");
assert.ok(!/\b(drop\s+table|drop\s+column|delete\s+from|truncate|update\s+public\.)/i.test(code), "692 additive honi chahiye");
assert.ok(/add column if not exists expected_date date/.test(code));
assert.ok(/add column if not exists default_lead_days/.test(code));
assert.ok(/cost_type in \('kiraya', 'godam', 'packing', 'mazdoori', 'deegar'\)/.test(code));
assert.ok(/security_invoker = true/.test(code), "view RLS ka khayal rakhe");
assert.ok(/revoke all on function public\.fn_supply_chain_kpis[^;]*from public, anon/.test(code));
for (const n of ["fn_supply_chain_kpis", "fn_supply_chain_monthly", "v_sc_po_delivery", "purchase_costs", "expected_date", "default_lead_days", "reports.supply-chain"]) assert.ok(rb.includes(n), "rollback: " + n);
const nav = fs.readFileSync("src/components/layout/nav-items.ts", "utf8");
assert.ok(nav.includes('"/admin/reports/supply-chain"'), "sidebar fallback");
assert.ok(fs.readFileSync("src/lib/departments.ts", "utf8").includes('"/admin/reports/supply-chain"'), "department access");
assert.ok(fs.readFileSync("src/app/admin/reports/inventory/page.tsx", "utf8").includes("/admin/reports/supply-chain"), "inventory dashboard se link");
assert.ok(fs.readFileSync("src/app/admin/purchases/purchase-form.tsx", "utf8").includes('name="expected_date"'), "PO form field");
assert.ok(fs.readFileSync("src/actions/purchases.ts", "utf8").includes("expected_date: expectedDate"), "PO action save");

const HOST = process.env.SC_PGHOST ?? "/var/run/postgresql";
const PORT = process.env.SC_PGPORT ?? "5432";
if (!(HOST.startsWith("/") || HOST === "localhost" || HOST === "127.0.0.1")) { console.error("Sirf local Postgres."); process.exit(1); }
const DB = "supply692_test";
const psql = (sql, db = DB) => {
  const r = spawnSync("psql", ["-h", HOST, "-p", PORT, "-U", process.env.SC_PGUSER ?? "postgres", "-d", db, "-X", "-q", "-At", "-v", "ON_ERROR_STOP=1"], { input: sql, encoding: "utf8" });
  return { ok: r.status === 0, out: (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim() };
};
if (!psql("select 1", "postgres").ok) { console.log("supply-chain-692-sql: static ok; local Postgres nahi mila -- SQL skip"); process.exit(0); }
psql(`drop database if exists ${DB}`, "postgres");
assert.ok(psql(`create database ${DB}`, "postgres").ok);
let r = psql(fs.readFileSync("tests/sql/supply-chain-692-stub.sql", "utf8"));
assert.ok(r.ok, r.err);
r = psql(mig + "\n" + mig);
assert.ok(r.ok, "migration 2 dafa: " + r.err);

const U = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
r = psql(`
insert into branches values ('${U(1)}','Main'),('${U(2)}','B2');
insert into warehouses values ('${U(11)}','${U(1)}'),('${U(12)}','${U(2)}');
insert into categories values ('${U(21)}','Khaad'),('${U(22)}','Beej');
insert into suppliers (id,name) values ('${U(31)}','Engro'),('${U(32)}','PSC');
insert into products values ('${U(41)}','DAP','${U(21)}',5,100,false),('${U(42)}','Beej','${U(22)}',0,50,false),('${U(43)}','Urea','${U(21)}',3,10,false);
insert into inventory (product_id,warehouse_id,quantity_on_hand) values ('${U(41)}','${U(11)}',10),('${U(42)}','${U(12)}',20);
insert into purchases (id,purchase_number,purchase_date,expected_date,received_at,branch_id,supplier_id,status,total_amount) values
 ('${U(51)}','PO-1','2026-10-01','2026-10-05','2026-10-04 10:00Z','${U(1)}','${U(31)}','received',1000),
 ('${U(52)}','PO-2','2026-10-02','2026-10-04','2026-10-06 20:00Z','${U(2)}','${U(32)}','received',2000),
 ('${U(53)}','PO-3','2026-10-10',null,null,'${U(1)}','${U(31)}','pending',500),
 ('${U(54)}','PO-X','2026-10-03',null,null,'${U(1)}','${U(31)}','cancelled',99999);
insert into purchase_items (purchase_id,product_id,quantity,received_qty,short_qty,damaged_qty) values
 ('${U(51)}','${U(41)}',10,10,0,1),('${U(52)}','${U(42)}',10,8,2,0),('${U(53)}','${U(41)}',5,null,0,0);
insert into purchase_costs (purchase_id,cost_type,amount) values ('${U(51)}','kiraya',150);
insert into sales values ('${U(61)}','2026-10-05','${U(1)}','confirmed'),('${U(62)}','2026-10-06','${U(1)}','cancelled');
insert into sale_items (sale_id,product_id,line_purchase_value) values ('${U(61)}','${U(41)}',1000),('${U(62)}','${U(41)}',777);
`);
assert.ok(r.ok, r.err);
const k = JSON.parse(psql(`select fn_supply_chain_kpis('2026-10-01','2026-10-31')`).out);
assert.equal(k.po_count, 3);
assert.equal(Number(k.on_time_pct), 50);
assert.equal(Number(k.avg_lead_days), 4, "PKT tareekh se 3 aur 5 din");
assert.equal(Number(k.fill_rate_pct), 85);
assert.equal(Number(k.procurement_total), 3500);
assert.equal(Number(k.cost_by_type.kiraya), 150);
assert.equal(Number(k.turnover), 0.5, "1000 / (1000 + 1000)");
assert.equal(Number(k.stockout_pct), 50);
const kb = JSON.parse(psql(`select fn_supply_chain_kpis('2026-10-01','2026-10-31', p_branch => '${U(2)}')`).out);
assert.equal(kb.po_count, 1);
const kc = JSON.parse(psql(`select fn_supply_chain_kpis('2026-10-01','2026-10-31', p_category => '${U(22)}')`).out);
assert.equal(kc.stockout_pct, null, "hadd nahi to NULL, 0 nahi");
const ke = JSON.parse(psql(`select fn_supply_chain_kpis('2025-01-01','2025-01-31')`).out);
assert.equal(ke.on_time_pct, null); assert.equal(ke.avg_lead_days, null); assert.equal(ke.fill_rate_pct, null);
const m = psql(`select month, grn_count, on_time_pct from fn_supply_chain_monthly('2026-09-01','2026-10-31')`).out.split("\n");
assert.deepEqual(m, ["2026-09|0|", "2026-10|2|50.0"]);
assert.equal(psql(`select count(*) from dashboard_features where feature_key='reports.supply-chain'`).out, "1");
assert.equal(psql(`select has_function_privilege('anon','fn_supply_chain_kpis(date,date,uuid,uuid,uuid)','execute')`).out, "f");
r = psql(`insert into purchase_costs (purchase_id,cost_type,amount) values ('${U(51)}','chai',1)`);
assert.ok(!r.ok, "ghalat qisam rad");
r = psql(rb);
assert.ok(r.ok, "rollback: " + r.err);
assert.equal(psql(`select count(*) from information_schema.columns where table_name='purchases' and column_name='expected_date'`).out, "0");
assert.equal(psql(`select count(*) from purchases`).out, "4", "rollback purana data nahi chhoota");
r = psql(mig);
assert.ok(r.ok, "rollback ke baad dobara: " + r.err);
psql(`drop database if exists ${DB}`, "postgres");
console.log("supply-chain-692-sql: ok");
