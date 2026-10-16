import assert from "node:assert/strict";
import { chargeableAbsentDays, absentDeduction, computePayLine, payrollApprovalLines, serviceMonths, advanceEligibility } from "../src/lib/payroll/compute";
import { buildSchedule, equalAmounts, scheduleError, deductionFor, receivableAccount, payoutAccount } from "../src/lib/qist/schedule";

// 30-din qaida, half day aadha, overtime nahi
assert.equal(absentDeduction(20000, 2, 1), 1667);
assert.equal(absentDeduction(40000, 2, 1), 3333);
assert.equal(absentDeduction(20000, 0, 0), 0);
assert.equal(absentDeduction(20000, 31, 0), 20000, "basic se zyada nahi");
const l = computePayLine({ basic: 20000, absentDays: 2, halfDays: 1, advanceDue: 2000 });
assert.deepEqual(l, { gross: 20000, absentDeduction: 1667, otherDeductions: 0, advance: 2000, net: 16333 });
assert.equal(computePayLine({ basic: 20000, absentDays: 30, halfDays: 0, advanceDue: 2000 }).net, 0, "net manfi nahi");
// Bina record din = ghair-hazir (owner faisla): 2 absent + 13 bina record + 1 half = 15.5 din
assert.equal(computePayLine({ basic: 20000, absentDays: 2, missingDays: 13, halfDays: 1 }).absentDeduction, 10333, "20000/30*15.5");
assert.equal(computePayLine({ basic: 20000, absentDays: 0, missingDays: 30, halfDays: 0 }).net, 0, "poora mahina bina record");
assert.equal(chargeableAbsentDays({ absent_days: 2, unpaid_leave_days: 1, missing_days: 13 }), 16);
const j = payrollApprovalLines([l]);
assert.equal(j.salaries, j.advance + j.statutory + j.payable, "journal barabar");
// Mulazmat
assert.equal(serviceMonths("2026-03-01", "2026-10-16"), 7);
assert.equal(serviceMonths("2026-04-17", "2026-10-16"), 5);
assert.equal(serviceMonths("2026-04-16", "2026-10-16"), 6);
assert.equal(serviceMonths(null, "2026-10-16"), null);
const e = advanceEligibility({ serviceStart: "2026-08-01", today: "2026-10-16", minMonths: 6, openAdvances: 0, basic: 20000, amount: 12000, installments: 6, capPct: null });
assert.equal(e.eligible, false); assert.match(e.reasons[0], /6 mahine/);
assert.equal(advanceEligibility({ serviceStart: "2026-03-01", today: "2026-10-16", minMonths: 6, openAdvances: 0, basic: 20000, amount: 12000, installments: 6, capPct: null }).eligible, true);
assert.equal(advanceEligibility({ serviceStart: "2026-03-01", today: "2026-10-16", minMonths: 6, openAdvances: 0, basic: 20000, amount: 12000, installments: 6, capPct: 5 }).eligible, false, "admin ki had");
// Schedule
assert.deepEqual(equalAmounts(100000, 3), [33333, 33333, 33334]);
const w = buildSchedule({ total: 20000, count: 4, frequency: "milk_weekly", start: "2026-10-07" });
assert.deepEqual(w.map((r) => r.dueDate), ["2026-10-07", "2026-10-14", "2026-10-21", "2026-10-28"]);
const m = buildSchedule({ total: 30000, count: 3, frequency: "monthly", start: "2026-01-31" });
assert.deepEqual(m.map((r) => r.dueDate), ["2026-01-31", "2026-02-28", "2026-03-31"]);
const c = buildSchedule({ total: 9000, count: 2, frequency: "custom", start: "2026-11-01", amounts: [4000, 5000], dates: ["2026-11-05", "2026-12-20"] });
assert.deepEqual(c, [{ seq: 1, amount: 4000, dueDate: "2026-11-05" }, { seq: 2, amount: 5000, dueDate: "2026-12-20" }]);
assert.equal(scheduleError(9000, c), null);
assert.match(scheduleError(10000, c)!, /barabar nahi/);
assert.match(scheduleError(0, [])!, /khali/);
// Had: koi nahi / % / raqam
assert.deepEqual(deductionFor({ due: 5000, payout: 3000 }), { deduct: 3000, shortfall: 2000 });
assert.deepEqual(deductionFor({ due: 5000, payout: 30000, capPct: 10 }), { deduct: 3000, shortfall: 2000 });
assert.deepEqual(deductionFor({ due: 5000, payout: 30000, capAmount: 4500 }), { deduct: 4500, shortfall: 500 });
assert.deepEqual(deductionFor({ due: 5000, payout: 30000 }), { deduct: 5000, shortfall: 0 });
// Khate
assert.equal(receivableAccount("farmer", "advance"), "1140");
assert.equal(receivableAccount("farmer", "goods_credit"), "1150");
assert.equal(receivableAccount("staff", "advance"), "1130");
assert.equal(receivableAccount("dealer", "goods_credit"), "1100");
assert.equal(payoutAccount("milk"), "2010");
assert.equal(payoutAccount("cash"), null);
console.log("PASS: salary + qist helpers");
