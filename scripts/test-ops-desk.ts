import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mayDecideEntry } from "../src/lib/approval/guards";
import {
  inKarachiMonth,
  karachiMonth,
  opsReview,
  sortQueue,
  spendCard,
} from "../src/lib/finance/ops-desk";
import {
  advanceOnDesk,
  labourLabel,
  payrollDeskView,
  payrollTransactions,
  type PayAdvance,
} from "../src/lib/payroll/desk";

const gates = { canFuel: true, canGen: true, canVerifyClaim: true, canApproveClaim: true };

assert.equal(mayDecideEntry("manager", "m", ["m"]), false);
assert.equal(opsReview({ source: "route_fuel", status: "pending", role: "manager", actorId: "m", makers: ["m"], ...gates }).kind, "held");
assert.equal(
  (opsReview({ source: "route_fuel", status: "pending", role: "manager", actorId: "m", makers: ["m"], ...gates }) as { reason?: string }).reason,
  "self"
);
assert.equal(opsReview({ source: "route_fuel", status: "pending", role: "manager", actorId: "m", makers: ["other"], ...gates }).kind, "approve_fuel");
assert.equal(opsReview({ source: "route_fuel", status: "pending", role: "admin", actorId: "a", makers: ["a"], ...gates }).kind, "approve_fuel");
assert.equal(opsReview({ source: "route_fuel", status: "pending", role: "manager", actorId: "m", makers: ["other"], ...gates, canFuel: false }).kind, "held");
assert.equal(opsReview({ source: "generator", status: "pending", role: "milk_collection", actorId: "s", makers: ["other"], ...gates }).kind, "approve_generator");
assert.equal(opsReview({ source: "maintenance", status: "pending", role: "manager", actorId: "m", makers: ["other"], ...gates }).kind, "branch_verify");
assert.equal(opsReview({ source: "maintenance", status: "pending", role: "milk_collection", actorId: "s", makers: ["other"], ...gates }).kind, "held");
assert.equal(opsReview({ source: "maintenance", status: "branch_verified", role: "milk_collection", actorId: "s", makers: ["maker", "s"], ...gates }).kind, "held");
assert.equal(opsReview({ source: "maintenance", status: "branch_verified", role: "milk_collection", actorId: "s", makers: ["maker", "verifier"], ...gates }).kind, "approve_maintenance");
assert.equal(opsReview({ source: "maintenance", status: "branch_verified", role: "owner", actorId: "o", makers: ["o", "o"], ...gates }).kind, "approve_maintenance");
assert.equal(opsReview({ source: "machine_diesel", status: "claimed", role: "manager", actorId: "m", makers: ["vendor"], ...gates }).kind, "open_claims");
assert.equal(opsReview({ source: "machine_diesel", status: "manager_confirmed", role: "finance", actorId: "f", makers: ["m", "f"], ...gates, canApproveClaim: false }).kind, "held");
assert.equal(opsReview({ source: "machine_diesel", status: "manager_confirmed", role: "manager", actorId: "m", makers: ["maker", "m"], ...gates }).kind, "held");
assert.equal(opsReview({ source: "route_fuel", status: "approved", role: "admin", actorId: "a", makers: ["x"], ...gates }).kind, "held");

assert.deepEqual(spendCard([{ read: false, amounts: [10], pending: 1 }]), { amount: null, pending: null });
assert.deepEqual(spendCard([{ read: true, amounts: [], pending: 0 }]), { amount: 0, pending: 0 });
assert.deepEqual(
  spendCard([
    { read: true, amounts: [100], pending: 1 },
    { read: true, amounts: [40], pending: 2 },
  ]),
  { amount: 140, pending: 3 }
);
assert.equal(spendCard([{ read: true, amounts: [5], pending: 0 }, { read: false, amounts: [], pending: 0 }]).amount, null);

const month = karachiMonth(new Date("2026-10-28T20:00:00.000Z"));
assert.equal(month.prefix, "2026-10");
assert.equal(inKarachiMonth("2026-10-01", month.prefix), true);
assert.equal(inKarachiMonth("2026-09-30", month.prefix), false);
assert.equal(karachiMonth(new Date("2026-10-31T19:30:00.000Z")).prefix, "2026-11");

