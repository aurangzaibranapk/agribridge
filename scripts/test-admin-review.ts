/** Admin review 2026-10-16 regression tests.  npm run test:admin-review */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pickTopBranch, paymentSplit } from "../src/lib/utils/daily-briefing-summary";
import { pathAllowed } from "../src/lib/access/route-match";
import { canRecordHandoverReceipt } from "../src/lib/ledger/handover";

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
  assert.ok(src.includes("handover-slip-embed"));
});
test("POS close opens the shift bill immediately for print and WhatsApp, including when cash handover is due", () => {
  const bar = readFileSync("src/components/pos/shift-bar.tsx", "utf8");
  assert.ok(bar.includes("cashHandoverDue"));
  assert.ok(!bar.includes("!cashHandoverDue"), "counted cash must not hide the closing bill");
  assert.ok(bar.includes("if (state.success && state.shiftId) setReceiptOpen(true)"));
  assert.ok(bar.includes("shareCloseWhatsApp"));
  assert.ok(bar.includes("Cash bhejein"));
  assert.ok(bar.includes("Closing bill — Print / WhatsApp"));
  assert.ok(bar.includes("?embed=1&print=1"));
  assert.ok(bar.includes('name="shift_id"'));
  const action = readFileSync("src/actions/cash-handover.ts", "utf8");
  assert.ok(action.includes("shift_id: recordShiftId"));
  assert.ok(action.includes("shiftIdsFieldPresent"));
  const slip = readFileSync("src/app/admin/cash-handover/slip/[id]/page.tsx", "utf8");
  assert.ok(slip.includes("h.shift_id"));
  const handoverUi = readFileSync("src/app/admin/cash-handover/slip/[id]/slip-client.tsx", "utf8");
  assert.ok(handoverUi.includes("https://wa.me/"));
  const daily = readFileSync("src/app/admin/pos/shift/[shiftId]/slip/page.tsx", "utf8");
  assert.ok(daily.includes("/admin/cash-handover/slip/"));
  assert.ok(daily.includes("shareText"));
  const printBtn = readFileSync("src/app/admin/pos/shift/[shiftId]/slip/print-button.tsx", "utf8");
  assert.ok(printBtn.includes("https://wa.me/"));
  const mw = readFileSync("src/middleware.ts", "utf8");
  assert.ok(mw.includes('"/admin/cash-handover/slip"'));
  assert.equal(pathAllowed(["/admin/cash-handover/slip"], "/admin/cash-handover/slip/91ad8099"), true);
  assert.equal(pathAllowed(["/admin/cash-handover/slip"], "/admin/cash-handover"), false);
  assert.equal(pathAllowed(["/admin/pos"], "/admin/cash-handover/slip/91ad8099"), false);
});
test("manager can record wasoli when cash was sent to a finance profile, sender cannot", () => {
  const financeTeam = "c6834b12-0000-4000-8000-000000000001";
  const manager = "aaaaaaaa-0000-4000-8000-000000000002";
  const sender = "bbbbbbbb-0000-4000-8000-000000000003";
  assert.equal(canRecordHandoverReceipt({
    userId: manager, userRole: "manager", fromProfileId: sender, toProfileId: financeTeam, toRole: "finance",
  }), true);
  assert.equal(canRecordHandoverReceipt({
    userId: sender, userRole: "manager", fromProfileId: sender, toProfileId: financeTeam, toRole: "finance",
  }), false);
  assert.equal(canRecordHandoverReceipt({
    userId: manager, userRole: "manager", fromProfileId: sender, toProfileId: "other", toRole: "manager",
  }), false);
  assert.equal(canRecordHandoverReceipt({
    userId: "sales", userRole: "sales_staff", fromProfileId: sender, toProfileId: financeTeam, toRole: "finance",
  }), false);
  assert.equal(canRecordHandoverReceipt({
    userId: financeTeam, userRole: "finance", fromProfileId: sender, toProfileId: financeTeam, toRole: "finance",
  }), true);
});
console.log(`\n${n} tests passed`);
