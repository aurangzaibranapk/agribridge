/** 621 party links — pure hisaab. npm run test:party-links */
import assert from "node:assert/strict";
import {
  glToStatementRows, supplierPayableFromGl, customerReceivableFromGl, linkedNet, linkedSettlementLimit,
  linkedSettlementLines, supplierBillLines, canApprove,
} from "../src/lib/party-links/core";
import { qismDhoondein, KHARCHA_QISMEIN } from "../src/lib/kharche";
import { expenseAccountFor } from "../src/lib/ledger/rules";

let ok = 0; const pass = (n: string) => { ok++; console.log(`  ok  ${n}`); };
const S = "sup-1", C = "cus-1";

// Yasir: diesel bill 45,000 (kharche), payment 30,000 (recovery), purchase 9,000 (table se, GL se dobara nahi)
const gl = [
  { account_code: "2000", debit: 0, credit: 45000, entry_date: "2026-10-18", entry_number: "TXN-26-1", description: "Diesel bill", source_module: "kharche" },
  { account_code: "2000", debit: 30000, credit: 0, entry_date: "2026-10-20", entry_number: "TXN-26-2", description: "Paid to Yasir", source_module: "recovery_money" },
  { account_code: "2000", debit: 0, credit: 9000, entry_date: "2026-10-10", entry_number: "TXN-26-3", description: "Purchase", source_module: "purchase" },
  { account_code: "1120", debit: 1000, credit: 0, entry_date: "2026-10-11", entry_number: "TXN-26-4", description: "Advance", source_module: "recovery_money" },
  { account_code: "6010", debit: 45000, credit: 0, entry_date: "2026-10-18", source_module: "kharche" },
];
const rows = glToStatementRows(gl);
assert.equal(rows.length, 3, "purchase + 6010 excluded");
assert.deepEqual(rows.map((r) => [r.debit, r.credit]), [[45000, 0], [0, 30000], [0, 1000]]);
pass("GL -> statement: 2000 credit = bill, 2000/1120 debit = payment; purchase not doubled");

assert.equal(supplierPayableFromGl(gl), 45000 - 30000 + 9000 - 1000);
pass("supplier payable from GL includes all modules (23,000)");

assert.equal(customerReceivableFromGl([{ account_code: "1100", debit: 20000, credit: 2951 }, { account_code: "2030", debit: 0, credit: 999 }]), 17049);
pass("customer receivable = 1100 only");

assert.deepEqual(linkedNet(17049, 23000), { theyOwe: 17049, weOwe: 23000, net: -5951 });
assert.deepEqual(linkedNet(17049, -30000), { theyOwe: 47049, weOwe: 0, net: 47049 });
assert.equal(linkedSettlementLimit(17049, 23000), 17049);
assert.equal(linkedSettlementLimit(17049, -5), 0);
pass("net + settle limit (advance to supplier counts as they-owe; no settle when one side <= 0)");

const sl = linkedSettlementLines({ amount: 17049, customerId: C, supplierId: S, memo: "ADJ" });
assert.deepEqual(sl.map((l) => [l.account, l.debit ?? 0, l.credit ?? 0, l.partyType, l.partyId]),
  [["2000", 17049, 0, "supplier", S], ["1100", 0, 17049, "customer", C]]);
assert.throws(() => linkedSettlementLines({ amount: 0, customerId: C, supplierId: S, memo: "" }));
pass("linked settlement: Dr 2000 supplier / Cr 1100 customer, balanced");

assert.equal(canApprove("u1", "u1"), false);
assert.equal(canApprove("u1", "u2"), true);
assert.equal(canApprove(null, "u2"), true);
pass("maker-checker");

const q = qismDhoondein("supplier_bill_udhaar");
assert.ok(q && q.udhaarPar && q.bandaKahanSe === "supplier" && q.asalKharcha && q.khaana === "kharcha");
assert.equal(KHARCHA_QISMEIN.filter((x) => x.udhaarPar).length, 1, "only one udhaar qism");
assert.equal(expenseAccountFor("Petrol / Diesel"), "6010");
const bl = supplierBillLines({ amount: 45000, expenseAccount: expenseAccountFor("diesel"), supplierId: S, memo: "EXP-1" });
assert.deepEqual(bl.map((l) => [l.account, l.debit ?? 0, l.credit ?? 0, l.partyId]), [["6010", 45000, 0, S], ["2000", 0, 45000, S]]);
assert.throws(() => supplierBillLines({ amount: 1, expenseAccount: "1010", supplierId: S, memo: "" }), /6xxx/);
pass("kharche supplier bill: Dr 6010 / Cr 2000 on supplier, no cash account");

console.log(`party-links: ${ok} passed`);
