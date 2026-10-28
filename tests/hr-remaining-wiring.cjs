const assert = require("assert");
const fs = require("fs");
const path = require("path");
const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

const hr = read("src/actions/hr.ts");
const users = read("src/actions/users.ts");
const pay = read("src/actions/payroll.ts");
const m662 = read("supabase/migrations/662_payroll_pay_once.sql");

assert.ok(!hr.includes("Math.random"), "password Math.random nahi");
assert.match(hr, /staffTempPassword\(\)/, "crypto password");
assert.match(hr, /salaryPaymentAmounts/, "raqam ki rok");

const checkIn = hr.slice(hr.indexOf("function selfCheckIn"), hr.indexOf("function selfCheckOut"));
const checkOut = hr.slice(hr.indexOf("function selfCheckOut"), hr.indexOf("function inviteStaffMember"));
assert.match(checkIn, /aajKaKhana\(\)/);
assert.ok(!checkIn.includes("toISOString().split"), "check-in PKT");
assert.match(checkOut, /aajKaKhana\(\)/);
assert.ok(!checkOut.includes("toISOString().split"), "check-out PKT");

assert.match(users, /roleChangeBlocked/, "S5 rank");
assert.match(pay, /submitted_by/, "N8");
assert.match(pay, /apni tankhwah hai/, "S6");

const indexAt = m662.indexOf("create unique index if not exists uq_payroll_pay_journal");
const countAt = m662.indexOf("group by pay_journal_id");
assert.ok(countAt > 0 && countAt < indexAt, "duplicate count index se pehle");

for (const f of [
  "680_salary_period_pay_once",
  "681_salary_payment_insert_guard",
  "682_salary_structure_self_guard",
  "683_staff_khata_self_guard",
  "684_advance_pay_maker_guard",
  "685_qist_self_decision_guard",
]) {
  assert.ok(fs.existsSync(path.join(__dirname, "..", `supabase/migrations/${f}.sql`)), f);
  assert.ok(fs.existsSync(path.join(__dirname, "..", `supabase/migrations/${f}.rollback.sql`)), `${f} rollback`);
}

console.log("hr remaining wiring: theek");
