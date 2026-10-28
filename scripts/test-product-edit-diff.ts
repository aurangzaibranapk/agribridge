/** Product tabdeeli pehle-vs-baad + merge panel.  npm run test:product-edit-diff */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildMergePanel, diffProductEdit, isSelfMerge, looksLikeInstruction, mergeChip, sameValue } from "../src/lib/pending/product-diff";
import { attachProductExtras, productDetailHref } from "../src/lib/pending/product-attach";
import { adminPendingDict } from "../src/lib/i18n/dict/admin-pending";

let n = 0;
const test = (name: string, fn: () => void) => { fn(); n++; console.log("ok", name); };

const prod = { name: "chicken tikka", pack_size: "50g", selling_price: "120.00", updated_at: "2026-09-01T00:00:00Z" };

test("rename: only name differs, live before", () => {
  const d = diffProductEdit({ changes: { name: "Chicken Tikka 50g", pack_size: "50g", selling_price: 120, sale_rate_pending: false }, created_at: "2026-09-14T17:21:34Z" }, prod);
  assert.equal(d.oldName, "chicken tikka");
  assert.equal(d.newName, "Chicken Tikka 50g");
  assert.deepEqual(d.changes.map((c) => c.key), ["name"]);
  assert.equal(d.unchangedCount, 2);
  assert.equal(d.beforeSource, "live");
  assert.deepEqual(d.flags, []);
});

test("original wins over live (693)", () => {
  const d = diffProductEdit({ changes: { name: "B", selling_price: 200 }, original: { name: "A", selling_price: 150 }, created_at: "2026-10-21T00:00:00Z" }, { name: "A2", selling_price: 999 });
  assert.equal(d.oldName, "A");
  assert.deepEqual(d.changes.find((c) => c.key === "selling_price"), { key: "selling_price", label: "ped_f_selling_price", before: 150, after: 200 });
  assert.equal(d.beforeSource, "original");
});

test("flags: changed_since, no_change, instruction, merged", () => {
  assert.ok(diffProductEdit({ changes: { name: "Kala Chana 250" }, created_at: "2026-09-14T00:00:00Z" }, { name: "Black chana 250", updated_at: "2026-10-01T00:00:00Z" }).flags.includes("changed_since"));
  assert.deepEqual(diffProductEdit({ changes: { name: "Sabut Masoor 250g", pack_size: "" }, created_at: "2026-09-14T00:00:00Z" }, { name: "Sabut Masoor 250g", pack_size: null }).flags, ["no_change"]);
  assert.ok(diffProductEdit({ changes: { name: "ye khatm krin" }, created_at: "x" }, { name: "dhaniya powder 100" }).flags.includes("instruction_name"));
  assert.ok(diffProductEdit({ changes: { name: "Dhania 250g" }, created_at: "x" }, { name: "[MERGED] Dhania 250g" }).flags.includes("merged_target"));
  assert.equal(looksLikeInstruction("Kali Mirch Powder 50g"), false);
  assert.equal(looksLikeInstruction("ye bhi khatam krin"), true);
});

test("sameValue normalisation", () => {
  assert.ok(sameValue("selling_price", "150.00", 150));
  assert.ok(sameValue("barcode", "", null));
  assert.ok(sameValue("show_expiry_to_customer", false, null));
  assert.ok(!sameValue("name", "a", "b"));
});

test("resolver turns ids into names", () => {
  const d = diffProductEdit({ changes: { category_id: "c2" }, created_at: "x" }, { name: "P", category_id: "c1" }, (k, v) => (k === "category_id" ? { c1: "Masala", c2: "Daal" }[v as string] : v));
  assert.deepEqual([d.changes[0].before, d.changes[0].after], ["Masala", "Daal"]);
});

