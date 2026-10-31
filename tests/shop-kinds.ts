/** Karyana ordering: Eggs jar shamil, urea/poultry bahar. DB ke baghair. */
import assert from "node:assert/strict";
import { categoriesForShop, categoryChipsForShop, type CatNode } from "../src/lib/products/shop-kinds";

let n = 0;
const test = (name: string, fn: () => void) => {
  fn();
  n += 1;
  console.log("ok", name);
};

const cats: CatNode[] = [
  { id: "g", name: "Grocery", parent_category_id: null },
  { id: "bev", name: "Beverages & Cold Drinks", parent_category_id: "g" },
  { id: "rice", name: "Rice & Grains", parent_category_id: "g" },
  { id: "eggs", name: "Eggs", parent_category_id: null },
  { id: "dairy", name: "Dairy Products", parent_category_id: null },
  { id: "fert", name: "Fertilizer", parent_category_id: null },
  { id: "urea", name: "Nitrogen (Urea)", parent_category_id: "fert" },
  { id: "feed", name: "Animal Feed (Wanda)", parent_category_id: null },
  { id: "poultry", name: "Poultry Feed", parent_category_id: "feed" },
  { id: "pest", name: "Pesticide", parent_category_id: null },
  { id: "insect", name: "Insecticides", parent_category_id: "pest" },
];

const products = [
  { id: "egg", name: "Egg", category_id: "eggs" },
  { id: "cola", name: "Cola", category_id: "bev" },
  { id: "urea", name: "Urea", category_id: "urea" },
  { id: "poultry", name: "Poultry feed bag", category_id: "poultry" },
];

function names(ids: Set<string> | null): string[] {
  return cats.filter((c) => ids?.has(c.id)).map((c) => c.name).sort();
}

function search(businessType: string, q: string): string[] {
  const allowed = categoriesForShop(businessType, cats);
  assert.ok(allowed, businessType);
  const needle = q.toLowerCase();
  return products
    .filter((p) => allowed.has(p.category_id) && p.name.toLowerCase().includes(needle))
    .map((p) => p.name)
    .sort();
}

test("karyana includes Eggs root plus Grocery children, not agri", () => {
  assert.deepEqual(names(categoriesForShop("karyana", cats)), [
    "Beverages & Cold Drinks",
    "Dairy Products",
    "Eggs",
    "Grocery",
    "Rice & Grains",
  ]);
});

test("search egg on karyana finds Egg; urea and poultry stay hidden", () => {
  assert.deepEqual(search("karyana", "egg"), ["Egg"]);
  assert.deepEqual(search("karyana", "urea"), []);
  assert.deepEqual(search("karyana", "poultry"), []);
});

test("agri_inputs still has urea and poultry, and does not leak Eggs or Grocery", () => {
  const agri = names(categoriesForShop("agri_inputs", cats));
  assert.ok(agri.includes("Nitrogen (Urea)"));
  assert.ok(agri.includes("Poultry Feed"));
  assert.ok(!agri.includes("Eggs"));
  assert.ok(!agri.includes("Grocery"));
  assert.ok(!agri.includes("Egg"));
  assert.deepEqual(search("agri_inputs", "egg"), []);
  assert.deepEqual(search("agri_inputs", "urea"), ["Urea"]);
  assert.deepEqual(search("agri_inputs", "poultry"), ["Poultry feed bag"]);
});

test("dairy shop stays milk only — Eggs are karyana", () => {
  assert.deepEqual(names(categoriesForShop("dairy", cats)), ["Dairy Products"]);
});

test("Eggs chip shows; Grocery umbrella and empty Dairy Products do not", () => {
  const allowed = categoriesForShop("karyana", cats);
  assert.ok(allowed);
  const chips = categoryChipsForShop(
    allowed,
    cats,
    products.filter((p) => allowed.has(p.category_id)).map((p) => p.category_id)
  ).map((c) => c.name);
  assert.deepEqual(chips, ["Beverages & Cold Drinks", "Rice & Grains", "Eggs"]);
});

test("unknown shop kind stays open (null), not an empty list", () => {
  assert.equal(categoriesForShop(null, cats), null);
  assert.equal(categoriesForShop("machinery_fleet", cats), null);
});

console.log(`shop-kinds: ${n} ok`);
