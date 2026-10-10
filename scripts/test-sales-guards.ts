/**
 * Sales money guards -- pure unit tests (koi database nahi chhoti).
 *     npm run test:sales
 */
import assert from "node:assert/strict";
import { validateCheckoutTotals, normalizePkPhone, receiptFigures, matchReturnFinanceRows } from "../src/lib/pos/checkout-guards";
import { returnPriceCheck } from "../src/lib/orders/return-math";
import { orderLineAmounts } from "../src/lib/orders/line-math";
import { stockOutPlan } from "../src/lib/inventory/stock-math";

let n = 0;
function test(name: string, fn: () => void) { fn(); n++; console.log(`ok  ${name}`); }
const items = [{ quantity: 2, unit_price: 500 }]; // gross 1000

test("cash + bank lines = net passes, cash_paid derived from all non-khata lines", () => {
  const r = validateCheckoutTotals({ items, discount: 100, cashPaid: 400, khataAmount: 0, paymentLines: [{ method: "cash", amount: 400 }, { method: "bank", amount: 500 }] });
  assert.ok(r.ok); if (r.ok) { assert.equal(r.net, 900); assert.equal(r.nonKhataPaid, 900); assert.equal(r.overpayment, 0); }
});
test("discount > gross rejected", () => {
  assert.equal(validateCheckoutTotals({ items, discount: 1001, cashPaid: 0, khataAmount: 0, paymentLines: [] }).ok, false);
});
test("negative discount rejected", () => {
  assert.equal(validateCheckoutTotals({ items, discount: -1, cashPaid: 1001, khataAmount: 0, paymentLines: [{ method: "cash", amount: 1001 }] }).ok, false);
});
test("short payment (cash + khata < net) rejected", () => {
  assert.equal(validateCheckoutTotals({ items, cashPaid: 500, khataAmount: 300, paymentLines: [{ method: "cash", amount: 500 }, { method: "khata", amount: 300 }] }).ok, false);
});
test("khataAmount disagreeing with khata line rejected", () => {
  assert.equal(validateCheckoutTotals({ items, cashPaid: 500, khataAmount: 600, paymentLines: [{ method: "cash", amount: 500 }, { method: "khata", amount: 500 }] }).ok, false);
});
test("cashPaid larger than payment lines rejected", () => {
  assert.equal(validateCheckoutTotals({ items, cashPaid: 2000, khataAmount: 0, paymentLines: [{ method: "cash", amount: 1000 }] }).ok, false);
});
test("cash + khata = net passes", () => {
  const r = validateCheckoutTotals({ items, cashPaid: 600, khataAmount: 400, paymentLines: [{ method: "cash", amount: 600 }, { method: "khata", amount: 400 }] });
  assert.ok(r.ok);
});
test("overpayment computed, not with khata", () => {
  const r = validateCheckoutTotals({ items, cashPaid: 1200, khataAmount: 0, paymentLines: [{ method: "cash", amount: 1200 }] });
  assert.ok(r.ok); if (r.ok) assert.equal(r.overpayment, 200);
  assert.equal(validateCheckoutTotals({ items, cashPaid: 1200, khataAmount: 100, paymentLines: [{ method: "cash", amount: 1200 }, { method: "khata", amount: 100 }] }).ok, false);
});
test("WhatsApp phone gets 92 exactly once", () => {
  assert.equal(normalizePkPhone("03001234567"), "923001234567");
  assert.equal(normalizePkPhone("923001234567"), "923001234567");
  assert.equal(normalizePkPhone("+92 300 1234567"), "923001234567");
  assert.equal(normalizePkPhone("00923001234567"), "923001234567");
  assert.equal(normalizePkPhone("3001234567"), "923001234567");
  assert.equal(normalizePkPhone(""), "");
});
test("receipt figures show gross/discount/net and real (negative) balance", () => {
  const f = receiptFigures({ total_amount: 900, discount_amount: 100, customer_balance: -250 });
  assert.deepEqual(f, { gross: 1000, discount: 100, net: 900, balance: -250 });
});
test("return cash-book match by return_id, legacy exact note only (no RET-10 for RET-1)", () => {
  const rows = [
    { id: "a", source_row_id: null, notes: "POS wapsi RET-1 (cash)" },
    { id: "b", source_row_id: null, notes: "POS wapsi RET-10 (cash)" },
  ];
  assert.deepEqual(matchReturnFinanceRows(rows, "rid", "RET-1").map((r) => r.id), ["a"]);
  const src = [...rows, { id: "c", source_row_id: "rid", notes: "POS wapsi RET-1 (bank)" }];
  assert.deepEqual(matchReturnFinanceRows(src, "rid", "RET-1").map((r) => r.id), ["c"]);
});
test("already fixed: agri order line discount is per line, not per unit", () => {
  assert.equal(orderLineAmounts(10, 100, 50, 0).lineTotal, 950);
});
test("already fixed: agri return price/qty check against order", () => {
  const line = { order_qty: 10, unit_price: 100, line_total: 950 };
  assert.equal(returnPriceCheck(95, 5, line).ok, true);
  assert.equal(returnPriceCheck(100, 5, line).ok, false);
  assert.equal(returnPriceCheck(95, 6, line, 5).ok, false);
});
test("receive refuses short on-hand or short batch coverage", () => {
  assert.equal(stockOutPlan(5, 3, [{ remaining: 10, unitCost: 1 }]).ok, false);
  assert.equal(stockOutPlan(5, 10, [{ remaining: 2, unitCost: 1 }]).ok, false);
  assert.equal(stockOutPlan(5, 10, [{ remaining: 5, unitCost: 1 }]).ok, true);
});
console.log(`\n${n} tests passed`);
