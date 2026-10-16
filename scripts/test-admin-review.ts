/** Admin review 2026-10-16 regression tests.  npm run test:admin-review */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pickTopBranch, paymentSplit } from "../src/lib/utils/daily-briefing-summary";

let n = 0;
function test(name: string, fn: () => void) { fn(); n++; console.log(`ok  ${name}`); }

test("top branch from report array (no NaN)", () => {
  assert.deepEqual(pickTopBranch([{ branch: "Sial", sales: 230 }, { branch: "HQ", sales: 10 }]), { name: "Sial", total: 230 });
  assert.equal(pickTopBranch([]), null);
  assert.equal(pickTopBranch(undefined), null);
  assert.deepEqual(pickTopBranch({ branch_name: "X", total: "50" }), { name: "X", total: 50 });
  assert.deepEqual(pickTopBranch([{ branch: "Y", sales: "abc" }]), { name: "Y", total: 0 });
});
test("payment split maps POS modes", () => {
  assert.deepEqual(paymentSplit({ cash: 100, khata: 30, bank: 20, kisan_card: 5, split: 7 }), { cash: 100, online: 25, credit: 30 });
  assert.deepEqual(paymentSplit(null), { cash: 0, online: 0, credit: 0 });
});
test("costing links go to existing product edit route", () => {
  const src = readFileSync("src/app/admin/finance/costing/page.tsx", "utf8");
  assert.ok(!/href=\{`\/admin\/products\/\$\{r\.id\}`\}/.test(src));
  assert.ok(src.includes("/admin/products/${r.id}/edit"));
});
test("daily briefing no longer reads old report keys", () => {
  const src = readFileSync("src/app/admin/bridge-ai/daily-briefing/page.tsx", "utf8");
  assert.ok(!src.includes("top_branch.total") && !src.includes("top_branch?.branch_name"));
  assert.ok(!src.includes("payment_mode_breakdown?.online"));
});
test("cash handover slip formats in fixed zone/locale (no hydration mismatch)", () => {
  const src = readFileSync("src/app/admin/cash-handover/slip/[id]/slip-client.tsx", "utf8");
  assert.equal((src.match(/timeZone: "Asia\/Karachi"/g) ?? []).length, 2);
  assert.ok(!src.includes("toLocaleString()"));
});
console.log(`\n${n} tests passed`);
