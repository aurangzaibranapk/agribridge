const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
function load(p){const m={exports:{}};const src=ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;new Function('module','exports','require',src)(m,m.exports,require);return m.exports;}

// GRN payable: received excludes short/damaged; subtract nothing twice.
const {grnPayable}=load('src/lib/inventory/grn-payable.ts');
// 60 ordered, 58 received, 1 damaged, 1 short @100 => 5800
assert.equal(grnPayable([{received_qty:58,unit_price:100}],0,0),5800);
assert.equal(grnPayable([{received_qty:58,unit_price:100}],200,150),5750,'minus discount plus tax once');
assert.equal(grnPayable([{received_qty:10,unit_price:1.1},{received_qty:3,unit_price:2}],0,0),17);
const grnSrc=fs.readFileSync('src/actions/agri-grn.ts','utf8');
assert.ok(!/receivedValue\s*-\s*shortageAmount\s*-\s*damageAmount/.test(grnSrc),'GRN must not subtract short/damage from received value again');
assert.ok(grnSrc.includes('grnPayable('),'GRN uses grnPayable');

// Stock transfer: trigger (fn_apply_stock_transfer) is the only stock mover.
const {transferHasEnoughStock}=load('src/lib/inventory/transfer-rules.ts');
assert.equal(transferHasEnoughStock(10,10),true);
assert.equal(transferHasEnoughStock(9,10),false);
assert.equal(transferHasEnoughStock(10,0),false);
const wf=fs.readFileSync('src/actions/stock-transfer-workflow.ts','utf8');
assert.ok(!/from\("stock_movements"\)/.test(wf),'workflow must not insert stock_movements; trigger owns stock move');
assert.ok(!/movement_type:\s*"transfer_(in|out)"/.test(wf),'no transfer_in/out movement in app code');
assert.ok(/status: "completed"/.test(wf),'completion still flips status so the trigger moves stock');
const inv=fs.readFileSync('src/actions/inventory.ts','utf8');
assert.ok(!/movement_type:\s*"transfer_(in|out)"/.test(inv),'inventory.ts approve path delegates to trigger');

// Supplier bill number uniqueness after migration 388.
const b=load('src/lib/purchases/bill-no-unique.ts');
assert.equal(b.normalizeSupplierBillNo(' INV-001 '),'inv-001');
assert.equal(b.escapeLikePattern('A_1%'),'A\\_1\\%');
assert.equal(b.findDuplicateBillNo([{supplier_bill_no:'inv-001',status:'pending',purchase_number:'PO-1'}],' INV-001 '),'PO-1');
assert.equal(b.findDuplicateBillNo([{supplier_bill_no:'INV-001',status:'cancelled',purchase_number:'PO-1'}],'INV-001'),null,'cancelled frees the number');
assert.equal(b.findDuplicateBillNo([{supplier_bill_no:'INV-0011',status:'pending'}],'INV-001'),null);
assert.equal(b.isDuplicateBillNoError({code:'23505',message:'duplicate key value violates unique constraint "ux_bill_reads_supplier_bill_no_applied"'}),true);
assert.equal(b.isDuplicateBillNoError({code:'23505',message:'other_index'}),false);
assert.equal(b.isDuplicateBillNoError(null),false);
const pur=fs.readFileSync('src/actions/purchases.ts','utf8');
assert.ok(pur.includes('findDuplicateBillNo('),'createPurchase pre-checks duplicate bill number');
console.log('qa-inventory-procurement: ok');
