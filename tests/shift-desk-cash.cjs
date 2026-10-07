const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const output = ts.transpileModule(fs.readFileSync('src/lib/pos/shift-cash.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const mod = { exports: {} };
let mockService;
new Function('require','module','exports',output)((name) => name.includes('/rules') ? { ACC: {cash:'1000'} } : { createServiceClient: () => mockService },mod,mod.exports);
const calc = mod.exports.aggregateShiftCash;
const load = [{kind:'load', payment_method:'cash',principal:100,service_charge:5}];
assert.equal(calc(200,[],[],[],load).expectedCash,305,'cash service fee must enter till');
const sales=[{total_amount:300,khata_amount:50}];
const payments=[{payment_method:'cash',amount:150},{payment_method:'bank',amount:100},{payment_method:'khata',amount:50}];
const refunds=[{total_amount:25,refund_method:'original',cash_refund:10}];
const udhaar=[{credit:40,debit:0},{debit:60,credit:0}];
// Posted desk cash: load+fee 105, bank-transfer+fee 210, reversal -105.
const desk=[{debit:105,credit:0},{debit:210,credit:0},{debit:0,credit:105}];
const result=calc(200,sales,payments,refunds,load,udhaar,desk);
assert.equal(result.expectedCash,570);
assert.equal(result.loadBillCashTotal,210,'journal cash replaces principal estimate without double counting');
assert.equal(result.digitalTotal,100,'khata is not digital');
assert.equal(result.recoveryCashTotal,60);
assert.equal(result.udhaarGivenCashTotal,40);
console.log('PASS: desk fees, bank transfer, reversal, recovery, udhaar and POS split cash');

const entry=(description) => ({ description });
class Query {
  constructor(table){this.table=table;this.filters={};this.offset=0;}
  select(value){this.columns=value;return this;}
  eq(key,value){this.filters[key]=value;return this;}
  in(key,value){this.filters[key]=value;return this;}
  or(){return this;} neq(){return this;} gte(){return this;} lte(){return this;}
  order(key){if(this.table==='journal_entry_sources') assert.equal(key,'source_row_id');return this;}
  range(start){this.offset=start;return this;}
  maybeSingle(){return Promise.resolve({data:{staff_id:'staff',opened_at:'2026-10-07T01:00:00Z',closed_at:'2026-10-07T03:00:00Z',pos_counters:{shop_id:'shop',branch_id:'branch'}},error:null});}
  then(resolve,reject){
    let data=[];
    if(this.table==='pos_sales') data=[{id:'sale',total_amount:150,khata_amount:0}];
    if(this.table==='pos_sale_payment_details') data=[{payment_method:'cash',amount:150}];
    if(this.table==='load_transactions') data=[{kind:'load',payment_method:'cash',principal:100,service_charge:5}];
    if(this.table==='bank_transfer_transactions') data=[{principal:200,service_charge:10}];
    if(this.table==='journal_lines') {
      if(this.filters.account_code==='1000') data=this.filters['journal_entries.source_module']==='customer_udhaar' ? [{debit:0,credit:40}] : [{debit:315,credit:0}];
      else data=[{debit:40,credit:0,journal_entries:entry('Naqad udhaar — A')},{debit:0,credit:60,journal_entries:entry('Udhaar ki wapsi — A')}];
    }
    if(this.table==='journal_entry_sources') data=[{source_row_id:'cash'},{source_row_id:'bank'}];
    if(this.table==='finance_transactions') data=[{account_id:'cash',transaction_type:'income',amount:465,finance_accounts:{name:'Cash'}},{account_id:'bank',transaction_type:'expense',amount:300,finance_accounts:{name:'Bank'}}];
    if(this.offset>0) data=[];
    return Promise.resolve({data,error:this.table===failTable ? {message:'test query failed'} : null}).then(resolve,reject);
  }
}
let failTable=null;
mockService={from:(table)=>new Query(table)};
(async()=>{
 const summary=await mod.exports.computeShiftCash('shift',200);
 assert.equal(summary.expectedCash,625);
 assert.equal(summary.bankTransferTotal,200);
 assert.equal(summary.serviceChargeTotal,15);
 assert.equal(summary.recoveryTotal,60,'bank recovery included in total');
 assert.equal(summary.udhaarGivenTotal,40);
 assert.equal(summary.accountMovements.find(a=>a.accountId==='cash').received,465);
 assert.equal(summary.accountMovements.find(a=>a.accountId==='bank').paid,300);
 failTable='bank_transfer_transactions';
 await assert.rejects(()=>mod.exports.computeShiftCash('shift',200),/test query failed/,'missing records must block misleading close');
 console.log('PASS: closing/slip account movements, bank recovery and fail-closed query errors');
})().catch(error=>{console.error(error);process.exitCode=1;});
