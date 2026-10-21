/** Stock ka nishan.  npm run test:stock-badge */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stockStatus, STOCK_LABEL, formatStockQty } from "../src/lib/stock/stock-status";
let n = 0; const test = (name: string, fn: () => void) => { fn(); n++; console.log("ok", name); };
test("0 = khatam", () => { assert.equal(stockStatus(0, 5), "out"); assert.equal(stockStatus(null, 5), "out"); assert.equal(stockStatus(-2, 0), "out"); });
test("min ya kam = kam reh gaya", () => { assert.equal(stockStatus(3, 6), "low"); assert.equal(stockStatus(20, 20), "low"); });
test("min se upar = stock mein", () => { assert.equal(stockStatus(48, 12), "ok"); });
test("min na ho to >0 hara", () => { assert.equal(stockStatus(1, null), "ok"); assert.equal(stockStatus(1, 0), "ok"); });
test("labels", () => assert.deepEqual(STOCK_LABEL, { ok: "Stock mein", low: "Kam reh gaya", out: "Khatam" }));
test("qty format", () => { assert.equal(formatStockQty(10, "kg"), "10 kg"); assert.equal(formatStockQty(1.5), "1.5"); });
test("wiring", () => {
  const pos = readFileSync("src/components/pos/pos-client.tsx", "utf8");
  assert(pos.includes("<StockBadge floating") && pos.includes('"pos-oos-badge"'));
  assert(!pos.includes("Out of stock / Stock khatam</span>"));
  const pl = readFileSync("src/app/admin/products/page.tsx", "utf8");
  assert(pl.includes('header: "Stock"') && pl.includes("product-stock-badge"));
  const tt = readFileSync("src/components/ui/theme-toggle.tsx", "utf8");
  assert(tt.includes("startViewTransition") && tt.includes("prefers-reduced-motion"));
});
console.log(`stock-badge: ${n} ok`);
import { stockBadgeText } from "../src/components/ui/stock-badge";
test("badge text", () => {
  assert.equal(stockBadgeText(48, 12), "Stock mein · 48");
  assert.equal(stockBadgeText(3, 6), "Kam reh gaya · 3");
  assert.equal(stockBadgeText(0, 12), "Khatam · 0");
  assert.equal(stockBadgeText(10, null, "kg"), "Stock mein · 10 kg");
});
