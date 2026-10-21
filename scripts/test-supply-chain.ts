/* Supply Chain dashboard: hisaab (compute) aur view ke empty states. Database nahi chahiye. */
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { computeSupplyChain, deltaText, expectedFrom, pkDate, type ScInput } from "../src/lib/supply-chain/compute";
import { medianLeadDays } from "../src/lib/supply-chain/lead-days-core";
import { SupplyChainDashboard } from "../src/components/supply-chain/views";

const base = (): ScInput => ({
  today: "2026-10-21",
  filters: { month: "", branch: "", category: "", supplier: "" },
  purchases: [
    { id: "p1", purchase_number: "PO-1", purchase_date: "2026-10-01", expected_date: "2026-10-05", received_at: "2026-10-04T10:00:00Z", branch_id: "b1", supplier_id: "s1", status: "received", total_amount: 1000 },
    { id: "p2", purchase_number: "PO-2", purchase_date: "2026-10-02", expected_date: "2026-10-04", received_at: "2026-10-06T20:00:00Z", branch_id: "b2", supplier_id: "s2", status: "received", total_amount: 2000 },
    { id: "p3", purchase_number: "PO-3", purchase_date: "2026-10-10", expected_date: null, received_at: null, branch_id: "b1", supplier_id: "s1", status: "pending", total_amount: 500 },
    { id: "p4", purchase_number: "PO-4", purchase_date: "2026-09-10", expected_date: "2026-09-12", received_at: "2026-09-12T05:00:00Z", branch_id: "b1", supplier_id: "s1", status: "received", total_amount: 700 },
    { id: "px", purchase_number: "PO-X", purchase_date: "2026-10-03", expected_date: null, received_at: null, branch_id: "b1", supplier_id: "s1", status: "cancelled", total_amount: 99999 },
  ],
  items: [
    { purchase_id: "p1", product_id: "a", quantity: 10, received_qty: 10, short_qty: 0, damaged_qty: 1 },
    { purchase_id: "p2", product_id: "b", quantity: 10, received_qty: 8, short_qty: 2, damaged_qty: 0 },
    { purchase_id: "p3", product_id: "a", quantity: 5, received_qty: null, short_qty: 0, damaged_qty: 0 },
    { purchase_id: "p4", product_id: "a", quantity: 4, received_qty: 4, short_qty: 0, damaged_qty: 0 },
  ],
  products: [
    { id: "a", name: "DAP 50kg", category_id: "c1", min_stock_threshold: 5, purchase_price: 100 },
    { id: "b", name: "Gandum beej", category_id: "c2", min_stock_threshold: 0, purchase_price: 50 },
    { id: "c", name: "Urea", category_id: "c1", min_stock_threshold: 3, purchase_price: 10 },
  ],
  stockByProduct: { a: 10, b: 20, c: 0 },
  costs: [{ purchase_id: "p1", cost_type: "kiraya", amount: 150 }, { purchase_id: "p2", cost_type: "ajeeb", amount: 50 }],
  cogsByMonth: { "2026-10": 1000, "2026-09": 500 },
  names: { suppliers: { s1: "Engro", s2: "Punjab Seed" }, branches: { b1: "Main", b2: "Branch 2" }, categories: { c1: "Khaad", c2: "Beej" } },
  hasExpectedDate: true,
  hasCosts: true,
});

// PKT tareekh: 20:00Z = agle din 01:00 PKT.
assert.equal(pkDate("2026-10-06T20:00:00Z"), "2026-10-07");
assert.equal(expectedFrom("2026-10-01", 4), "2026-10-05");
assert.equal(expectedFrom("2026-10-01", null), "");

// Oct ka mahina
let r = computeSupplyChain({ ...base(), filters: { month: "2026-10", branch: "", category: "", supplier: "" } });
assert.equal(r.counts.po, 3, "cancelled bahar");
assert.equal(r.kpi.onTime.value, 50, "p1 waqt par, p2 late");
assert.equal(r.kpi.onTime.prev, 100, "Sep: p4 waqt par");
assert.equal(r.kpi.leadDays.value, 4, "p1 3 din, p2 5 din (PKT)");
assert.equal(r.kpi.fillRate.value, 85, "(9 + 8) / 20");
assert.equal(r.kpi.totalCost.value, 3500 + 200, "khareed + kharche");
assert.equal(r.kpi.turnover.value, 1000 / (10 * 100 + 20 * 50), "COGS ÷ stock value");
assert.equal(r.kpi.stockout.value, 50, "a aur c tracked, c khatam");
assert.equal(r.counts.noMin, 1);
assert.equal(r.noMinProducts[0].id, "b");
assert.deepEqual(r.costSplit.map((c) => c.key), ["khareed", "kiraya", "deegar"], "na-maloom qisam deegar mein");
assert.deepEqual(r.rows.map((x) => [x.po, x.status]), [["PO-3", "intezar"], ["PO-2", "late"], ["PO-1", "waqt_par"]]);
assert.equal(r.months.length, 12);
assert.equal(r.months[11].key, "2026-10");
assert.equal(r.months[11].grn, 2);
assert.equal(r.months[10].onTime, 100);