const sorted = sortQueue([
  { anomaly: false, date: "2026-10-02", id: "b" },
  { anomaly: true, date: "2026-10-01", id: "a" },
  { anomaly: false, date: "2026-10-03", id: "c" },
]);
assert.deepEqual(sorted.map((r) => r.id), ["a", "c", "b"]);

assert.equal(payrollDeskView(undefined), "people");
assert.equal(payrollDeskView("cards"), "cards");
assert.equal(payrollDeskView("tx"), "tx");
assert.equal(payrollDeskView("nope"), "people");
assert.equal(labourLabel({ runStatus: "paid", attendanceFinalized: false, openItems: 0 }).label, "Hazri adhoori");
assert.equal(labourLabel({ runStatus: "paid", attendanceFinalized: true, openItems: 0 }).label, "Ada");
assert.equal(labourLabel({ runStatus: "draft", attendanceFinalized: true, openItems: 0 }).label, "Draft");

const open: PayAdvance = {
  id: "adv-1",
  name: "Ali",
  amount: 5000,
  status: "requested",
  reason: "Ghar",
  firstYear: 2026,
  firstMonth: 11,
  createdAt: "2026-09-01",
  paidAt: null,
};
assert.equal(advanceOnDesk(open, 2026, 10), true);
const oldPaid: PayAdvance = { ...open, id: "adv-2", status: "paid", paidAt: "2026-09-02", firstYear: 2026, firstMonth: 9 };
assert.equal(advanceOnDesk(oldPaid, 2026, 10), false);
const thisPaid: PayAdvance = { ...oldPaid, id: "adv-3", paidAt: "2026-10-02" };
assert.equal(advanceOnDesk(thisPaid, 2026, 10), true);

const unread = payrollTransactions({
  year: 2026,
  month: 10,
  runStatus: "paid",
  payable: 12000,
  runRead: true,
  advances: null,
  adjustments: [],
});
assert.equal(unread.advancesUnread, true);
assert.equal(unread.rows[0].amount, 12000);
assert.equal(unread.rows.length, 1);

const withAdv = payrollTransactions({
  year: 2026,
  month: 10,
  runStatus: "draft",
  payable: 100,
  runRead: true,
  advances: [open, oldPaid],
  adjustments: [{ id: "j", staff: "Sara", fieldLabel: "Basic", oldValue: 30000, newValue: 32000, reason: "Wajah", at: "2026-10-05" }],
});
assert.equal(withAdv.rows.some((r) => r.id === "payroll-post"), false);
assert.equal(withAdv.rows.find((r) => r.id === "adv-1")?.amount, -5000);
assert.equal(withAdv.rows.find((r) => r.id === "adv-2"), undefined);
assert.equal(withAdv.rows.find((r) => r.id === "j")?.amount, 2000);

const help = readFileSync("supabase/migrations/723_fuel_ops_payroll_help.sql", "utf8");
const back = readFileSync("supabase/migrations/723_fuel_ops_payroll_help.rollback.sql", "utf8");
assert.match(help, /723_fuel_ops_payroll_help.rollback.sql/);
assert.match(help, /finance\.ops-cards/);
assert.match(help, /fn_payroll_compute/);
assert.equal(help.includes("create table"), false);
assert.equal(help.includes("alter table"), false);
assert.match(back, /delete from public.features where key = 'finance.ops-cards'/);
assert.match(back, /Tel ka hisaab: kis gaari mein kitna tel gaya/);
const board = readFileSync("src/app/admin/finance/ops/ops-board.tsx", "utf8");
assert.doesNotMatch(board, /JazzCash|Alfalah/);
assert.match(board, /Alag float nahi/);
assert.match(board, /Cash book apne safhe par hai/);
assert.match(readFileSync("src/actions/machinery-lifecycle.ts", "utf8"), /mayDecideEntry/);
assert.match(readFileSync("src/lib/ai/work-coach.ts", "utf8"), /Tel aur ops cards/);

console.log("ops desk: guards, spend, payroll views, 723 help ok");
