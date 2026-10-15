const assert = require("assert");
const fs = require("fs");
const src = fs.readFileSync(require("path").join(__dirname, "..", "src/actions/pos-returns.ts"), "utf8");
assert.match(src, /let cashMatched = 0;/);
assert.match(src, /Math\.abs\(cashMatched - expectedCash\) > 0\.01/);
function check(expected, rows) {
  const m = rows.filter((a) => a > 0).reduce((t, a) => Math.round((t + a) * 100) / 100, 0);
  return !(expected > 0 && Math.abs(m - expected) > 0.01);
}
assert.equal(check(500, [500]), true);
assert.equal(check(500, [200, 300]), true);
assert.equal(check(500, []), false);
assert.equal(check(500, [500, 500]), false);
assert.equal(check(0, []), true);
console.log("pos return cash match: theek");
