/**
 * Portal Product Demand -- qism cards (Karyana / Khaad / Spray / Beej / Wanda / Other).
 * Chalayein: npm run test:portal-demand-categories
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  DEMAND_GROUPS, DEMAND_GROUP_INFO, classifyProducts, countByGroup, demandCategoryFor, demandRowGroup, filterProducts,
  groupForCategory, groupOfDemandCategory, isDemandCategory, normalizeUnit, subsForGroup, DEMAND_CATEGORY_LABELS, DEMAND_CATEGORIES,
} from "../src/lib/demand/categories";
import { parseMunshiCommand } from "../src/lib/demand/munshi-parser";

let ok = 0; const pass = (n: string) => { ok++; console.log(`  ok  ${n}`); };

// live root categories (19 Oct 2026)
assert.equal(groupForCategory("Grocery", "agri"), "karyana");
assert.equal(groupForCategory("Pesticide", "agri"), "pesticide");
assert.equal(groupForCategory("Fertilizer", "agri"), "fertilizer");
assert.equal(groupForCategory("Seeds", "agri"), "seed");
assert.equal(groupForCategory("Animal Feed (Wanda)", "agri"), "feed");
assert.equal(groupForCategory("Raw Grain (Procurement)", "agri"), "hidden");
assert.equal(groupForCategory("Eggs", "karyana"), "karyana");
assert.equal(groupForCategory("Stationery", "karyana"), "karyana");
assert.equal(groupForCategory("Household Items", "karyana"), "karyana");
assert.equal(groupForCategory("Mosquito & Pest Control", "karyana"), "karyana", "pest control != pesticide");
assert.equal(groupForCategory("Dairy Products", "agri"), "other");
assert.equal(groupForCategory("Veterinary Medicines", "agri"), "other");
assert.equal(groupForCategory(null), "other");
pass("root category -> qism (naam pehle, kind sirf karyana fallback)");

const cats = [
  { id: "g", name: "Grocery", parent_category_id: null, category_kind: "agri" },
  { id: "gs", name: "Spices & Masala", parent_category_id: "g", category_kind: "agri" },
  { id: "p", name: "Pesticide", parent_category_id: null },
  { id: "pi", name: "Insecticides", parent_category_id: "p" },
  { id: "pf", name: "Fungicides", parent_category_id: "p" },
  { id: "f", name: "Fertilizer", parent_category_id: null },
  { id: "fm", name: "Micronutrients", parent_category_id: "f" },
  { id: "r", name: "Raw Grain (Procurement)", parent_category_id: null },
  { id: "w", name: "Animal Feed (Wanda)", parent_category_id: null },
  { id: "wc", name: "Cattle/Dairy Feed", parent_category_id: "w" },
];
const prods = [
  { id: "1", name: "Haldhi Powder 50g", pack_size: "50g", category_id: "gs" },
  { id: "2", name: "Imidacloprid 17.8% SL", pack_size: "250ml", category_id: "pi" },
  { id: "3", name: "Impound", pack_size: null, category_id: "p" },
  { id: "4", name: "Alto", pack_size: null, category_id: "pf" },
  { id: "5", name: "Sona Zinc G 3kg", pack_size: "3 KG", category_id: "fm" },
  { id: "6", name: "Wheat (Raw - Procured)", pack_size: null, category_id: "r" },
  { id: "7", name: "Stainless Steel", pack_size: null, category_id: null },
  { id: "8", name: "Dairy Wanda", pack_size: "50kg bag", category_id: "wc" },
  { id: "9", name: "Engro Urea", pack_size: "50 KG", category_id: "f" },
];
const cp = classifyProducts(prods, cats);
assert.equal(cp.find((p) => p.id === "6"), undefined, "Raw Grain farmer se chhupa");
assert.equal(cp.length, 8);
assert.deepEqual(cp.find((p) => p.id === "2"), { ...prods[1], group: "pesticide", sub: "Insecticides" });
assert.equal(cp.find((p) => p.id === "3")!.sub, null, "root par product -> sub null");
assert.equal(cp.find((p) => p.id === "7")!.group, "other");
const counts = countByGroup(cp);
assert.deepEqual(counts, { karyana: 1, fertilizer: 2, pesticide: 3, seed: 0, feed: 1, other: 1 });
pass("classifyProducts: qism + sub-category, Raw Grain hidden, counts");

const spray = filterProducts(cp, "pesticide", null, "");
assert.deepEqual(spray.map((p) => p.name).sort(), ["Alto", "Imidacloprid 17.8% SL", "Impound"]);
assert.ok(!filterProducts(cp, "pesticide", null, "").some((p) => p.name.includes("Haldhi")), "karyana spray list mein nahi");
assert.deepEqual(filterProducts(cp, "pesticide", null, "IMI").map((p) => p.id), ["2"]);
assert.deepEqual(filterProducts(cp, "pesticide", "Fungicides", "").map((p) => p.id), ["4"]);
assert.deepEqual(filterProducts(cp, "karyana", null, "50g").map((p) => p.id), ["1"], "pack size se bhi search");
assert.deepEqual(subsForGroup(cp, "pesticide"), [{ name: "Fungicides", count: 1 }, { name: "Insecticides", count: 1 }]);
pass("picker sirf chuni hui qism dikhata hai, type chip + search");

assert.equal(DEMAND_GROUP_INFO.fertilizer.defaultUnit, "bag");
assert.equal(DEMAND_GROUP_INFO.feed.defaultUnit, "bag");
assert.equal(DEMAND_GROUP_INFO.seed.defaultUnit, "bag");
assert.equal(DEMAND_GROUP_INFO.pesticide.defaultUnit, "bottle");
assert.equal(DEMAND_GROUP_INFO.karyana.defaultUnit, "packet");
assert.equal(DEMAND_GROUP_INFO.other.defaultUnit, "piece");
for (const g of DEMAND_GROUPS) {
  const i = DEMAND_GROUP_INFO[g];
  assert.ok(i.en && i.rm && i.ur, `${g} teen zabanen`);
  assert.ok(i.units.includes(i.defaultUnit), `${g} default unit chips mein`);
  assert.ok(isDemandCategory(i.defaultCategory));
}
assert.equal(normalizeUnit("Bags (bags)", "fertilizer"), "bag");
assert.equal(normalizeUnit("Litre (ltr)", "karyana"), "liter");
assert.equal(normalizeUnit("Millilitre (ml)", "pesticide"), "ml");
assert.equal(normalizeUnit("Kilogram (kg)", "pesticide"), "kg");
assert.equal(normalizeUnit(null, "pesticide"), "bottle");
assert.equal(normalizeUnit("Meter (m)", "karyana"), "packet");
pass("default units per qism + product unit normalise");

assert.equal(demandCategoryFor("karyana"), "karyana");
assert.equal(demandCategoryFor("other"), "other");
assert.equal(demandCategoryFor("fertilizer", "Micronutrients"), "micronutrient");
assert.equal(demandCategoryFor("fertilizer", "Phosphate (DAP/SSP)"), "fertilizer");
assert.equal(demandCategoryFor("feed", null, "khal"), "khal");
assert.equal(demandCategoryFor("feed", null, "bogus"), "wanda");
assert.equal(groupOfDemandCategory("khal"), "feed");
assert.equal(groupOfDemandCategory("micronutrient"), "fertilizer");
assert.equal(groupOfDemandCategory("karyana"), "karyana");
assert.equal(groupOfDemandCategory(null), null);
const pg = new Map([["2", "pesticide" as const]]);
assert.equal(demandRowGroup({ category: "seed", product_id: "2" }, pg), "seed", "saved category pehle");
assert.equal(demandRowGroup({ category: null, product_id: "2" }, pg), "pesticide", "purani demand: product ki qism");
assert.equal(demandRowGroup({ category: null, product_id: null }, pg), "other");
pass("apna product + saved category <-> qism, Meri demands grouping");

assert.ok(isDemandCategory("karyana") && isDemandCategory("other"));
for (const c of DEMAND_CATEGORIES) assert.ok(DEMAND_CATEGORY_LABELS[c].rm && DEMAND_CATEGORY_LABELS[c].ur, c);
assert.equal(parseMunshiCommand("mujhe 5 packet ghee chahiye").category, "karyana");
assert.equal(parseMunshiCommand("20 boriyan urea").category, "fertilizer");
pass("karyana/other valid categories; Munshi ghee -> karyana, urea -> fertilizer");

// wiring
const client = fs.readFileSync("src/app/portal/demand/demand-client.tsx", "utf8");
assert.ok(!client.includes("Qism (category)"), "purana Qism dropdown hata diya");
assert.ok(!client.includes("Product list se select karein"), "purani mixed list hata di");
assert.ok(client.includes("STEP 1 · QISM CHUNEIN") && client.includes("data-testid=\"product-list\""));
assert.ok(client.includes("dark:bg-[#101d36]"), "navy dark theme");
const page = fs.readFileSync("src/app/portal/demand/page.tsx", "utf8");
assert.ok(page.includes("classifyProducts") && page.includes("category_id"));
const api = fs.readFileSync("src/app/api/farmer-demand/route.ts", "utf8");
assert.ok(api.includes("23514") && api.includes("PRE_604_CATEGORIES"), "604 live na ho to bhi demand save");
pass("wiring: page/client/api");

console.log(`\n${ok} checks passed`);
