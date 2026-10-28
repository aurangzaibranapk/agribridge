import assert from "node:assert/strict";
import fs from "node:fs";
import {
  canSeeSalesSecrets, shouldUseMeriDukan, salesReportSections, loadScope, cashHealth, MERI_DUKAN_ROUTE,
} from "../src/lib/reports/sales-secrets";
import { routeGrants, pathAllowed } from "../src/lib/access/route-match";

let n = 0;
const ok = (name: string, f: () => void) => { try { f(); n++; } catch (e) { console.error(`FAIL: ${name}`); throw e; } };

// ---------- kaun raaz dekh sakta hai ----------
ok("owner/admin/super_admin raaz dekhte hain", () => {
  for (const r of ["owner", "super_admin", "admin"]) assert.equal(canSeeSalesSecrets(r), true, r);
});
ok("baqi koi nahi", () => {
  for (const r of ["sales_staff", "manager", "finance", "admin_assistant", "warehouse", "hr", "", null, undefined])
    assert.equal(canSeeSalesSecrets(r as any), false, String(r));
});
ok("7 raaz wale hisse sirf owner ko", () => {
  const owner = salesReportSections("owner");
  const staff = salesReportSections("manager");
  for (const k of ["stockValue", "stockValueByType", "slowStockCost", "expenses", "loadEarnings", "allShopsTable", "totalReceivable"] as const) {
    assert.equal(owner[k], true, `owner ${k}`);
    assert.equal(staff[k], false, `staff ${k}`);
  }
  for (const k of ["stockCount", "sales", "cashHealth", "recentSales"] as const) assert.equal(staff[k], true, k);
});
ok("sales_staff Meri Dukan par", () => {
  assert.equal(shouldUseMeriDukan("sales_staff"), true);
  assert.equal(shouldUseMeriDukan("owner"), false);
  assert.equal(shouldUseMeriDukan("manager"), false);
  assert.equal(MERI_DUKAN_ROUTE.startsWith("/admin/reports/sales/"), true, "reports.sales ki ijazat se khulta hai");
});

// ---------- load ka daira (scope bug) ----------
ok("load: dukan > branch > sab", () => {
  assert.deepEqual(loadScope({ shopId: "s1", branchId: "b1" }), { column: "shop_id", value: "s1" });
  assert.deepEqual(loadScope({ shopId: "", branchId: "b1" }), { column: "branch_id", value: "b1" });
  assert.equal(loadScope({}), null);
});

// ---------- cash health ----------
ok("cash health", () => {
  const a = cashHealth(100, 80, 20); assert.equal(a.ok, true);
  const b = cashHealth(111657, 25760, 84417); assert.equal(b.ok, false); assert.ok(Math.abs(b.cashPct - 23.07) < 0.1);
  const c = cashHealth(0, 0, 0); assert.equal(c.cashPct, 0); assert.equal(c.ok, false);
});

// ---------- /admin/reports prefix gap ----------
ok("reports hub sirf hub kholta hai", () => {
  assert.equal(routeGrants("/admin/reports", "/admin/reports"), true);
  for (const p of ["/admin/reports/pnl", "/admin/reports/profit-loss", "/admin/reports/salary-planner", "/admin/reports/stock-value", "/admin/reports/sales"])
    assert.equal(pathAllowed(["/admin/reports"], p), false, p);
});
ok("har report apni ijazat se", () => {
  assert.equal(pathAllowed(["/admin/reports/sales"], "/admin/reports/sales"), true);
  assert.equal(pathAllowed(["/admin/reports/sales"], "/admin/reports/sales/meri-dukan"), true);
  assert.equal(pathAllowed(["/admin/reports/sales"], "/admin/reports/sales/slow-stock"), true);
  assert.equal(pathAllowed(["/admin/reports/sales"], "/admin/reports/pnl"), false);
  assert.equal(pathAllowed(["/admin/reports/pnl"], "/admin/reports/profit-loss"), true, "profit-loss = pnl ki ijazat");
  assert.equal(pathAllowed(["/admin/reports/stock-value"], "/admin/reports/stock-reconcile"), true);
  assert.equal(pathAllowed(["/admin/reports/sales"], "/admin/reports/stock-reconcile"), false);
  assert.equal(pathAllowed(["/admin/shop-360"], "/admin/reports/shop-summary"), true);
  assert.equal(pathAllowed(["/admin/reports"], "/admin/reports/shop-summary"), false);
});
ok("aam prefix qaida wese hi", () => {
  assert.equal(pathAllowed(["/admin/milk-collection"], "/admin/milk-collection/verify"), true);
  assert.equal(pathAllowed(["/admin/pos?tab=x"], "/admin/pos/ordering"), true);
  assert.equal(pathAllowed(["/admin/pos"], "/admin/posx"), false);
  assert.equal(pathAllowed([], "/admin/pos"), false);
});

