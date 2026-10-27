import assert from "node:assert/strict";
import { chooseWheat, dominantRate, presentSeries, rateDelta } from "../src/lib/public/today-rates";
import { lowStockList, saleBucket, saleProfit, summarizeSales, walkCategory } from "../src/lib/reports/sales-analytics";

const cats = [
  { id: "g", name: "Grocery", parent_category_id: null },
  { id: "d", name: "Dairy Products", parent_category_id: "g" },
  { id: "f", name: "Fertilizer", parent_category_id: null },
  { id: "s", name: "Seeds", parent_category_id: null },
  { id: "feed", name: "Animal Feed", parent_category_id: null },
];
const byId = new Map(cats.map((c) => [c.id, c]));

assert.equal(saleBucket(walkCategory("f", byId).root, "Fertilizer", "DAP"), "khaad");
assert.equal(saleBucket(walkCategory("s", byId).root, "Seeds", "Gandum beej"), "beej");
assert.equal(saleBucket(walkCategory("d", byId).root, "Dairy Products", "Doodh pack"), "doodh");
assert.equal(saleBucket(walkCategory("g", byId).root, "Grocery", "Cheeni"), "karyana");
assert.equal(saleBucket("Animal Feed", "Wanda", "Wanda bori"), "aur");

const numbers = summarizeSales(
  [
    { id: "a", total_amount: 1000, profit: 200, total_cogs: 800 },
    { id: "b", total_amount: 500, profit: null, total_cogs: null },
  ],
  [
    { sale_id: "a", product_id: "p1", subtotal: 1000 },
    { sale_id: "b", product_id: "p2", subtotal: 500 },
  ],
  [
    { id: "p1", name: "DAP", category_id: "f", unit: "bag", pack_size: null, min_stock_threshold: 5 },
    { id: "p2", name: "Cheeni", category_id: "g", unit: "kg", pack_size: null, min_stock_threshold: 2 },
  ],
  cats,
  true,
);
assert.equal(numbers.total, 1500);
assert.equal(numbers.orders, 2);
assert.equal(numbers.munafa, 200);
assert.equal(numbers.munafaGap, true);
assert.equal(numbers.buckets.khaad, 1000);
assert.equal(numbers.buckets.karyana, 500);

const empty = summarizeSales([], [], [], [], true);
assert.equal(empty.total, 0);
assert.equal(empty.munafa, 0);
assert.equal(saleProfit({ profit: null, total_amount: 80, total_cogs: 50 }), 30);
assert.equal(saleProfit({ profit: null, total_amount: 80, total_cogs: null }), null);

const low = lowStockList(
  [
    { id: "1", name: "DAP khaad", category_id: "f", unit: "bori", pack_size: null, min_stock_threshold: 10 },
    { id: "2", name: "Cheeni", category_id: "g", unit: "kg", pack_size: null, min_stock_threshold: 5 },
    { id: "3", name: "Urea", category_id: "f", unit: "bag", pack_size: null, min_stock_threshold: 1 },
  ],
  new Map([["1", 4], ["2", 3], ["3", 8]]),
);
assert.equal(low.tracked, true);
assert.deepEqual(low.rows.map((r) => r.line), ["DAP khaad — 4 bori", "Cheeni — 3 kg"]);
assert.equal(lowStockList([{ id: "x", name: "X", category_id: null, unit: null, pack_size: null, min_stock_threshold: 0 }], new Map()).tracked, false);

assert.equal(dominantRate([{ date: "2026-10-27", rate: 210, weight: 10 }, { date: "2026-10-27", rate: 200, weight: 40 }], "2026-10-27"), 200);
assert.deepEqual(rateDelta(215, 210), { kind: "up", diff: 5 });
assert.deepEqual(rateDelta(3900, 3900), { kind: "same", diff: 0 });
assert.equal(rateDelta(210, null).kind, "unknown");

const wheat = chooseWheat(
  "2026-10-27",
  "2026-10-26",
  [{ date: "2026-10-27", rate: 3900, weight: 800 }],
  [{ date: "2026-10-27", rate: 4100, weight: 1 }],
);
assert.equal(wheat.amount, 3900);
assert.equal(wheat.isToday, true);
assert.match(wheat.source ?? "", /kharid/);

const oldOnly = presentSeries("2026-10-27", "2026-10-26", [{ date: "2026-10-25", rate: 200, weight: 5 }], null, "collection");
assert.equal(oldOnly.isToday, false);
assert.equal(oldOnly.asOf, "2026-10-25");
assert.equal(oldOnly.amount, 200);

const none = chooseWheat("2026-10-27", "2026-10-26", [], []);
assert.equal(none.amount, null);

console.log("reel website features: ok");
