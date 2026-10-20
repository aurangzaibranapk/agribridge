import assert from "node:assert/strict";
import fs from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { GodamHint, GodamStrip } from "../src/components/pos/godam-strip";
import {
  aggregateGodamByProduct,
  centralGodams,
  formatGodamQty,
  godamHint,
  type GodamWarehouse,
} from "../src/lib/pos/godam-on-card";

const wh: GodamWarehouse[] = [
  { id: "shop", name: "Mahabali shelf", shop_id: "s1", is_quarantine: false },
  { id: "main", name: "Markaz Godam", shop_id: null, is_quarantine: false },
  { id: "cold", name: "Doosra Godam", shop_id: null, is_quarantine: false },
  { id: "q", name: "Quarantine", shop_id: null, is_quarantine: true },
  { id: "other-shop", name: "Doosri dukan", shop_id: "s2", is_quarantine: false },
];

const central = centralGodams(wh, "shop");
assert.deepEqual(central.map((w) => w.id), ["main", "cold"]);
assert.deepEqual(centralGodams(wh, "main").map((w) => w.id), ["cold"], "dukan ka apna godam kul mein dobara nahi");

const rolled = aggregateGodamByProduct(
  ["dap", "urea", "beej"],
  central,
  [
    { product_id: "dap", warehouse_id: "main", quantity_on_hand: 40 },
    { product_id: "dap", warehouse_id: "main", quantity_on_hand: "50" },
    { product_id: "dap", warehouse_id: "cold", quantity_on_hand: 30 },
    { product_id: "dap", warehouse_id: "shop", quantity_on_hand: 999 },
    { product_id: "dap", warehouse_id: "q", quantity_on_hand: 15 },
    { product_id: "urea", warehouse_id: "cold", quantity_on_hand: -4 },
    { product_id: "urea", warehouse_id: "main", quantity_on_hand: 0 },
    { product_id: "mystery", warehouse_id: "gone", quantity_on_hand: 7 },
  ],
  true
);
assert.equal(rolled.get("dap")?.total, 120);
assert.deepEqual(rolled.get("dap")?.lines, [
  { name: "Markaz Godam", qty: 90 },
  { name: "Doosra Godam", qty: 30 },
]);
assert.equal(rolled.get("urea")?.total, 0);
assert.deepEqual(rolled.get("urea")?.lines, []);
assert.equal(rolled.get("beej")?.total, 0, "dekha, is product ka godam khali");

const unknown = aggregateGodamByProduct(["dap"], central, null, false);
assert.equal(unknown.get("dap")?.total, null);
assert.equal(unknown.get("dap")?.lines, null);

const named = aggregateGodamByProduct(
  ["x"],
  [{ id: "gone", name: "  " }],
  [{ product_id: "x", warehouse_id: "gone", quantity_on_hand: 7 }, { product_id: "x", warehouse_id: "nope", quantity_on_hand: 99 }],
  true
);
assert.deepEqual(named.get("x")?.lines, [{ name: "Godam", qty: 7 }]);
assert.equal(named.get("x")?.total, 7);

assert.equal(godamHint(0, 40, null), "out");
assert.equal(godamHint(4, 86, null), "low");
assert.equal(godamHint(12, 120, null), null);
assert.equal(godamHint(12, 120, 20), "low");
assert.equal(godamHint(25, 10, 20), null);
assert.equal(godamHint(0, 0, null), null);
assert.equal(godamHint(0, null, null), null);
assert.equal(godamHint(4, null, 1), null);
assert.equal(formatGodamQty(null), "—");
assert.equal(formatGodamQty(0), "0");
assert.equal(formatGodamQty(10), "10");
assert.equal(formatGodamQty(1.25), "1.25");

const lines = [
  { name: "Markaz Godam", qty: 90 },
  { name: "Doosra Godam", qty: 30 },
];
const openRm = renderToStaticMarkup(
  <GodamStrip shopQty={48} godamQty={120} lines={lines} lang="rm" defaultOpen />
);
assert.match(openRm, /Dukan/);
assert.match(openRm, /Godam/);
assert.match(openRm, />48</);
assert.match(openRm, />120</);
assert.match(openRm, /Markaz Godam/);
assert.match(openRm, /Doosra Godam/);
assert.match(openRm, /data-testid="pos-godam-lines"/);
assert.match(openRm, /dark:bg-\[#101f42\]\/80/);
assert.match(openRm, /dark:bg-\[#142848\]/);

const closed = renderToStaticMarkup(<GodamStrip shopQty={12} godamQty={null} lines={null} lang="rm" />);
assert.match(closed, /—/);
assert.doesNotMatch(closed, /data-testid="pos-godam-lines"/);
assert.doesNotMatch(closed, />0</);

const en = renderToStaticMarkup(<GodamStrip shopQty={1} godamQty={2} lines={[]} lang="en" defaultOpen />);
assert.match(en, /Shop/);
assert.match(en, /Warehouse/);
assert.match(en, /Warehouse is empty/);

const ur = renderToStaticMarkup(<GodamStrip shopQty={1} godamQty={null} lines={null} lang="ur" defaultOpen />);
assert.match(ur, /دکان/);
assert.match(ur, /گودام/);
assert.match(ur, /پتہ نہیں/);

const hintOut = renderToStaticMarkup(<GodamHint shopQty={0} godamQty={40} minStock={null} lang="rm" />);
assert.match(hintOut, /data-godam-hint="out"/);
assert.match(hintOut, /Dukan khatam/);
assert.match(hintOut, /bg-\[#fff7e6\]/);
assert.match(hintOut, /dark:text-amber-100/);

const hintLow = renderToStaticMarkup(<GodamHint shopQty={4} godamQty={86} minStock={null} lang="en" />);
assert.match(hintLow, /data-godam-hint="low"/);
assert.match(hintLow, /Shop is low/);

const hintNone = renderToStaticMarkup(<GodamHint shopQty={48} godamQty={120} minStock={null} lang="rm" />);
assert.equal(hintNone, "");
const hintUnknown = renderToStaticMarkup(<GodamHint shopQty={0} godamQty={null} minStock={null} lang="rm" />);
assert.equal(hintUnknown, "");

const page = fs.readFileSync("src/app/admin/pos/page.tsx", "utf8");
assert.match(page, /centralGodams/);
assert.match(page, /aggregateGodamByProduct/);
assert.match(page, /warehouse_lines/);
assert.match(page, /select\("id, name, shop_id, is_quarantine"\)/);
assert.match(page, /select\("product_id, warehouse_id, quantity_on_hand"\)/);
assert.doesNotMatch(page, /v_warehouse_product_card/);

const client = fs.readFileSync("src/components/pos/pos-client.tsx", "utf8");
assert.match(client, /<GodamStrip/);
assert.match(client, /<GodamHint/);
assert.match(client, /Out of stock \/ Stock khatam/);
assert.match(client, /canAddToCart\(item\)/);

console.log("PASS: POS dukan|godam — central godam, naam, —, kam/khatam hint");
