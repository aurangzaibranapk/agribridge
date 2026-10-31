/** Pending Approvals popup: kaun se button, edit ki rok, purane actions. npm run test:pending-popup */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { adminPendingDict } from "../src/lib/i18n/dict/admin-pending";
import {
  expenseVerificationReset,
  handoffActionCategory,
  parseExpenseEdit,
  parseSupplierEdit,
  popupCaps,
} from "../src/lib/pending/popup";

let n = 0;
function test(name: string, fn: () => void) {
  fn();
  n++;
  console.log(`ok  ${name}`);
}

const dict = adminPendingDict as Record<string, { en: string; rm: string; ur: string }>;

test("labels: Dekhein / View / دیکھیں and the quiet hints exist in EN RM UR", () => {
  assert.equal(dict.apb_view.en, "View");
  assert.equal(dict.apb_view.rm, "Dekhein");
  assert.equal(dict.apb_view.ur, "دیکھیں");
  for (const k of ["apb_edit", "apb_verify", "apb_hint_txn", "apb_hint_handoff", "apb_hint_linked", "apb_edit_reset_hint", "apb_need_account"]) {
    assert.ok(dict[k].en && dict[k].rm && dict[k].ur, k);
  }
  assert.match(dict.apb_hint_txn.rm, /approve ya reject nahi/);
  assert.match(dict.apb_hint_handoff.rm, /agle safhe/);
});

test("expense: pending admin verifies, rejects and edits — approve waits for tasdeeq", () => {
  const caps = popupCaps({ category: "expenses", status: "pending", role: "admin", isOwn: false });
  assert.equal(caps.verify, true);
  assert.equal(caps.approve, false);
  assert.equal(caps.reject, true);
  assert.equal(caps.edit, true);
  const own = popupCaps({ category: "expenses", status: "pending", role: "admin", isOwn: true });
  assert.equal(own.verify, false);
  assert.equal(own.edit, true);
  assert.equal(own.reject, true);
});

test("expense: verified admin approves; manager only verifies someone else's pending", () => {
  const caps = popupCaps({ category: "expenses", status: "verified", role: "owner", isOwn: true });
  assert.equal(caps.approve, true);
  assert.equal(caps.verify, false);
  assert.equal(caps.reject, true);
  const mgr = popupCaps({ category: "expenses", status: "pending", role: "manager", isOwn: false });
  assert.equal(mgr.verify, true);
  assert.equal(mgr.approve, false);
  assert.equal(mgr.reject, false);
  const mgrOwn = popupCaps({ category: "expenses", status: "pending", role: "manager", isOwn: true });
  assert.equal(mgrOwn.verify, false);
  const stuck = popupCaps({ category: "expenses", status: "approving", role: "admin", isOwn: false });
  assert.equal(stuck.hint, "approving");
  assert.equal(stuck.approve, false);
});

test("expense edit: amount or account change drops verification; description does not", () => {
  const prev = { status: "verified", amount: 1500, accountId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" };
  assert.equal(expenseVerificationReset(prev, { amount: 1600, accountId: prev.accountId }), true);
  assert.equal(expenseVerificationReset(prev, { amount: 1500, accountId: null }), true);
  assert.equal(expenseVerificationReset(prev, { amount: 1500, accountId: prev.accountId }), false);
  assert.equal(expenseVerificationReset({ ...prev, status: "pending" }, { amount: 1, accountId: null }), false);
});

test("expense edit parse rejects empty detail, zero amount and a bad date", () => {
  assert.equal(parseExpenseEdit({ description: "ab", amount: "10", category: "diesel" }).ok, false);
  assert.equal(parseExpenseEdit({ description: "diesel bill", amount: "0", category: "diesel" }).ok, false);
  assert.equal(parseExpenseEdit({ description: "diesel bill", amount: "500", category: "diesel", expenseDate: "31-10-2026" }).ok, false);
  const ok = parseExpenseEdit({ description: "diesel bill", amount: "1,500.5", category: "diesel", expenseDate: "2026-10-31", partyName: "Rana" });
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.value.amount, 1500.5);
    assert.equal(ok.value.partyName, "Rana");
    assert.equal(ok.value.accountId, null);
  }
});

