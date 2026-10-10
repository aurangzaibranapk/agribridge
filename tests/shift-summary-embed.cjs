// Regression: finance_transactions has TWO FKs to finance_accounts
// (account_id, transfer_to_account_id). A bare `finance_accounts(name)`
// embed returns PostgREST 300 (PGRST201 ambiguous), which used to throw and
// leave the Shift Band Karein modal stuck on "…".
const assert = require('node:assert/strict');
const fs = require('node:fs');
const src = fs.readFileSync('src/lib/pos/shift-cash.ts', 'utf8');
assert.ok(src.includes('finance_accounts!finance_transactions_account_id_fkey(name)'), 'embed must name the account_id FK');
assert.ok(!/from\("finance_transactions"\)\s*\n?\s*\.select\("[^"]*[ ,]finance_accounts\(name\)/.test(src), 'no ambiguous embed');
assert.ok(!src.includes('throw new Error("Shift account receipts could not be verified'), 'account breakdown failure must not block expected cash');
const ui = fs.readFileSync('src/components/pos/shift-bar.tsx', 'utf8');
assert.ok(ui.includes('setSummaryError'), 'modal must surface summary errors instead of infinite "…"');
console.log('shift-summary-embed ok');
