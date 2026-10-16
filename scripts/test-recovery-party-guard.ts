// Recovery/Money: party-type aur ledger account ka mel (migration 535 + UI mirror).
import assert from "node:assert";
import fs from "node:fs";
import { defaultAgainstAccount, partyAccountProblem, PARTY_ACCOUNTS } from "../src/lib/finance/recovery-party-accounts";

// Yasir Ali case: customer + 2000 ab reject.
assert.match(partyAccountProblem("customer", "4a47974f", "2000") ?? "", /2000/);
assert.strictEqual(partyAccountProblem("customer", "4a47974f", "1100"), null);
assert.strictEqual(partyAccountProblem("supplier", "s1", "2000"), null);
assert.ok(partyAccountProblem("supplier", "s1", "1100"));
assert.strictEqual(partyAccountProblem("farmer", "f1", "1150"), null);
assert.ok(partyAccountProblem("customer", "", "1100"), "party id zaroori");
assert.ok(partyAccountProblem("other", "", "1100"), "other + party account reject");
assert.strictEqual(partyAccountProblem("other", "", "6010"), null);
assert.strictEqual(partyAccountProblem("dealer", "d1", "1160"), null);

// Defaults kabhi khud galat jodi na banayen.
for (const t of Object.keys(PARTY_ACCOUNTS)) for (const d of ["receive", "pay"]) {
  assert.strictEqual(partyAccountProblem(t, "x", defaultAgainstAccount(t, d)), null, `${t}/${d}`);
}
assert.strictEqual(defaultAgainstAccount("customer", "pay"), "1100");

// Migration: additive, same mapping, supplier refresh.
const sql = fs.readFileSync("supabase/migrations/535_recovery_money_party_account_guard.sql", "utf8");
const code = sql.replace(/--.*$/gm, "");
assert.ok(/create or replace function public\.fn_record_recovery_money/i.test(code));
assert.ok(!/\b(drop|delete|truncate|alter table)\b/i.test(code), "additive only");
for (const [t, accts] of Object.entries(PARTY_ACCOUNTS)) {
  assert.ok(code.includes(`when '${t}'`) && code.includes(`array[${accts.map((a) => `'${a}'`).join(",")}]`), `mapping ${t}`);
}
assert.ok(/update public\.suppliers set current_payable/.test(code));
assert.ok(/update public\.customers set current_balance/.test(code));

// UI: per-submit id, error text shown, server message passed through.
const ui = fs.readFileSync("src/app/admin/finance/recovery/recovery-client.tsx", "utf8");
assert.ok(ui.includes("pendingMoneyActionId.current ?? crypto.randomUUID()"));
assert.ok(ui.includes("partyAccountProblem(") && ui.includes("defaultAgainstAccount("));
assert.ok(!ui.includes(': "2000"}'), "pay default ab hardcoded 2000 nahi");
const route = fs.readFileSync("src/app/api/recovery/money/route.ts", "utf8");
assert.ok(route.includes("error.details") && route.includes("error.hint"));
console.log("recovery-party-guard: ok");