test("merge panel: knorschick -> Knore (1 + 6 = 7, rate warn)", () => {
  const p = buildMergePanel(
    { id: "s", name: "knorschick", rate: "200.00", stock: [{ warehouse: "Mahabali", qty: 1 }] },
    { id: "t", name: "Knore Chicken Nodle", rate: "50.00", stock: [{ warehouse: "HQ", qty: 4 }, { warehouse: "Mahabali", qty: 2 }] },
    [],
  );
  assert.deepEqual(p.totals, { now: 6, incoming: 1, after: 7 });
  assert.deepEqual(p.rows.find((r) => r.warehouse === "Mahabali"), { warehouse: "Mahabali", now: 2, incoming: 1, after: 3 });
  assert.equal(mergeChip(p), "1 + 6 = 7");
  assert.ok(p.flags.includes("rate_diff"));
  assert.ok(p.flags.includes("snapshot_diff"));
});

test("self merge: blocked, no double stock", () => {
  const st = [{ warehouse: "HQ", qty: 48 }, { warehouse: "Mahabali", qty: 34 }];
  const p = buildMergePanel({ id: "x", name: "Sprite Mint 1 Le", rate: 160, stock: st }, { id: "x", name: "Sprite Mint 1 Le", rate: 160, stock: st });
  assert.deepEqual(p.flags, ["self_merge"]);
  assert.equal(p.totals.after, 82);
  assert.ok(isSelfMerge("a", "a") && !isSelfMerge("a", "b"));
  const [it] = attachProductExtras([{ category: "product_merge", item_id: "m1" } as never], new Map([["m1", p]]));
  assert.equal(it.block_approve, true);
  assert.equal(it.link, "/admin/my-work/pending/product/merge/m1");
});

test("same warehouse lines are summed; other categories untouched", () => {
  const p = buildMergePanel({ id: "s", name: "S", rate: 1, stock: [{ warehouse: "A", qty: 1 }, { warehouse: "A", qty: 2 }] }, { id: "t", name: "T", rate: 1, stock: [] });
  assert.equal(p.source.total, 3);
  assert.equal(productDetailHref("purchases", "z"), null);
  const [it] = attachProductExtras([{ category: "purchases", item_id: "z", link: null } as never], new Map());
  assert.equal(it.link, null);
});

test("i18n: every ped_ key has en/rm/ur and every label key exists", () => {
  const d = adminPendingDict as Record<string, { en: string; rm: string; ur: string }>;
  const src = readFileSync("src/components/pending/product-diff-ui.tsx", "utf8") + readFileSync("src/lib/pending/product-diff.ts", "utf8") + readFileSync("src/app/admin/my-work/pending/product/[kind]/[id]/page.tsx", "utf8");
  const used = new Set([...src.matchAll(/"(ped_[a-z_]+)"/g)].map((m) => m[1]));
  for (const f of ["changed_since", "no_change", "instruction_name", "merged_target", "self_merge", "rate_diff", "snapshot_diff"]) used.add(`ped_flag_${f}`);
  for (const k of used) { assert.ok(d[k], `missing ${k}`); assert.ok(d[k].en && d[k].rm && d[k].ur, k); }
});

test("migration 693 is additive, has rollback, NOT VALID guard", () => {
  const m = readFileSync("supabase/migrations/693_product_edit_original.sql", "utf8").toLowerCase();
  assert.ok(m.includes("add column if not exists original jsonb"));
  assert.ok(m.includes("not valid"));
  assert.ok(!/\bdrop\b|\bdelete\b|\bupdate\b/.test(m.replace(/--.*$/gm, "")));
  assert.ok(readFileSync("supabase/migrations/693_product_edit_original.rollback.sql", "utf8").includes("drop column if exists original"));
  const a = readFileSync("src/actions/product-merge.ts", "utf8");
  assert.equal((a.match(/isSelfMerge\(/g) ?? []).length, 2);
  assert.equal((readFileSync("src/actions/products.ts", "utf8").match(/await snapshotOriginal\(supabase/g) ?? []).length, 2);
});

console.log(`\n${n} tests passed`);
