// App ki taraf: HR audit fixes (S2/S3/S4/B1) code mein jure hain.
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

const hr = read("src/actions/hr.ts");
const pay = hr.slice(hr.indexOf("export async function markSalaryPaid"), hr.indexOf("export async function selfCheckIn"));
assert.match(pay, /rpc\("fn_salary_payment_claim"/, "B1: pehle claim");
assert.ok(pay.indexOf("fn_salary_payment_claim") < pay.indexOf('from("finance_transactions")'), "B1: claim cash book se pehle");
assert.ok(!/from\("salary_payments"\)\s*\.update\(/.test(pay), "B1: bina shart wala update khatam");
assert.match(pay, /fn_salary_payment_unclaim/, "B1: fail par claim wapas");

const att = read("src/lib/staff-attendance.ts");
const wa = att.slice(att.indexOf("export async function whatsappCheckIn"), att.indexOf("export async function whatsappCheckOut"));
assert.ok(!/\.upsert\(/.test(wa), "S3: WhatsApp check-in upsert nahi karta");
assert.match(wa, /whatsappCheckInBlockedMessage\(already\)/, "S3: pehle se record ho to rukta hai");

const rep = read("src/actions/hr-attendance.ts");
const rl = rep.slice(rep.indexOf("export async function saveReportingLine"));
assert.match(rl.slice(0, 1200), /profileId === user\.id/, "S4: apni reporting khud nahi");
const prob = read("src/actions/hr-probation.ts");
const sp = prob.slice(prob.indexOf("export async function startProbation"));
assert.match(sp.slice(0, 1200), /profileId === user\.id/, "S4: apni aazmaish khud nahi");

for (const f of ["590_leave_self_approval_guard", "591_attendance_self_write_guard",
  "592_staff_details_self_edit_guard", "593_salary_payment_single_pay"]) {
  assert.ok(fs.existsSync(path.join(__dirname, "..", `supabase/migrations/${f}.sql`)), `${f} migration`);
  assert.ok(fs.existsSync(path.join(__dirname, "..", `supabase/rollbacks/${f}.rollback.sql`)), `${f} rollback`);
}
console.log("hr self-approval wiring: theek");