test("supplier: HQ approves and edits; finance edits but does not approve; account flag when missing", () => {
  const hq = popupCaps({ category: "supplier_payments", status: "pending", role: "admin", isOwn: false, hasAccount: false });
  assert.equal(hq.approve, true);
  assert.equal(hq.reject, true);
  assert.equal(hq.edit, true);
  assert.equal(hq.needsAccount, true);
  const ready = popupCaps({ category: "supplier_payments", status: "pending", role: "owner", isOwn: false, hasAccount: true });
  assert.equal(ready.needsAccount, false);
  const fin = popupCaps({ category: "supplier_payments", status: "pending", role: "finance", isOwn: false, hasAccount: false });
  assert.equal(fin.approve, false);
  assert.equal(fin.edit, true);
  assert.equal(fin.needsAccount, false);
  const bad = parseSupplierEdit({ amount: "2000", method: "Cash" });
  assert.equal(bad.ok, true);
  assert.equal(parseSupplierEdit({ amount: "2000", method: "" }).ok, false);
});

test("labour: manager decides someone else's pending and must leave a note; own entry stays shut", () => {
  const mgr = popupCaps({ category: "labour", status: "pending", role: "manager", isOwn: false });
  assert.equal(mgr.approve, true);
  assert.equal(mgr.reject, true);
  assert.equal(mgr.needsComment, true);
  assert.equal(mgr.edit, false);
  const own = popupCaps({ category: "labour", status: "pending", role: "manager", isOwn: true });
  assert.equal(own.approve, false);
  const admin = popupCaps({ category: "labour", status: "pending", role: "admin", isOwn: true });
  assert.equal(admin.approve, true);
});

test("handoff and txn alert have no approve; a linked expense handoff maps to expenses", () => {
  assert.equal(popupCaps({ category: "txn_alerts", status: "pending", role: "admin", isOwn: false }).hint, "txn");
  assert.equal(popupCaps({ category: "txn_alerts", status: "pending", role: "admin", isOwn: false }).approve, false);
  assert.equal(popupCaps({ category: "work_handoffs", status: "open", role: "admin", isOwn: false }).hint, "handoff");
  assert.equal(popupCaps({ category: "work_handoffs", status: "open", role: "owner", isOwn: false }).edit, false);
  assert.equal(handoffActionCategory("company_expense_requests"), "expenses");
  assert.equal(handoffActionCategory("supplier_payment_requests"), "supplier_payments");
  assert.equal(handoffActionCategory("labour_work_entries"), "labour");
  assert.equal(handoffActionCategory("purchases"), null);
  assert.equal(popupCaps({ category: "pos_returns", status: "pending", role: "admin", isOwn: false }).hint, "summary");
});

test("UI wiring: Dekhein on the row, popup calls the old actions, no second ledger", () => {
  const btn = readFileSync("src/app/admin/my-work/pending/decide-buttons.tsx", "utf8");
  const drawer = readFileSync("src/app/admin/my-work/pending/view-drawer.tsx", "utf8");
  const server = readFileSync("src/app/admin/my-work/pending/popup-server.ts", "utf8");
  const kharcha = readFileSync("src/actions/kharche.ts", "utf8");
  assert.match(btn, /data-pending-view|PendingViewButton/);
  assert.match(btn, /hideView/);
  assert.match(drawer, /role="dialog"/);
  assert.match(drawer, /data-pending-popup/);
  assert.match(drawer, /data-popup-approve/);
  assert.match(drawer, /data-popup-reject/);
  assert.match(drawer, /data-popup-edit/);
  assert.ok(!/window\.confirm|window\.prompt|window\.alert/.test(drawer + btn));
  for (const name of [
    "kharchaVerify",
    "kharchaManzoor",
    "kharchaRadd",
    "kharchaTheek",
    "mazdooriManzoor",
    "mazdooriRadd",
    "approveSupplierPayment",
    "rejectSupplierPayment",
    "editSupplierPayment",
  ]) {
    assert.ok(server.includes(name), name);
  }
  assert.ok(!server.includes("postJournal"));
  assert.ok(kharcha.includes("export async function kharchaTheek"));
  assert.ok(!/status:\s*"approved"/.test(kharcha.slice(kharcha.indexOf("export async function kharchaTheek"))));
});

console.log(`\n${n} pending-popup tests passed`);
