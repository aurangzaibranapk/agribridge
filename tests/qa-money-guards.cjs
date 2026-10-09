const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

function load(path) {
  const source = ts.transpileModule(fs.readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = { exports: {} };
  new Function("module", "exports", source)(mod, mod.exports);
  return mod.exports;
}

const order = load("src/lib/orders/line-math.ts");
const line = order.orderLineAmounts(10, 100, 50, 20);
assert.equal(line.lineTotal, 970);
assert.equal(line.netPrice, 97);
assert.notEqual(10 * (100 - 50 + 20), line.lineTotal);

const tax = load("src/lib/purchases/tax-report-math.ts");
assert.equal(tax.taxReportPayable(950, 1000, 100, 50), 950);
assert.equal(tax.taxReportPayable(null, 1000, 100, 50), 950);
const totals = tax.taxReportTotals([{ invoice_total: 950, total_amount: 1000, discount_amount: 100, tax_amount: 50 }]);
assert.equal(totals.payable, 950);
assert.notEqual(totals.payable, 850);

const stock = load("src/lib/inventory/stock-math.ts");
assert.equal(stock.stockHoldingValue(10, [{ remaining: 10, unitCost: 100 }], 150).value, 1000);
assert.equal(stock.stockHoldingValue(10, [{ remaining: 4, unitCost: 100 }], 150).value, 1300);
const short = stock.stockOutPlan(10, 10, [{ remaining: 4, unitCost: 20 }]);
assert.equal(short.ok, false);
const ok = stock.stockOutPlan(4, 4, [{ remaining: 4, unitCost: 20 }]);
assert.equal(ok.ok, true);
assert.equal(ok.cost, 80);

const receipt = load("src/lib/pos/receipt-math.ts");
const balances = receipt.receiptBalances(700, 200);
assert.equal(balances.previous, 500);
assert.equal(balances.current, 700);
assert.equal(receipt.receiptLineSumMatches(1000, 100, 900), true);

const ret = load("src/lib/orders/return-math.ts");
const priced = ret.returnPriceCheck(90, 2, { order_qty: 5, unit_price: 100, line_total: 450 }, 1);
assert.equal(priced.ok, true);
assert.equal(priced.unitPrice, 90);
const inflated = ret.returnPriceCheck(500, 2, { order_qty: 5, unit_price: 100, line_total: 450 }, 0);
assert.equal(inflated.ok, false);

const orders = fs.readFileSync("src/actions/agri-orders.ts", "utf8");
assert.equal(orders.includes("i.order_qty * (i.unit_price - (i.discount ?? 0)"), false);
const taxPage = fs.readFileSync("src/app/admin/purchases/tax-report/page.tsx", "utf8");
assert.equal(taxPage.includes("Number(p.total_amount) - disc"), false);
const receiptUi = fs.readFileSync("src/components/pos/receipt-modal.tsx", "utf8");
assert.equal(receiptUi.includes("Discount"), true);
assert.equal(receiptUi.includes("payment_lines"), true);
assert.equal(receiptUi.includes("Math.max(0, receipt.khata_amount)"), false);

console.log("PASS: order line, tax payable, batch stock, receipt balance, return price");
