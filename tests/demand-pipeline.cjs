const assert = require("assert");
const fs = require("fs");
const path = require("path");
const ts = require("typescript");
const dir = path.join(__dirname, "..", "src/lib/demand");
const cache = {};
function load(name) {
  if (cache[name]) return cache[name];
  const src = fs.readFileSync(path.join(dir, name + ".ts"), "utf8");
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const m = { exports: {} };
  cache[name] = m.exports;
  new Function("module", "exports", "require", js)(m, m.exports, (p) => (p.startsWith("./") ? load(p.slice(2)) : require(p)));
  return (cache[name] = m.exports);
}
const { parseMunshiCommand, munshiQuestion } = load("munshi-parser");
const { demandPriority, procurementSuggestion, areaOf } = load("priority");
const { pipelineFromStatus, effectivePipeline, canMovePipeline } = load("pipeline");
const { buildInsights, notifyMessage } = load("insights");
const { isDemandCategory } = load("categories");

// --- Parser ---
const products = [{ id: "u1", name: "Urea" }, { id: "d1", name: "DAP" }, { id: "d2", name: "DAP Engro 50kg" }];
let p = parseMunshiCommand("mujhe 20 boriyan urea chahiye", products);
assert.equal(p.quantity, 20); assert.equal(p.unit, "bag"); assert.equal(p.productId, "u1"); assert.equal(p.category, "fertilizer"); assert.deepEqual(p.missing, []);
p = parseMunshiCommand("3 acre wheat ke liye DAP", products);
assert.equal(p.acres, 3); assert.equal(p.crop, "wheat"); assert.equal(p.productName, "DAP"); assert.equal(p.quantity, null);
assert.deepEqual(p.missing, ["quantity", "unit"]);
assert.match(munshiQuestion(p), /3 acre/);
p = parseMunshiCommand("bees bori wanda de do", []);
assert.equal(p.quantity, 20); assert.equal(p.category, "wanda"); assert.equal(p.productName, "Wanda");
p = parseMunshiCommand("مجھے ۱۰ بوری یوریا چاہیے", []);
assert.equal(p.quantity, 10); assert.equal(p.unit, "bag"); assert.equal(p.productName, "Urea");
p = parseMunshiCommand("5 kg zinc", []);
assert.equal(p.unit, "kg"); assert.equal(p.category, "micronutrient");
p = parseMunshiCommand("10 liter spray", []);
assert.equal(p.unit, "liter"); assert.equal(p.category, "pesticide");
p = parseMunshiCommand("khal chahiye", []);
assert.deepEqual(p.missing, ["quantity", "unit"]); assert.equal(p.category, "khal");
p = parseMunshiCommand("chahiye", []);
assert.ok(p.missing.includes("product"));
p = parseMunshiCommand("2 bori chokar aur moomni", []);
assert.equal(p.category, "chowker");

// --- Priority ---
assert.equal(demandPriority(12, 10), "High");
assert.equal(demandPriority(2, 250), "High");
assert.equal(demandPriority(5, 100), "High");
assert.equal(demandPriority(3, 10), "Medium");
assert.equal(demandPriority(1, 60), "Medium");
assert.equal(demandPriority(1, 5), "Low");
assert.deepEqual(procurementSuggestion(45), { confirmed: 45, buffer: 5, suggested: 50 });
assert.deepEqual(procurementSuggestion(3), { confirmed: 3, buffer: 1, suggested: 4 });
assert.deepEqual(procurementSuggestion(0), { confirmed: 0, buffer: 0, suggested: 0 });
assert.equal(areaOf({ village: "Chak 12", tehsil: "Arifwala" }, "x"), "Chak 12, Arifwala");
assert.equal(areaOf({ village: "" }, "Pakpattan"), "Pakpattan");
assert.equal(areaOf(null, null), "Na-maloom ilaqa");

// --- Pipeline mapping ---
assert.equal(pipelineFromStatus("pending"), "new");
assert.equal(pipelineFromStatus("approved"), "interest_confirmed");
assert.equal(pipelineFromStatus("ordered"), "order_converted");
assert.equal(pipelineFromStatus("rejected"), "cancelled");
assert.equal(effectivePipeline({ status: "approved", pipeline_status: "stock_arrived" }), "stock_arrived");
assert.equal(effectivePipeline({ status: "approved", pipeline_status: "junk" }), "interest_confirmed");
assert.ok(canMovePipeline("procurement_planned", "stock_arrived"));
assert.ok(!canMovePipeline("new", "stock_arrived"));
assert.ok(isDemandCategory("moomni") && !isDemandCategory("cement"));

// --- Insights ---
const rows = [
  { id: "a", product_id: "u1", product_name: "Urea", quantity: 20, unit: "bag", status: "approved", farmer_id: "f1", farmers: { village: "Chak 1" } },
  { id: "b", product_id: "u1", product_name: "Urea", quantity: 25, unit: "bag", status: "approved", farmer_id: "f2", farmers: { village: "Chak 2" } },
  { id: "c", product_id: "u1", product_name: "Urea", quantity: 10, unit: "bag", status: "pending", farmer_id: "f3", farmers: null, area: "Pakpattan" },
  { id: "d", product_id: "u1", product_name: "Urea", quantity: 99, unit: "bag", status: "rejected", farmer_id: "f4" },
  { id: "e", product_id: null, product_name: "Wanda", quantity: 2, unit: "bag", status: "pending", farmer_id: "f1", category: "wanda" },
];
const ins = buildInsights(rows);
assert.equal(ins[0].productName, "Urea", "zyada score upar");
assert.equal(ins[0].farmers, 3, "rejected nahi gina");
assert.equal(ins[0].liveQuantity, 55);
assert.equal(ins[0].confirmedQuantity, 45, "sirf approved confirmed");
assert.deepEqual(ins[0].confirmedIds.sort(), ["a", "b"]);
assert.deepEqual(ins[0].suggestion, { confirmed: 45, buffer: 5, suggested: 50 });
assert.equal(ins[0].priority, "Medium");
assert.equal(ins[0].areas.length, 3);
assert.equal(ins[1].category, "wanda");
assert.match(notifyMessage({ farmerName: "Ali", productName: "Urea", quantity: 20, unit: "bag" }), /Ali.*Urea \(20 bag\)/);

// --- Koi purchase/stock/ledger/WhatsApp nahi ---
const actions = fs.readFileSync(path.join(__dirname, "..", "src/actions/demand-center.ts"), "utf8");
for (const bad of ["stock_movements", "postJournal", "postStockValueChange", "from(\"purchases\")", "sendWhatsApp", "sendSms"]) {
  assert.ok(!actions.includes(bad), "demand-center mein " + bad + " nahi hona chahiye");
}
assert.match(actions, /Kharid plan sirf Admin ya Owner/);
const parser = fs.readFileSync(path.join(dir, "munshi-parser.ts"), "utf8");
assert.ok(!/fetch\(|openai|anthropic|grok/i.test(parser), "parser koi bahar ki call nahi karta");
console.log("demand pipeline + munshi parser: theek");
