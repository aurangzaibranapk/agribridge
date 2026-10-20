const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

function load(path) {
  const source = ts.transpileModule(fs.readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const mod = { exports: {} };
  new Function("module", "exports", source)(mod, mod.exports);
  return mod.exports;
}
const g = load("src/lib/finance/money-guards.ts");
const read = (p) => fs.readFileSync(p, "utf8");
const fn = (src, name) => {
  const i = src.indexOf(`export async function ${name}(`);
  assert.ok(i >= 0, `${name} missing`);
  const next = src.indexOf("\nexport async function ", i + 10);
  return src.slice(i, next === -1 ? undefined : next);
};

assert.equal(g.isMoneyWriter("owner"), true);
assert.equal(g.isMoneyWriter("finance"), false);
assert.equal(g.isMoneyWriter("manager"), false);
assert.equal(g.kharchaApproveGate({ status: "pending", requested_by: "a" }, "b", "owner").ok, false);
assert.equal(g.kharchaApproveGate({ status: "verified", requested_by: "a", verified_by: "b" }, "a", "admin").ok, false);
assert.equal(g.kharchaApproveGate({ status: "verified", requested_by: "a", verified_by: "b" }, "b", "admin").ok, false);
assert.equal(g.kharchaApproveGate({ status: "verified", requested_by: "a", verified_by: "b" }, "c", "finance").ok, false);
assert.equal(g.kharchaApproveGate({ status: "verified", requested_by: "a", verified_by: "b" }, "c", "owner").ok, true);

assert.equal(g.cashCloseRecordGate("finance", null, "b1").ok, false);
assert.equal(g.cashCloseRecordGate("manager", "b1", "b2").ok, false);
assert.equal(g.cashCloseRecordGate("manager", "b1", "b1").ok, true);
assert.equal(g.cashCloseRecordGate("admin", null, "b9").ok, true);
assert.equal(g.cashCloseApproveGate({ counted_by: "a", difference: 10, approval_status: "recorded", journal_entry_id: null }, "a", "owner").ok, false);
assert.equal(g.cashCloseApproveGate({ counted_by: "a", difference: 10, approval_status: "recorded", journal_entry_id: null }, "b", "admin").ok, true);
assert.equal(g.cashCloseApproveGate({ counted_by: "a", difference: 0, approval_status: "recorded" }, "b", "admin").ok, false);

assert.equal(g.paymentApproveGate({ status: "pending", created_by: "a" }, "a", "owner").ok, false);
assert.equal(g.paymentApproveGate({ status: "pending", created_by: "a" }, "b", "sales_staff").ok, false);
assert.equal(g.paymentApproveGate({ status: "pending", created_by: "a" }, "b", "super_admin").ok, true);
assert.equal(g.paymentApproveGate({ status: "posted", created_by: "a" }, "b", "admin").ok, false);

assert.equal(g.restorePayableGate("finance", 10).ok, false);
assert.equal(g.restorePayableGate("admin", g.RESTORE_PAYABLE_ADMIN_MAX + 1).ok, false);
assert.equal(g.restorePayableGate("admin", 100).ok, true);
assert.equal(g.restorePayableGate("owner", g.RESTORE_PAYABLE_ADMIN_MAX + 1).ok, true);
assert.equal(g.restorePayableGate("owner", g.RESTORE_PAYABLE_OWNER_MAX + 1).ok, false);
assert.equal(g.selfReversalGate("me", "me").ok, false);
assert.equal(g.selfReversalGate(null, "me").ok, true);
assert.equal(g.selfReversalGate("me", "you").ok, true);

assert.equal(g.customerBalanceFromLedger(null), null);
assert.equal(g.customerBalanceFromLedger([]), null);
assert.equal(g.customerBalanceFromLedger([{ debit: 100, credit: 40 }]), 60);
assert.equal(g.payableFromLedger([{ debit: 20, credit: 80 }]), 60);
assert.equal(g.isCustomerBalanceDrift(0, null), false);
assert.equal(g.isCustomerBalanceDrift(15, null), true);
assert.equal(g.isCustomerBalanceDrift(10, 10), false);
assert.equal(g.isCustomerBalanceDrift(10, 12), true);

const money = g.acceptedPurchaseAmounts({ acceptedTotal: 100, discountAmount: 10, taxAmount: 5.555, receivedRatio: 0.5 });
assert.equal(money.acceptedTax, 2.78);
assert.equal(money.acceptedDiscount, 5);
assert.equal(money.acceptedPayable, 97.78);
const full = g.acceptedPurchaseAmounts({ acceptedTotal: 80, discountAmount: 0, taxAmount: 8, receivedRatio: 1 });
assert.equal(full.acceptedPayable, 88);

const ret = g.purchaseReturnLines({ goodsAmount: 100, taxAmount: 5, supplierId: "s1", memo: "wapsi" });
assert.equal(ret.lines.some((l) => l.account === "1195" && l.credit === 5), true);
assert.equal(ret.lines.some((l) => l.account === "1200" && l.credit === 100), true);
assert.equal(ret.lines.some((l) => l.account === "2000" && l.debit === 105), true);
const deb = ret.lines.reduce((s, l) => s + (l.debit || 0), 0);
const cre = ret.lines.reduce((s, l) => s + (l.credit || 0), 0);
assert.equal(deb, cre);
assert.equal("error" in g.purchaseReturnLines({ goodsAmount: 0, taxAmount: 1, memo: "x" }), true);

const short = g.cashDifferenceLines({ difference: -25, closeDate: "2026-10-01", reason: "kam" });
assert.equal(short[0].account, "6100");
assert.equal(short[0].debit, 25);
assert.equal(short[1].account, "1000");
const dealerLines = g.dealerPaymentLines({ amount: 40, cashGl: "1000", dealerId: "d1", memo: "ada" });
assert.equal(dealerLines[0].account, "2016");
assert.equal(dealerLines[1].credit, 40);
const buyerIn = g.buyerPaymentLines({ direction: "they_paid", amount: 15, cashGl: "1010", buyerId: "b1", memo: "in" });
assert.equal(buyerIn.lines[1].account, "1180");
assert.equal(g.buyerPaymentLines({ direction: "nope", amount: 1, cashGl: "1000", buyerId: "b", memo: "x" }).error.length > 0, true);
assert.equal(g.oppositeCashType("income"), "expense");
assert.equal(g.oppositeCashType("expense"), "income");

const bank = read("src/actions/bank-management.ts");
for (const name of ["addBankAccount", "updateBankAccount", "deleteBankAccount"]) {
  assert.match(fn(bank, name), /requireMoneyAdmin\(/, name);
}
assert.match(fn(bank, "addBankAccount"), /opening_balance: 0/);
assert.match(fn(bank, "addBankAccount"), /setOpeningBalance/);

const kh = read("src/actions/kharche.ts");
assert.match(kh, /const MANZOORI_WALE = \["owner", "super_admin", "admin"\]/);
assert.match(fn(kh, "kharchaManzoor"), /kharchaApproveGate/);
assert.match(fn(kh, "kharchaManzoor"), /status: "approving"/);
assert.match(fn(kh, "kharchaManzoor"), /\.eq\("status", "verified"\)/);
assert.match(fn(kh, "kharchaRadd"), /MANZOORI_WALE\.includes/);
assert.doesNotMatch(kh, /admin_assistant", "finance"/);

const cash = read("src/actions/cash-close.ts");
assert.match(fn(cash, "recordCashClose"), /cashCloseRecordGate/);
assert.doesNotMatch(fn(cash, "recordCashClose"), /postJournal\(/);
assert.match(fn(cash, "approveCashCloseDifference"), /cashCloseApproveGate/);
assert.match(fn(cash, "approveCashCloseDifference"), /cashDifferenceLines/);

const dealer = read("src/actions/dealer-payments.ts");
assert.match(fn(dealer, "recordDealerPayment"), /status: "pending"/);
assert.doesNotMatch(fn(dealer, "recordDealerPayment"), /current_payable/);
assert.match(fn(dealer, "approveDealerPayment"), /paymentApproveGate/);
assert.match(fn(dealer, "approveDealerPayment"), /dealerPaymentLines/);
assert.match(fn(dealer, "approveDealerPayment"), /payableFromLedger/);

const buyer = read("src/actions/buyer-payments.ts");
assert.match(fn(buyer, "recordBuyerPayment"), /status: "pending"/);
assert.match(fn(buyer, "approveBuyerPayment"), /buyerPaymentLines/);
assert.match(fn(buyer, "approveBuyerPayment"), /paymentApproveGate/);

const rev = read("src/actions/ledger-reversal.ts");
assert.match(fn(rev, "restoreCustomerPayable"), /restorePayableGate/);
assert.match(fn(rev, "reverseEntry"), /selfReversalGate/);
assert.match(fn(rev, "reverseEntry"), /payableFromLedger/);
assert.match(fn(rev, "reverseEntry"), /posting_status: "reversed"/);
assert.doesNotMatch(rev, /before - originalNet/);

const imp = read("src/actions/customer-import.ts");
assert.match(imp, /customerBalanceFromLedger/);
assert.doesNotMatch(imp, /abTak \+ amount/);
assert.match(read("src/actions/customer-balance-drift.ts"), /fn_customer_balance_drift/);
assert.match(read("src/actions/customer-balance-drift.ts"), /requireMoneyAdmin/);

const pur = read("src/actions/purchases.ts");
assert.match(fn(pur, "receivePurchase") || pur, /acceptedPurchaseAmounts/);
assert.match(pur, /total_amount: acceptedPayable/);
assert.doesNotMatch(pur, /warehouse_id \? acceptedPayable/);
assert.match(fn(pur, "recordPurchaseReturn"), /purchaseReturnLines/);
assert.match(fn(pur, "recordPurchaseReturn"), /requireMoneyAdmin/);

const fin = read("src/actions/finance.ts");
assert.match(fin, /Purana transfer raasta band hai/);
assert.doesNotMatch(fin, /return "legacy"/);
assert.match(fn(fin, "recordFinanceTransaction"), /transaction_type: undo/);
assert.match(fn(fin, "receiveTransfer"), /out\.created_by === gate\.userId/);
assert.doesNotMatch(fn(fin, "receiveTransfer"), /gate\.role !== "owner"/);

const grain = read("src/actions/grain-expenses.ts");
assert.match(fn(grain, "createGrainExpense"), /Reversal — ledger nahi gaya/);
assert.match(fn(grain, "createGrainExpense"), /cashErr/);

const milk = read("src/actions/milk.ts");
assert.match(fn(milk, "recordMilkPayment"), /farmerLedger\.error/);
assert.match(fn(milk, "recordMilkPayment"), /farmerWallet\.error/);
assert.match(read("src/lib/farmer-ledger.ts"), /if \(error \|\| !txn\?\.id\)/);

const sql640 = read("supabase/migrations/640_finance_money_write_rls.sql");
assert.match(sql640, /fn_is_money_writer/);
assert.match(sql640, /revoke insert, update, delete on table public\.journal_entries/);
assert.match(sql640, /fn_guard_customer_current_balance/);
assert.match(sql640, /current_setting\('role', true\)/);
assert.doesNotMatch(sql640, /current_user in/);
assert.doesNotMatch(sql640, /\bdelete\s+from\b/i);
const sql641 = read("supabase/migrations/641_finance_maker_checker_and_indexes.sql");
assert.match(sql641, /uq_cash_closing_original/);
assert.match(sql641, /uq_finance_opening_once/);
assert.match(sql641, /uq_finance_transfer_leg/);
assert.match(sql641, /'2016'/);
assert.match(sql641, /fn_mark_journal_source_reversed/);
assert.match(sql641, /approved_by = new\.created_by/);
assert.match(sql641, /current_setting\('role', true\)/);
assert.doesNotMatch(sql641, /current_user in/);
assert.match(read("src/actions/dealer-payments.ts"), /Shuruati baqi kitab mein nahi mili/);
const sql642 = read("supabase/migrations/642_customer_balance_drift.sql");
assert.match(sql642, /fn_customer_balance_drift/);
assert.doesNotMatch(sql642, /cron\.schedule|pg_cron/i);

console.log("PASS: finance money guards");
