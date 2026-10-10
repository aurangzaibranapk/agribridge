const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const mod={exports:{}};
new Function('module','exports',ts.transpileModule(fs.readFileSync('src/lib/grain/sale-receivable.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(mod,mod.exports);
const {grainSaleReceivableLines:sale,grainSalePaymentLines:pay,resolveGrainSaleCustomer:resolve}=mod.exports;

// Sale: Dr 1100 customer / Cr 4010
const s=sale({customerId:'C1',amount:1695818,memo:'munji'});
assert.deepEqual(s[0],{account:'1100',debit:1695818,memo:'munji',partyType:'customer',partyId:'C1'});
assert.deepEqual(s[1],{account:'4010',credit:1695818,memo:'munji'});
assert.equal(sale({customerId:'C',amount:10.005,memo:''})[0].debit,10.01);
// Never silent: no customer / zero -> throws
assert.throws(()=>sale({amount:10,memo:'x'}));
assert.throws(()=>sale({customerId:'C',amount:0,memo:'x'}));
// Payment: Dr bank / Cr 1100 customer
const p=pay({bankGl:'1010',customerId:'C1',amount:100000,memo:'w'});
assert.deepEqual(p[0],{account:'1010',debit:100000,memo:'w'});
assert.deepEqual(p[1],{account:'1100',credit:100000,memo:'w',partyType:'customer',partyId:'C1'});
assert.ok(!p.some(l=>l.account==='4010'),'payment never credits revenue');
assert.throws(()=>pay({bankGl:'1010',amount:5,memo:''}));
// Sale then full payment nets 1100 to zero
const net=[...s,...pay({bankGl:'1000',customerId:'C1',amount:1695818,memo:''})].filter(l=>l.account==='1100').reduce((a,l)=>a+(l.debit||0)-(l.credit||0),0);
assert.equal(net,0);
// Customer resolution (backward compatible)
assert.deepEqual(resolve({formCustomerId:'C9',buyerCustomerId:'C1'}),{kind:'existing',customerId:'C9'});
assert.deepEqual(resolve({formCustomerId:'',buyerCustomerId:'C1'}),{kind:'existing',customerId:'C1'});
assert.deepEqual(resolve({formCustomerId:'__new__',newCustomerName:' Sial ',buyerCustomerId:'C1'}),{kind:'create',name:'Sial'});
assert.deepEqual(resolve({}),{kind:'create',name:null});

// Action wiring
const action=fs.readFileSync('src/actions/grain-sales.ts','utf8');
assert.ok(action.includes('grainSaleReceivableLines('));
assert.ok(action.includes('if ("error" in receivablePosted) return { error:'),'receivable failure surfaced');
assert.ok(action.indexOf('ensureGrainSaleCustomer(supabase, {')<action.indexOf('stockOutPlan(quantity'),'customer resolved before stock moves');
assert.ok(action.includes('customer_id: customer.customerId'));
assert.ok(action.indexOf('receivablePosted = await postJournal')<action.indexOf('ACC.stockGrain, credit'),'COGS still posted');
// No date gate on receivable
const block=action.slice(action.indexOf('receivablePosted = await postJournal')-300,action.indexOf('receivablePosted = await postJournal'));
assert.ok(!/if \(saleDate/.test(block));

// Migration 527
const files=fs.readdirSync('supabase/migrations');
assert.equal(files.filter(n=>n.startsWith('527_')).length,1);
const sql=fs.readFileSync('supabase/migrations/527_grain_sale_receivable.sql','utf8');
assert.match(sql,/fn_record_grain_sale_payment_atomic/);
assert.match(sql,/'account', '1100', 'credit', v_amount/);
assert.match(sql,/'partyType', 'customer', 'partyId', v_customer/);
assert.ok(!/'account', '4010', 'credit'/.test(sql),'payment no longer credits 4010');
assert.match(sql,/raise exception 'Bikri % ka gahak/);
assert.match(sql,/grain_sales add column if not exists customer_id uuid references public\.customers/);
assert.match(sql,/buyers add column if not exists customer_id/);
assert.match(sql,/Same-day/);
assert.ok(!/\b(delete from|drop table|drop column|truncate|update journal_)/i.test(sql),'additive only');

// Picker
const ui=fs.readFileSync('src/app/admin/grain-procurement/sell/sell-grain-client.tsx','utf8');
assert.ok(ui.includes('name="customer_id"')&&ui.includes('__new__')&&ui.includes('new_customer_name'));
console.log('grain-sale-receivable: ok');