// Filters
r = computeSupplyChain({ ...base(), filters: { month: "2026-10", branch: "b2", category: "", supplier: "" } });
assert.deepEqual(r.rows.map((x) => x.po), ["PO-2"]);
r = computeSupplyChain({ ...base(), filters: { month: "2026-10", branch: "", category: "c2", supplier: "" } });
assert.deepEqual(r.rows.map((x) => x.po), ["PO-2"]);
assert.equal(r.kpi.stockout.value, null, "Beej par koi hadd nahi -> data nahi, 0 nahi");
r = computeSupplyChain({ ...base(), filters: { month: "2026-10", branch: "", category: "", supplier: "s1" } });
assert.deepEqual(r.rows.map((x) => x.po), ["PO-3", "PO-1"]);
r = computeSupplyChain({ ...base(), filters: { month: "bakwas", branch: "", category: "", supplier: "" } });
assert.equal(r.periodLabel, "Pichle 12 mahine");

// Khali data: har KPI null, farzi number nahi.
const empty = computeSupplyChain({ ...base(), purchases: [], items: [], costs: [], cogsByMonth: {}, stockByProduct: {}, products: [], hasExpectedDate: false, hasCosts: false });
for (const [k, v] of Object.entries(empty.kpi)) assert.equal(v.value, null, k);
assert.ok(empty.months.every((m) => m.onTime == null && m.lead == null && m.turnover == null && m.grn === 0));

// Expected tareekh na ho to waqt par % null (0 nahi).
const noExp = computeSupplyChain({ ...base(), purchases: base().purchases.map((p) => ({ ...p, expected_date: null })) });
assert.equal(noExp.kpi.onTime.value, null);
assert.notEqual(noExp.kpi.leadDays.value, null);

assert.deepEqual(deltaText({ value: 5, prev: 4 }, "num", true), { text: "▲ 1.0 pichle se", good: false });
assert.equal(deltaText({ value: 5, prev: null }, "num").text, "");

assert.deepEqual(medianLeadDays([
  { supplier_id: "s", purchase_date: "2026-10-01", received_at: "2026-10-03T05:00:00Z" },
  { supplier_id: "s", purchase_date: "2026-10-01", received_at: "2026-10-09T05:00:00Z" },
  { supplier_id: "s", purchase_date: "2026-10-01", received_at: "2026-10-05T05:00:00Z" },
  { supplier_id: null, purchase_date: "2026-10-01", received_at: "2026-10-05T05:00:00Z" },
]), { s: 4 });

// View: empty states aur chips
const opts = { months: [{ key: "2026-10", label: "Oct 26" }], branches: [], categories: [], suppliers: [] };
const f = { month: "", branch: "", category: "", supplier: "" };
let html = renderToStaticMarkup(createElement(SupplyChainDashboard, { d: empty, filters: f, options: opts }));
assert.ok(html.includes("migration 692"), "migration paighaam");
assert.equal((html.match(/Data nahi/g) ?? []).length, 6, "6 KPI empty");
assert.ok(html.includes("koi GRN nahi") && html.includes("koi PO nahi mila"));
assert.ok(!/Rs \d/.test(html), "khali par koi raqam nahi");
html = renderToStaticMarkup(createElement(SupplyChainDashboard, { d: computeSupplyChain({ ...base(), filters: { ...f, month: "2026-10" } }), filters: f, options: opts }));
assert.ok(html.includes("Waqt par") && html.includes("Late") && html.includes("Maal baqi"));
assert.ok(html.includes("sc-min-stock"));
for (const s of ["Mahina", "Branch / Dukan", "Category", "Supplier"]) assert.ok(html.includes(s), s);
console.log("supply-chain: ok");
