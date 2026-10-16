// ERP ka Naqsha sync guard: har admin page naqshe mein ho ya ERP_HIDDEN_ROUTES mein,
// har sidebar item naqshe mein ho, aur naqshe ka har link asli page ho.
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { ERP_FEATURES } from "../src/lib/erp-directory";
import { ERP_HIDDEN_ROUTES } from "../src/lib/erp-directory-hidden";
import { ADMIN_NAV_GROUPS } from "../src/components/layout/nav-items";

const root = path.join(process.cwd(), "src/app");
function pages(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) pages(p, out);
    else if (e.name === "page.tsx") out.push("/" + path.relative(root, dir).split(path.sep).join("/"));
  }
  return out;
}
const all = pages(path.join(root, "admin")).filter((r) => !r.includes("["));
const base = (h: string) => h.split("?")[0];
const listed = new Set(ERP_FEATURES.map((f) => base(f.href)));
const hidden = new Set(ERP_HIDDEN_ROUTES);

const missing = all.filter((r) => !listed.has(r) && !hidden.has(r));
assert.deepStrictEqual(missing, [], "Naya admin page ERP ka Naqsha mein nahi (src/lib/erp-directory.ts mein jodein ya erp-directory-hidden.ts mein): " + missing.join(", "));

for (const g of ADMIN_NAV_GROUPS) for (const it of g.items) assert(listed.has(base(it.href)), "sidebar item missing: " + it.href);

const pageSet = new Set(all);
for (const f of ERP_FEATURES) assert(pageSet.has(base(f.href)), "naqshe ka link page nahi: " + f.href);
for (const h of hidden) assert(pageSet.has(h), "hidden list mein purana route: " + h);
for (const h of hidden) assert(!listed.has(h), "route dono jagah: " + h);

const dup = ERP_FEATURES.map((f) => f.href).filter((h, i, a) => a.indexOf(h) !== i);
assert.deepStrictEqual(dup, [], "duplicate: " + dup.join(", "));

for (const r of ["/admin/settings/credit-policy", "/admin/receivable-reminders/overrides", "/admin/support-center/departments", "/admin/farmer-signups", "/admin/my-home", "/admin/portal"])
  assert(listed.has(r), "zaroori naya feature missing: " + r);

console.log(`erp-directory: ok (${ERP_FEATURES.length} features, ${hidden.size} hidden)`);
