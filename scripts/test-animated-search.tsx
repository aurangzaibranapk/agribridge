/* Animated search -- unit + flag-off parity + keyboard + a11y (koi DB nahi). */
import assert from "node:assert/strict";
import fs from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as A from "../src/lib/ui/animated-search";
import { AnimatedSearch } from "../src/components/ui/animated-search";

let n = 0;
const t = (name: string, f: () => void) => { f(); n++; console.log("ok -", name); };

t("flag default off, only exact '1' turns on", () => {
  assert.equal(A.animSearchEnabled({}), false);
  assert.equal(A.animSearchEnabled({ NEXT_PUBLIC_ANIM_SEARCH: "0" }), false);
  assert.equal(A.animSearchEnabled({ NEXT_PUBLIC_ANIM_SEARCH: "true" }), false);
  assert.equal(A.animSearchEnabled({ NEXT_PUBLIC_ANIM_SEARCH: "1" }), true);
});
t("shortcuts: Ctrl/Cmd+K always, '/' only outside fields", () => {
  assert.ok(A.isOpenShortcut({ key: "k", ctrlKey: true }, true));
  assert.ok(A.isOpenShortcut({ key: "K", metaKey: true }, false));
  assert.ok(A.isOpenShortcut({ key: "/" }, false));
  assert.ok(!A.isOpenShortcut({ key: "/" }, true));
  assert.ok(!A.isOpenShortcut({ key: "k" }, false));
  assert.ok(!A.isOpenShortcut({ key: "k", ctrlKey: true, altKey: true }, false));
});
t("arrow navigation wraps", () => {
  assert.equal(A.nextActive(-1, 3, "ArrowDown"), 0);
  assert.equal(A.nextActive(2, 3, "ArrowDown"), 0);
  assert.equal(A.nextActive(0, 3, "ArrowUp"), 2);
  assert.equal(A.nextActive(-1, 3, "ArrowUp"), 2);
  assert.equal(A.nextActive(1, 0, "ArrowDown"), -1);
  assert.equal(A.nextActive(1, 3, "Enter"), 1);
});
t("dictation only merges text", () => {
  assert.equal(A.mergeDictation("", " urea "), "urea");
  assert.equal(A.mergeDictation("dap ", "50 kg"), "dap 50 kg");
  assert.equal(A.mergeDictation("abc", "  "), "abc");
});
t("placeholders + labels in EN/Roman/Urdu; speech lang", () => {
  assert.equal(A.DEFAULT_PLACEHOLDER.ur, "تلاش کریں…");
  assert.equal(A.DEFAULT_PLACEHOLDER.rm, "Talash karein…");
  for (const l of ["en", "rm", "ur"] as const) for (const k of Object.values(A.LABELS[l])) assert.ok(k.length > 0);
  assert.equal(A.speechLang("ur"), "ur-PK");
});
t("animation spec 450ms cubic-bezier", () => { assert.equal(A.EXPAND_MS, 450); assert.equal(A.EASING, "cubic-bezier(.65,0,.35,1)"); });
t("groupResults keeps order + index", () => {
  const g = A.groupResults([{ id: "1", label: "a", group: "P" }, { id: "2", label: "b", group: "F" }, { id: "3", label: "c", group: "P" }]);
  assert.deepEqual(g.map((x) => x.group), ["P", "F"]);
  assert.deepEqual(g[0].items.map((i) => i.index), [0, 2]);
});

const html = (p: React.ComponentProps<typeof AnimatedSearch>) => renderToStaticMarkup(<AnimatedSearch {...p} />);
t("collapsed render: a11y button + combobox, hidden listbox", () => {
  const h = html({ lang: "en" });
  assert.match(h, /aria-label="Open search"/);
  assert.match(h, /role="combobox"/);
  assert.match(h, /aria-expanded="false"/);
  assert.match(h, /role="listbox"[^>]*hidden/);
  assert.match(h, /data-open="0"/);
  assert.match(h, /tabindex="-1"/);
});
t("defaultOpen render: close label, width 100%", () => {
  const h = html({ lang: "rm", defaultOpen: true });
  assert.match(h, /aria-label="Search band karein"/);
  assert.match(h, /data-open="1"/);
  assert.match(h, /width:100%/);
  assert.match(h, /placeholder="Talash karein…"/);
});
t("Urdu is RTL with Urdu placeholder", () => {
  const h = html({ lang: "ur" });
  assert.match(h, /dir="rtl"/);
  assert.match(h, /placeholder="تلاش کریں…"/);
});
t("passes name/id/type through (forms keep working)", () => {
  const h = html({ lang: "en", inputProps: { name: "q", type: "search", id: "inventory-product-search" }, defaultValue: "urea" });
  assert.match(h, /name="q"/); assert.match(h, /id="inventory-product-search"/); assert.match(h, /value="urea"/);
  assert.match(h, /data-open="1"/); // value present -> open
});
t("results render as options grouped", () => {
  const h = html({ lang: "en", defaultOpen: true, results: [{ id: "1", label: "Urea", group: "Products" }] });
  assert.match(h, /role="option"/); assert.match(h, />Products</); assert.doesNotMatch(h, /role="listbox"[^>]*hidden/);
});
t("source: mic never submits; reduced motion handled; Esc closes", () => {
  const src = fs.readFileSync("src/components/ui/animated-search.tsx", "utf8");
  const mic = src.slice(src.indexOf("function toggleMic"), src.indexOf("const dur"));
  assert.doesNotMatch(mic, /submit|requestSubmit|onSelect|router|fetch/);
  assert.match(src, /prefers-reduced-motion/);
  assert.match(src, /e\.key === "Escape"/);
});
t("flag-off parity: every wired spot keeps the original JSX in the else branch", () => {
  const spots: Array<[string, string[]]> = [
    ["src/components/layout/topbar.tsx", ['name="q"', "placeholder={searchPlaceholder}", "Apply"]],
    ["src/components/pos/pos-client.tsx", ['<Input ref={barcodeRef} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("pos_search_products", lang)} className="h-11 pl-9" />']],
    ["src/components/khata/khata-client.tsx", ['placeholder={t("sh_search_customer", lang)}']],
    ["src/app/admin/inventory/inventory-client.tsx", ['id="inventory-product-search"']],
    ["src/app/admin/products/product-search-box.tsx", ["onChange={(e) => setValue(e.target.value)}"]],
    ["src/app/admin/crm/crm-client.tsx", ["onChange={(e) => setCustomerSearchDraft(e.target.value)}", "onChange={(e) => setSupplierSearchDraft(e.target.value)}", "onChange={(e) => setFarmerSearchDraft(e.target.value)}"]],
  ];
  for (const [f, needles] of spots) {
    const s = fs.readFileSync(f, "utf8");
    assert.ok(/animSearchEnabled\(\) \?/.test(s), f + " not flag-gated");
    const elseBranch = s.slice(s.indexOf("animSearchEnabled() ?"));
    for (const nd of needles) assert.ok(elseBranch.includes(nd), `${f} missing original: ${nd}`);
  }
});
console.log(`\n${n} tests passed`);
