import assert from "node:assert/strict";
import { effectiveChecked, rowsFromChecks, splitTree } from "../src/lib/shops/allowed-categories";

const cats = [
  { id: "g", name: "Grocery", parent_category_id: null },
  { id: "r", name: "Rice & Grains", parent_category_id: "g" },
  { id: "b", name: "Beverages", parent_category_id: "g" },
  { id: "v", name: "Veterinary Medicines", parent_category_id: null },
];
const { tops, subsOf } = splitTree(cats);
assert.deepEqual(tops.map((t) => t.id), ["g", "v"]);
assert.deepEqual((subsOf.get("g") ?? []).map((s) => s.id), ["b", "r"]);

// Top on -> subs auto; sirf ek row.
assert.deepEqual(rowsFromChecks(cats, new Set(["g"]), new Set(["r", "b"])), [{ category_id: "g", include: true }]);
// Rice hataya -> exclude override.
assert.deepEqual(rowsFromChecks(cats, new Set(["g"]), new Set(["b"])), [
  { category_id: "g", include: true },
  { category_id: "r", include: false },
]);
// Parent nahi, sirf Rice -> include override.
assert.deepEqual(rowsFromChecks(cats, new Set(), new Set(["r"])), [{ category_id: "r", include: true }]);
// Kuch nahi = khaali list (sab dikhe).
assert.deepEqual(rowsFromChecks(cats, new Set(), new Set()), []);

const eff = effectiveChecked(cats, [{ category_id: "g", include: true }, { category_id: "r", include: false }]);
assert.deepEqual([...eff].sort(), ["b", "g"]);
// Round trip.
const back = rowsFromChecks(cats, new Set([...eff].filter((id) => id === "g" || id === "v")), new Set([...eff].filter((id) => id === "r" || id === "b")));
assert.deepEqual(back, [{ category_id: "g", include: true }, { category_id: "r", include: false }]);
console.log("shop-allowed-categories-lib: theek");
