/**
 * Finance dashboards (Cash Flow / P&L / Inventory) ke hisaab ki jaanch. Bina database.
 *     npm run test:finance-dash
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { computeCashFlow, computePnl, computeInventory, isExcluded, shortAccountName, topWithRest, mondayOf, type GlAccount, type JEntry, type JLine } from "../src/lib/finance-dash/compute";
import { rs, kfmt } from "../src/lib/finance-dash/format";

let n = 0;
const ok = (name: string, fn: () => void) => { fn(); n++; console.log("  ✓", name); };

const gl: GlAccount[] = [
  { code: "1000", name: "Cash in Hand", account_type: "asset" },
  { code: "1011", name: "Bank — Alfalah", account_type: "asset" },
  { code: "1016", name: "Wallet — Easypaisa", account_type: "asset" },
  { code: "1200", name: "Customer se lena (Khata)", account_type: "asset" },
  { code: "2000", name: "Supplier ko dena", account_type: "liability" },
  { code: "4000", name: "Bikri — Dukan", account_type: "income" },
  { code: "5000", name: "Beche hue maal ki lagat", account_type: "expense" },
  { code: "5020", name: "Grain ki khareed", account_type: "expense" },
  { code: "6000", name: "Tankhwahein", account_type: "expense" },
  { code: "6110", name: "Stock ka nuqsan", account_type: "expense" },
];
const E = (id: string, d: string, sm: string, rev = false, st = "posted"): JEntry => ({ id, entry_date: d, source_module: sm, is_reversal: rev, posting_status: st });
const L = (e: string, a: string, dr: number, cr: number): JLine => ({ entry_id: e, account_code: a, debit: dr, credit: cr });

ok("exclusion rule", () => {
  for (const sm of ["grain_sale_correction", "reversal", "opening_balance", "manual", "manual_adjustment", "stock_reconciliation", "pos_shift_close_repair"]) assert.equal(isExcluded({ source_module: sm, is_reversal: false }), true, sm);
  for (const sm of ["pos", "finance", "supplier_payment", "account_transfer"]) assert.equal(isExcluded({ source_module: sm, is_reversal: false }), false, sm);
  assert.equal(isExcluded({ source_module: "pos", is_reversal: true }), true);
});

ok("names + format", () => {
  assert.equal(shortAccountName("Bank — Alfalah"), "Bank Alfalah");
  assert.equal(shortAccountName("Wallet — JazzCash"), "JazzCash");
  assert.equal(shortAccountName("Cash raaste mein (kisi ke haath)"), "Cash raaste mein");
  assert.equal(rs(875687), "Rs 875,687");
  assert.equal(rs(-25000), "-Rs 25,000");
  assert.equal(kfmt(203000), "203K");
  assert.equal(kfmt(5845050), "5.85M");
  assert.equal(mondayOf("2026-09-22"), "2026-09-21");
});

ok("cash flow: in/out, transfers, exclusions, balances", () => {
  const entries = [
    E("a", "2026-10-05", "pos"), E("b", "2026-10-06", "supplier_payment"), E("c", "2026-10-07", "account_transfer"),
    E("d", "2026-10-07", "manual_correction"), E("v", "2026-10-07", "pos", false, "void"), E("old", "2026-01-01", "opening_balance"),
  ];
  const lines = [
    L("a", "1000", 1000, 0), L("a", "4000", 0, 1000),
    L("b", "1011", 0, 400), L("b", "2000", 400, 0),
    L("c", "1011", 300, 0), L("c", "1000", 0, 300),
    L("d", "1000", 5000, 0), L("d", "4000", 0, 5000),
    L("v", "1000", 999, 0), L("v", "4000", 0, 999),
    L("old", "1000", 100, 0), L("old", "2000", 0, 100),
  ];
  const r = computeCashFlow({ from: "2026-10-01", to: "2026-10-21", entries, lines, gl, balanceLines: lines, voidIds: new Set(["v"]) });
  assert.equal(r.cashIn, 1000);
  assert.equal(r.cashOut, 400);
  assert.equal(r.net, 600);
  assert.equal(Math.round(r.margin), 60);
  assert.equal(r.rawIn, 6000); // correction samait
  assert.deepEqual(r.inflows, [{ name: "Bikri — Dukan", value: 1000 }]);
  assert.deepEqual(r.outflows, [{ name: "Supplier ko dena", value: 400 }]);
  const cashBal = r.balances.find((b) => b.name === "Cash in Hand")!.balance;
  assert.equal(cashBal, 1000 - 300 + 5000 + 100); // void bahar
  const alf = r.accounts.find((a) => a.name === "Bank Alfalah")!;
  assert.deepEqual([alf.in, alf.out], [300, 400]);
  assert.equal(r.weekly[0].label, "5 Oct");
});

ok("pnl: months, faded, exclusions, salaries flag, negatives", () => {
  const entries = [E("s1", "2026-08-10", "grain_sale"), E("s2", "2026-09-05", "pos"), E("s3", "2026-10-02", "pos"), E("r1", "2026-10-03", "grain_sale", true), E("x", "2026-10-04", "stock_count_correction"), E("sal", "2026-10-05", "finance"), E("loss", "2026-10-06", "stock_count")];
  const lines = [
    L("s1", "1000", 900, 0), L("s1", "4000", 0, 900), L("s1", "5020", 700, 0), L("s1", "1000", 0, 700),
    L("s2", "1000", 100, 0), L("s2", "4000", 0, 100), L("s2", "5000", 60, 0), L("s2", "1000", 0, 60),
    L("s3", "1000", 200, 0), L("s3", "4000", 0, 200),
    L("r1", "4000", 500, 0), L("r1", "1000", 0, 500),
    L("x", "6110", 50, 0), L("x", "1000", 0, 50),
    L("sal", "6000", 600, 0), L("sal", "1000", 0, 600),
    L("loss", "6110", 0, 20), L("loss", "1000", 20, 0),
  ];
  const r = computePnl({ from: "2026-09-01", to: "2026-10-21", monthStart: "2026-08", entries, lines, gl });
  assert.equal(r.revenue, 300);
  assert.equal(r.expenses, 640);
  assert.equal(r.net, -340);
  assert.deepEqual(r.months.map((m) => [m.label, m.revenue, m.faded]), [["Aug", 900, true], ["Sep", 100, false], ["Oct*", 200, false]]);
  assert.equal(r.salaries, 600);
  assert.equal(r.salariesMissing, true);
  assert.ok(r.excluded.some((x) => x.source === "reversal" && x.value === 500));
  assert.ok(r.excluded.some((x) => x.source === "stock_count_correction"));
  assert.equal(r.expenseCats.at(-1)!.value, -20);
});

ok("inventory: low/out/health/min banner/warehouses", () => {
  const products = [
    { id: "p1", name: "Sprite 2L", category: "Cold Drinks", min_stock_threshold: 10, purchase_price: 100 },
    { id: "p2", name: "Urea", category: "Khaad", min_stock_threshold: 10, purchase_price: 4000 },
    { id: "p3", name: "Coke", category: "Cold Drinks", min_stock_threshold: null, purchase_price: 50 },
    { id: "p4", name: "Daal", category: null, min_stock_threshold: 0, purchase_price: 10 },
  ];
  const inventory = [
    { product_id: "p1", warehouse_id: "w1", quantity_on_hand: 3 },
    { product_id: "p3", warehouse_id: "w1", quantity_on_hand: 20 },
    { product_id: "p3", warehouse_id: "w2", quantity_on_hand: 5 },
    { product_id: "zz", warehouse_id: "w2", quantity_on_hand: 50 },
  ];
  const r = computeInventory({ products, inventory, warehouses: [{ id: "w1", name: "Karyana Godam" }, { id: "w2", name: "HQ" }] });
  assert.equal(r.total, 4); assert.equal(r.inStock, 2); assert.equal(r.outOfStock, 2);
  assert.equal(r.withMin, 2); assert.equal(r.low, 1); assert.equal(r.minSetOut, 1);
  assert.equal(r.healthy, 1); assert.equal(r.health, 25);
  assert.equal(r.stockValue, 300 + 1250);
  assert.deepEqual(r.lowList.map((x) => x.status), ["KAM", "KHATAM"]);
  assert.deepEqual(r.byWarehouse.map((w) => [w.name, w.value, w.items]), [["Karyana Godam", 1300, 2], ["HQ", 250, 1]]);
});

ok("topWithRest", () => {
  const rows = Array.from({ length: 9 }, (_, i) => ({ name: "c" + i, value: 10 - i }));
  const t = topWithRest(rows);
  assert.equal(t.length, 7); assert.equal(t[6].name, "Baqi"); assert.equal(t[6].value, 4 + 3 + 2);
});

ok("pages wired, existing content kept", () => {
  const fr = readFileSync("src/app/admin/finance/reports/page.tsx", "utf8");
  assert.match(fr, /view === "cashflow" && <CashFlowSection/);
  assert.match(fr, /view === "cashflow" && <CashFlowView/);
  const pnl = readFileSync("src/app/admin/reports/pnl/page.tsx", "utf8");
  assert.match(pnl, /<PnlSection /); assert.match(pnl, /rp_total_gross_branches/);
  const inv = readFileSync("src/app/admin/reports/inventory/page.tsx", "utf8");
  assert.match(inv, /<InventorySection \/>/); assert.match(inv, /ri_by_product/);
  const load = readFileSync("src/lib/finance-dash/load.ts", "utf8");
  assert.match(load, /FINANCE_DASH_ROLES = \["owner", "super_admin", "admin", "finance"\]/);
  assert.doesNotMatch(load, /\.(insert|update|delete|upsert|rpc)\(/);
});

console.log(`\n${n} finance-dash checks passed`);
