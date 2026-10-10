const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const mod={exports:{}};
new Function('module','exports',ts.transpileModule(fs.readFileSync('src/lib/ledger/receipt-classify.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(mod,mod.exports);
const {nonRevenueReceiptAccount:f}=mod.exports;
// Live categories seen on 10 Oct 2026
assert.equal(f('Udhaar liya (qarz)'),'9999');
assert.equal(f('customer_udhaar_wapsi'),'9999');
assert.equal(f('Recovery from Ali'),'9999');
assert.equal(f('Shuruati balance'),'3200');
assert.equal(f('Machinery Rental - Vendor Payout (wapas)'),'9999');
// Real income stays revenue (null -> caller's normal mapping)
for (const c of ['pos_sale','Grain Sale','mobile_load','bill_payment','Machinery - Diesel','bank_transfer_service',null,'']) assert.equal(f(c),null,c);
// rules.ts must consult the classifier before revenue mapping
const rules=fs.readFileSync('src/lib/ledger/rules.ts','utf8');
assert.match(rules,/nonRevenueReceiptAccount\(category\)[\s\S]{0,80}return nonRevenue/);
// stock-loss must not ignore postJournal result
const sl=fs.readFileSync('src/actions/stock-loss.ts','utf8');
assert.ok(!/^\s*await postJournal\(/m.test(sl),'stock-loss: unassigned postJournal');
assert.equal((sl.match(/failed\(posted\)/g)||[]).length,2);
console.log('receipt-classify ok');
