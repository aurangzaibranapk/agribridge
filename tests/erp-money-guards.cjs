const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

function load(path, names) {
  const source = ts.transpileModule(fs.readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = { exports: {} };
  new Function("module", "exports", source)(mod, mod.exports);
  return mod.exports;
}

const tax = load("src/lib/purchases/tax-report-math.ts");
assert.equal(tax.taxReportPayable(950, 1000, 100, 50), 950);
assert.equal(tax.taxReportPayable(null, 1000, 100, 50), 950);
const totals = tax.taxReportTotals([{ invoice_total: 950, total_amount: 1000, discount_amount: 100, tax_amount: 50 }]);
assert.equal(totals.payable, 950);
assert.notEqual(totals.payable, 850);

const order = load("src/lib/orders/line-math.ts");
const line = order.orderLineAmounts(10, 100, 50, 20);
assert.equal(line.lineTotal, 970);
assert.equal(line.netPrice, 97);

const stock = load("src/lib/inventory/stock-math.ts");
assert.equal(stock.stockHoldingValue(10, [{ remaining: 10, unitCost: 100 }], 150).value, 1000);
assert.equal(stock.stockHoldingValue(10, [{ remaining: 4, unitCost: 100 }], 150).value, 1300);
const short = stock.stockOutPlan(10, 10, [{ remaining: 4, unitCost: 20 }]);
assert.equal(short.ok, false);
const ok = stock.stockOutPlan(4, 4, [{ remaining: 4, unitCost: 20 }]);
assert.equal(ok.ok, true);
assert.equal(ok.cost, 80);
console.log("PASS: tax payable, order line, batch stock value and stock-out guard");
