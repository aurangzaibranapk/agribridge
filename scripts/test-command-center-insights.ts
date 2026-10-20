import assert from "node:assert";
import {
  parseInsightFilters, computeKpis, timeframeWindow, bucketize, rankBy, topBottom, donutSlices,
  visibleCategories, sparkSeries, marginNote, pktDate, type SaleRow, type ItemRow,
} from "../src/lib/command-center-insights-core";

const SHOP = "1358b70a-91fe-41c3-97d7-c9ef8a018cfc";
const CAT = "27aa3a43-e857-419e-9198-723dc5ceba67";

// Filters: defaults + ghalat qeemat rad
let f = parseInsightFilters(undefined, "2026-10-21", [SHOP]);
assert.deepStrictEqual(f, { shopId: null, categoryId: null, from: "2026-09-22", to: "2026-10-21", tf: "30d" });
f = parseInsightFilters({ cc_shop: "evil", cc_cat: "'; drop", cc_from: "x", cc_to: "2099-01-01", cc_tf: "zz" }, "2026-10-21", [SHOP]);
assert.strictEqual(f.shopId, null); assert.strictEqual(f.categoryId, null); assert.strictEqual(f.to, "2026-10-21"); assert.strictEqual(f.tf, "30d");
f = parseInsightFilters({ cc_shop: SHOP, cc_cat: CAT, cc_from: "2020-01-01", cc_to: "2026-10-01", cc_tf: "1y" }, "2026-10-21", [SHOP]);
assert.strictEqual(f.shopId, SHOP); assert.strictEqual(f.categoryId, CAT); assert.strictEqual(f.tf, "1y");
assert.strictEqual(f.from, "2025-09-30", "range 1 saal tak mehdood");
f = parseInsightFilters({ cc_from: "2026-10-10", cc_to: "2026-10-05" }, "2026-10-21", []);
assert.strictEqual(f.from, "2026-09-06");

// PKT tareekh: 20 Oct 19:30Z = 21 Oct 00:30 PKT
assert.strictEqual(pktDate("2026-10-20T19:30:00Z"), "2026-10-21");

// KPIs
const sales: SaleRow[] = [
  { id: "a", total_amount: 1000, profit: 300, created_at: "2026-10-20T05:00:00Z", shop_id: SHOP, customer_id: "c1", crm_customer_id: null },
  { id: "b", total_amount: 500, profit: 100, created_at: "2026-10-20T06:00:00Z", shop_id: SHOP, customer_id: "c1", crm_customer_id: null },
  { id: "c", total_amount: 200, profit: 50, created_at: "2026-10-19T06:00:00Z", shop_id: SHOP, customer_id: null, crm_customer_id: "c2" },
];
const items: ItemRow[] = [
  { sale_id: "a", product_id: "p1", quantity: 2, subtotal: 1000, line_cogs: 700, unit_cost: 350 },
  { sale_id: "b", product_id: "p2", quantity: 5, subtotal: 500, line_cogs: 0, unit_cost: null },
  { sale_id: "c", product_id: "p1", quantity: 1, subtotal: 200, line_cogs: 150, unit_cost: 150 },
];
const catOf = (p: string | null) => (p === "p1" ? "cat1" : "cat2");
let k = computeKpis(sales, items, catOf, null);
assert.deepStrictEqual([k.sales, k.orders, k.customers, k.profit, k.qty, k.missingCostLines], [1700, 3, 2, 450, 8, 1]);
assert.ok(Math.abs((k.marginPct ?? 0) - 26.47) < 0.01);
assert.match(marginNote(k) ?? "", /1 lines \(33%\) ki cost khali/);
k = computeKpis(sales, items, catOf, "cat1");
assert.deepStrictEqual([k.sales, k.orders, k.customers, k.profit, k.qty], [1200, 2, 2, 350, 3]);
assert.strictEqual(marginNote(k), null);
assert.strictEqual(computeKpis([], [], catOf, null).marginPct, null);

// Timeframes
const now = Date.parse("2026-10-20T10:07:00Z"); // 15:07 PKT
const w30 = timeframeWindow("30d", now);
assert.strictEqual(w30.buckets.length, 30); assert.strictEqual(w30.buckets[29].key, "2026-10-20");
assert.strictEqual(timeframeWindow("7d", now).buckets.length, 7);
const aaj = timeframeWindow("aaj", now);
assert.strictEqual(aaj.buckets.length, 24); assert.strictEqual(aaj.startIso, "2026-10-19T19:00:00.000Z");
assert.strictEqual(aaj.bucketOf("2026-10-20T05:00:00Z"), "10");
assert.strictEqual(aaj.bucketOf("2026-10-19T05:00:00Z"), null);
const live = timeframeWindow("live", now);
assert.strictEqual(live.buckets.length, 12); assert.strictEqual(live.buckets[11].label, "15:05");
assert.strictEqual(live.bucketOf("2026-10-20T08:00:00Z"), null);
const y = timeframeWindow("1y", now);
assert.strictEqual(y.buckets.length, 12); assert.strictEqual(y.buckets[11].key, "2026-10"); assert.strictEqual(y.buckets[0].key, "2025-11");
const pts = bucketize(w30.buckets, w30.bucketOf, sales.map((s) => ({ ts: s.created_at, amount: s.total_amount ?? 0 })));
assert.strictEqual(pts[29].amount, 1500); assert.strictEqual(pts[28].amount, 200);

// Ranking
const r = rankBy(items, (i) => i.product_id, (x) => x.toUpperCase());
assert.deepStrictEqual(r.map((x) => [x.id, x.amount, x.qty, x.profit]), [["p1", 1200, 3, 350], ["p2", 500, 5, 500]]);
const many = Array.from({ length: 20 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, amount: 100 - i, qty: 1, profit: 0 }));
const tb = topBottom(many, 10, 5);
assert.strictEqual(tb.top.length, 10); assert.deepStrictEqual(tb.bottom.map((x) => x.id), ["p19", "p18", "p17", "p16", "p15"]);
const small = topBottom(many.slice(0, 12), 10, 5);
assert.strictEqual(small.bottom.length, 2, "top aur bottom mein dohra nahi");
const d = donutSlices(many.slice(0, 9), 7);
assert.strictEqual(d.length, 7); assert.strictEqual(d[6].name, "Baqi"); assert.strictEqual(d[6].amount, 94 + 93 + 92);

// Shop ki category ijazat (686): khali = sab
const cats = [{ id: "x" }, { id: "y" }];
assert.strictEqual(visibleCategories(cats, []).length, 2);
assert.strictEqual(visibleCategories(cats, null).length, 2);
assert.deepStrictEqual(visibleCategories(cats, ["y"]), [{ id: "y" }]);

// Sparkline
const sp = sparkSeries([{ ts: "2026-10-01T00:00:00Z", value: 5 }, { ts: "2026-10-10T23:00:00Z", value: 3 }, { ts: "2027-01-01T00:00:00Z", value: 99 }], "2026-10-01T00:00:00Z", "2026-10-11T00:00:00Z");
assert.strictEqual(sp.length, 10); assert.strictEqual(sp[0], 5); assert.strictEqual(sp[9], 3);

console.log("command-center-insights: ok");
