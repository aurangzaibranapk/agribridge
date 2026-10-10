// Finance approval guards (10 Oct 2026) -- static checks that each money
// action is gated, so a later edit cannot silently drop the gate.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const read = (p) => fs.readFileSync(p, "utf8");
const body = (src, fn) => {
  const i = src.indexOf(`export async function ${fn}(`);
  assert.ok(i >= 0, `${fn} missing`);
  return src.slice(i, i + 700);
};
const gated = (p, fns) => { const s = read(p); for (const f of fns) assert.match(body(s, f), /requireMoneyAdmin\(/, `${p}:${f} not gated`); };

gated("src/actions/finance.ts", ["createFinanceAccount", "setOpeningBalance", "recordFinanceTransaction", "transferBetweenAccounts", "receiveTransfer"]);
gated("src/actions/bank-reconcile.ts", ["importBankLines", "bookBankLine"]);
gated("src/actions/grain-expenses.ts", ["createGrainExpense"]);
gated("src/actions/billing.ts", ["saveBillingSettings", "saveMonthlyExpense"]);
gated("src/actions/milk.ts", ["recordMilkPayment", "saveMilkRateSettings"]);

const fin = read("src/actions/finance.ts");
assert.doesNotMatch(fin, /from\("finance_transactions"\)\.delete\(\)/, "opening balance must reverse, not delete");
assert.match(fin, /created_by === gate\.userId/, "transfer receiver self-check");

const bank = read("src/actions/bank-reconcile.ts");
assert.match(bank, /formData\.get\("force"\)/, "bank double-count guard");

const per = read("src/actions/accounting-periods.ts");
assert.match(body(per, "closeYear"), /gate\(true\)/);
assert.match(body(per, "reopenPeriod"), /gate\(true\)/);
assert.match(per.slice(per.indexOf("export async function closeYear(")), /Math\.abs\(tb\.farq\) > 0\.009/, "closeYear trial balance check");

const jv = read("src/actions/journal-entry.ts");
assert.match(jv, /const ROLES = \["owner", "super_admin", "admin"\];/, "manual JV finance removed");

const rev = read("src/actions/ledger-reversal.ts");
assert.doesNotMatch(rev, /before - originalNet/, "customer balance must be recomputed from ledger, not double-subtracted");
assert.match(rev, /balanceErrors/, "balance update errors surfaced");

const ud = read("src/actions/customer-udhaar.ts");
assert.match(ud, /hadd === null && !g\.unrestricted/, "null credit limit blocks staff loans");

assert.ok(fs.existsSync("supabase/migrations/522_finance_transfer_in_transit.sql"));
console.log("PASS: finance approval and calc guards");
