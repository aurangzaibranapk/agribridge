import assert from "node:assert/strict";
import { roleChangeBlocked } from "../src/lib/hr/role-rank";
import { salaryPaymentAmounts } from "../src/lib/hr/salary-amount";
import { staffTempPassword } from "../src/lib/hr/temp-password";
import { payrollPayDecision, payrollPayRoleAllowed } from "../src/lib/payroll/pay-once";

assert.equal(roleChangeBlocked("admin", "super_admin", "manager"), "Barabar ya oonche darje wale ka role aap nahi badal sakte.");
assert.match(roleChangeBlocked("admin", "sales_staff", "admin") ?? "", /doosra Admin/);
assert.equal(roleChangeBlocked("admin", "manager", "hr"), null);
assert.equal(roleChangeBlocked("owner", "super_admin", "admin"), null);
assert.equal(roleChangeBlocked("owner", "admin", "owner"), "Aap apne barabar ya ooncha darja nahi de sakte. Admin doosra Admin nahi bana sakta.");
assert.equal(roleChangeBlocked("super_admin", "admin", "manager"), null);
assert.match(roleChangeBlocked("super_admin", "hr", "super_admin") ?? "", /barabar ya ooncha/);

assert.deepEqual(salaryPaymentAmounts({ basic: 100, bonus: 10, overtime: 5, deductions: 20, advance: 5 }), { net: 90 });
function salaryError(input: Parameters<typeof salaryPaymentAmounts>[0], re: RegExp) {
  const got = salaryPaymentAmounts(input);
  assert.ok("error" in got);
  assert.match(got.error, re);
}
salaryError({ basic: 0, bonus: 0, overtime: 0, deductions: 0, advance: 0 }, /sifar ya manfi/);
salaryError({ basic: 10, bonus: 0, overtime: 0, deductions: 20, advance: 0 }, /sifar ya manfi/);
salaryError({ basic: Number.NaN, bonus: 0, overtime: 0, deductions: 0, advance: 0 }, /sahi nahi/);
salaryError({ basic: -1, bonus: 0, overtime: 0, deductions: 0, advance: 0 }, /manfi/);

const a = staffTempPassword();
const b = staffTempPassword();
assert.notEqual(a, b);
assert.ok(a.length >= 16);
assert.match(a, /[A-Z]/);
assert.match(a, /[a-z]/);
assert.match(a, /[0-9]/);
assert.match(a, /!/);

assert.equal(payrollPayRoleAllowed("hr"), true);
assert.equal(payrollPayRoleAllowed("admin"), true);
assert.equal(payrollPayRoleAllowed("sales_staff"), false);
assert.equal(payrollPayRoleAllowed("finance", "finance"), true);
assert.equal(
  payrollPayDecision({ status: "approved", createdBy: "m", actorId: "h", payJournalId: null, payLock: null, payLockAt: null, actorRole: "hr" }),
  "claimed",
);
assert.equal(
  payrollPayDecision({ status: "approved", createdBy: "m", actorId: "s", payJournalId: null, payLock: null, payLockAt: null, actorRole: "sales_staff" }),
  "forbidden",
);
assert.equal(
  payrollPayDecision({ status: "approved", createdBy: "m", actorId: "m", payJournalId: null, payLock: null, payLockAt: null, onOwnLine: true }),
  "maker",
);
assert.equal(
  payrollPayDecision({ status: "approved", createdBy: "m", submittedBy: "s", actorId: "a", payJournalId: null, payLock: null, payLockAt: null, onOwnLine: true }),
  "self_line",
);
assert.equal(
  payrollPayDecision({ status: "approved", createdBy: "m", submittedBy: "a", actorId: "a", payJournalId: null, payLock: null, payLockAt: null }),
  "submitter",
);

console.log("hr remaining lib: theek");
