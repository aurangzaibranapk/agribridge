const assert = require("assert");
const fs = require("fs");
const path = require("path");
const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

const pos = read("src/actions/pos.ts");
assert.match(pos, /p_manager_code/);
assert.match(pos, /fn_refresh_customer_balance/);
assert.ok(!pos.includes("nayaBalance"), "POS balance RMW hata");

const orders = read("src/actions/agri-orders.ts");
assert.match(orders, /pending_verification/);
assert.match(orders, /requested_by/);
assert.match(orders, /\.eq\("status", "submitted"\)/);
assert.match(orders, /\.eq\("status", "sales_verified"\)/);
assert.match(orders, /\.eq\("status", "finance_verified"\)/);
assert.match(orders, /Payment darj karne wala khud verify nahi kar sakta/);

const bridge = read("src/actions/bridge-orders.ts");
assert.match(bridge, /fn_record_bridge_advance/);
assert.match(bridge, /staff_verified/);
assert.ok(!bridge.includes("advance_paid: Number"), "bridge advance RMW hata");

const settlements = read("src/actions/settlements.ts");
assert.match(settlements, /fn_approve_party_settlement/);
assert.match(settlements, /canApprove/);
assert.ok(!settlements.includes("postJournal"), "settlement journal ab RPC mein");

const investors = read("src/actions/investor-transactions.ts");
assert.match(investors, /fn_record_investor_investment/);
assert.match(investors, /fn_request_investor_return/);
assert.match(investors, /fn_approve_investor_return/);
assert.ok(!investors.includes("total_invested"), "investor total RMW hata");

const farmer = read("src/actions/farmer-credit.ts");
assert.match(farmer, /p_override/);
assert.match(farmer, /farmerCreditNeedsOverride/);
assert.match(farmer, /UNRESTRICTED_ROLES/);

const branch = read("src/actions/branch-credit.ts");
assert.match(branch, /creditAdmin/);
assert.equal((branch.match(/await creditAdmin\(\)/g) || []).length, 3);

const credit = read("src/actions/credit-requests.ts");
assert.match(credit, /marginAllowed/);
assert.match(credit, /makerIsNotChecker/);
assert.match(credit, /\.eq\("status", "pending"\)/);
assert.match(credit, /\.eq\("status", "admin_approved"\)/);

const shop = read("src/actions/shop-rent.ts");
assert.match(shop, /fn_pay_shop_bill/);

const customers = read("src/actions/customers.ts");
const suppliers = read("src/actions/suppliers.ts");
assert.match(customers, /DUPLICATE_PHONE/);
assert.match(suppliers, /DUPLICATE_PHONE/);
assert.match(read("src/app/admin/crm/customer-form.tsx"), /confirm_duplicate/);

const counters = read("src/lib/counters.ts");
assert.match(counters, /fn_next_year_counter/);
for (const file of ["src/actions/pos-counters.ts", "src/actions/pos-collection.ts", "src/actions/agri-orders.ts", "src/actions/agri-returns.ts"]) {
  assert.match(read(file), /nextYearNumber/);
}
const shifts = read("src/actions/pos-counters.ts");
assert.match(shifts, /pos_shift_shortage_reviews/);
assert.match(shifts, /fn_review_shift_shortage/);
assert.match(shifts, /status: "open"/);

assert.match(read("src/actions/customer-udhaar.ts"), /customer_ledger/);
assert.match(read("src/lib/ai/work-coach.ts"), /Maker-checker/);

console.log("review money wiring: theek");
