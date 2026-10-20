import assert from "node:assert/strict";
import fs from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { GodamHint, GodamStrip } from "../src/components/pos/godam-strip";
import {
  aggregateGodamByProduct,
  chunkIds,
  formatGodamQty,
  godamHint,
  linkableGodams,
  linkedGodamStock,
  pickLinkedGodams,
  type GodamWarehouse,
} from "../src/lib/pos/godam-on-card";

const wh: GodamWarehouse[] = [
  { id: "shop", name: "Mahabali shelf", shop_id: "s1", is_quarantine: false, is_active: true },
  { id: "main", name: "Markaz Godam", shop_id: null, is_quarantine: false, is_active: true },
  { id: "cold", name: "Doosra Godam", shop_id: null, is_quarantine: false, is_active: true },
  { id: "q", name: "Quarantine", shop_id: null, is_quarantine: true, is_active: true },
  { id: "off", name: "Band Godam", shop_id: null, is_quarantine: false, is_active: false },
  { id: "other-shop", name: "Doosri dukan", shop_id: "s2", is_quarantine: false, is_active: true },
];

assert.deepEqual(linkableGodams(wh).map((w) => w.id), ["main", "cold"]);

const shelf = pickLinkedGodams(wh, ["shop"]);
assert.equal(shelf.ok, false);
const quarantine = pickLinkedGodams(wh, ["q"]);
assert.equal(quarantine.ok, false);
const inactive = pickLinkedGodams(wh, ["off"]);
assert.equal(inactive.ok, false);
const unknown = pickLinkedGodams(wh, ["gone"]);
assert.equal(unknown.ok, false);
const unlink = pickLinkedGodams(wh, []);
assert.deepEqual(unlink, { ok: true, ids: [] });
const picked = pickLinkedGodams(wh, ["main", "main", "cold"]);
assert.deepEqual(picked, { ok: true, ids: ["main", "cold"] });

assert.deepEqual(chunkIds(["a", "b", "c", "d", "e"], 2), [["a", "b"], ["c", "d"], ["e"]]);

const base = {
  shopId: "s1" as string | null,
  linksOk: true,
  linkedWarehouseIds: ["main"],
  stockOk: true,
  productIds: ["dap", "urea", "beej"],
  rows: [
    { product_id: "dap", warehouse_id: "main", warehouse_name: "Markaz Godam", quantity_on_hand: 40 },
    { product_id: "dap", warehouse_id: "main", warehouse_name: "Markaz Godam", quantity_on_hand: "50" },
    { product_id: "dap", warehouse_id: "cold", warehouse_name: "Doosra Godam", quantity_on_hand: 30 },
    { product_id: "dap", warehouse_id: "shop", warehouse_name: "Shelf", quantity_on_hand: 999 },
    { product_id: "dap", warehouse_id: "q", warehouse_name: "Quarantine", quantity_on_hand: 15 },
    { product_id: "urea", warehouse_id: "main", warehouse_name: "Markaz Godam", quantity_on_hand: 0 },
  ],
};

const onlyLinked = linkedGodamStock(base);
assert.equal(onlyLinked?.get("dap")?.total, 90);
assert.deepEqual(onlyLinked?.get("dap")?.lines, [{ name: "Markaz Godam", qty: 90 }]);
assert.equal(onlyLinked?.get("urea")?.total, 0, "juda godam dekh liya, khali");
assert.deepEqual(onlyLinked?.get("urea")?.lines, []);
assert.equal(onlyLinked?.get("beej")?.total, 0);

assert.equal(linkedGodamStock({ ...base, shopId: null }), null);
assert.equal(linkedGodamStock({ ...base, linksOk: false }), null);
assert.equal(linkedGodamStock({ ...base, stockOk: false }), null);
assert.equal(linkedGodamStock({ ...base, linkedWarehouseIds: [] }), null, "link na ho to —, sifar nahi");

const both = linkedGodamStock({
  ...base,
  linkedWarehouseIds: ["main", "cold"],
});
assert.equal(both?.get("dap")?.total, 120);
assert.deepEqual(both?.get("dap")?.lines, [
  { name: "Markaz Godam", qty: 90 },
  { name: "Doosra Godam", qty: 30 },
]);

const named = aggregateGodamByProduct(
  ["x"],
  [{ id: "gone", name: "  " }],
  [{ product_id: "x", warehouse_id: "gone", quantity_on_hand: 7 }, { product_id: "x", warehouse_id: "nope", quantity_on_hand: 99 }],
  true
);
assert.deepEqual(named.get("x")?.lines, [{ name: "Godam", qty: 7 }]);
assert.equal(aggregateGodamByProduct(["x"], [{ id: "gone", name: "Godam" }], null, false).get("x")?.total, null);

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
assert.match(page, /fn_shop_linked_godam_stock/);
assert.match(page, /shop_godams/);
assert.match(page, /shopId = profile\.shop_id/);
assert.match(page, /linkedGodamStock/);
assert.match(page, /warehouse_lines/);
assert.doesNotMatch(page, /centralGodams/);
assert.doesNotMatch(page, /select\("id, name, shop_id, is_quarantine"\)/);
assert.doesNotMatch(page, /v_warehouse_product_card/);

const lib = fs.readFileSync("src/lib/pos/godam-on-card.ts", "utf8");
assert.doesNotMatch(lib, /function centralGodams|export function centralGodams/);

const action = fs.readFileSync("src/actions/shop-godams.ts", "utf8");
assert.match(action, /Sirf Admin godam jod sakta hai/);
assert.match(action, /pickLinkedGodams/);
assert.match(action, /from\("shop_godams"\)/);
assert.doesNotMatch(action, /createServiceClient/);

const mig = fs.readFileSync("supabase/migrations/675_shop_godams.sql", "utf8");
assert.match(mig, /create table if not exists public\.shop_godams/);
assert.match(mig, /fn_shop_linked_godam_stock/);
assert.doesNotMatch(mig, /\bdelete\s+from\b|\btruncate\b/i);
assert.equal(fs.existsSync("supabase/migrations/670_shop_godams.sql"), false);
const hq = fs.readFileSync("supabase/migrations/676_shop_hq_godam_default.sql", "utf8");
assert.match(hq, /fn_hq_godam_id/);
assert.match(hq, /trg_shop_link_hq_godam/);
assert.match(hq, /on conflict \(shop_id, warehouse_id\) do nothing/i);
assert.match(hq, /raise notice/i);
assert.match(hq, /s\.is_active/);
assert.doesNotMatch(hq, /\bdelete\s+from\b|\btruncate\b/i);
assert.match(fs.readFileSync("src/actions/shops.ts", "utf8"), /676/);

const client = fs.readFileSync("src/components/pos/pos-client.tsx", "utf8");
assert.match(client, /<GodamStrip/);
assert.match(client, /<GodamHint/);
assert.match(client, /Out of stock \/ Stock khatam/);
assert.match(client, /canAddToCart\(item\)/);

console.log("PASS: POS dukan|godam — sirf juda godam, link na ho to —");