// ---------- code: raaz ki query sirf owner ke liye ----------
const page = fs.readFileSync("src/app/admin/reports/sales/page.tsx", "utf8");
const meri = fs.readFileSync("src/app/admin/reports/sales/meri-dukan/page.tsx", "utf8");
const slow = fs.readFileSync("src/app/admin/reports/sales/slow-stock/page.tsx", "utf8");
const mw = fs.readFileSync("src/middleware.ts", "utf8");
const site = fs.readFileSync("src/app/(site)/products/[id]/page.tsx", "utf8");

function guardedBefore(src: string, needle: string, guard: string) {
  const i = src.indexOf(needle);
  assert.ok(i > 0, `missing ${needle}`);
  const before = src.slice(Math.max(0, i - 700), i);
  assert.ok(before.includes(guard), `${needle} must be behind ${guard}`);
}
ok("sales page: kharche/load/cost query guarded", () => {
  guardedBefore(page, '.from("finance_transactions")', "show.expenses");
  guardedBefore(page, '.from("load_transactions")', "show.loadEarnings");
  guardedBefore(page, '.select("id, purchase_price")', "show.stockValue");
  guardedBefore(page, 'service.from("stock_batches")', "show.stockValue");
  assert.match(page, /shouldUseMeriDukan\(/);
  assert.match(page, /redirect\(`\$\{MERI_DUKAN_ROUTE\}/);
});
ok("sales page: cards guarded", () => {
  for (const [label, guard] of [
    ['label="Stock ki qeemat"', "show.stockValue"],
    ['label="Kul lena hai"', "show.totalReceivable"],
    ['label="Daily kharche"', "show.expenses"],
    ['label="Load ki kamai"', "show.loadEarnings"],
    ["Har Shop ka Alag Hisaab", "show.allShopsTable"],
    ["Stock ki qeemat (kharid par)", "show.stockValueByType"],
  ] as const) guardedBefore(page, label, guard);
  // purana scope bug: dukan wale bande ka branch filter khali -> sab branches
  assert.doesNotMatch(page, /!branchId \|\| l\.branch_id === branchId/);
});
ok("Meri Dukan: koi qeemat ya raaz nahi", () => {
  for (const bad of ["purchase_price", "unit_cost", "finance_transactions", "load_transactions", "current_balance", "stock_batches", "credit_limit"])
    assert.equal(meri.includes(bad), false, bad);
  assert.match(meri, /\.eq\("shop_id", shopId\)/);
  assert.match(meri, /canSeeSalesSecrets/);
});
ok("slow-stock: cost sirf owner", () => {
  assert.match(slow, /showCost \? "id, name, pack_size, purchase_price" : "id, name, pack_size"/);
  assert.match(slow, /\{showCost && <th[^>]*>Value<\/th>\}/);
});
ok("middleware ek hi qaida", () => { assert.match(mw, /pathAllowed\(allowed, path\)/); });
ok("public product page select * nahi", () => {
  assert.doesNotMatch(site, /\.select\("\*/);
  assert.doesNotMatch(site.replace(/\/\/.*$/gm, ""), /purchase_price/);
});
ok("koi public (site/portal) safha purchase_price nahi maangta", () => {
  const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`]);
  for (const f of [...walk("src/app/(site)"), ...walk("src/app/portal")].filter((f) => /\.tsx?$/.test(f))) {
    // Kisan ka apna janwar: us ki apni kharid qeemat (dairy_animals, sirf us ka data) -- dukan ka raaz nahi.
    if (f === "src/app/portal/dairy/animals/new/page.tsx") continue;
    const code = fs.readFileSync(f, "utf8").replace(/\/\/.*$/gm, "");
    assert.doesNotMatch(code, /purchase_price|unit_cost/, f);
    assert.doesNotMatch(code, /from\("products"\)\s*\.select\("\*/, f);
  }
});

console.log(`sales-secrets: ${n}/${n} pass`);
