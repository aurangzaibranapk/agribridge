const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const mod={exports:{}};
new Function('module','exports',ts.transpileModule(fs.readFileSync('src/lib/grain/payable-journal.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(mod,mod.exports);
const {grainPayableJournalLines:lines,grainPayableParty}=mod.exports;

// Kisan: Dr 5020 / Cr 2040 farmer
const f=lines({farmerId:'F1',amount:1662456.6,memo:'munji'});
assert.equal(f.length,2);
assert.deepEqual(f[0],{account:'5020',debit:1662456.6,memo:'munji'});
assert.deepEqual(f[1],{account:'2040',credit:1662456.6,memo:'munji',partyType:'farmer',partyId:'F1'});
// Grain party
const p=lines({partyId:'P1',amount:100.005,memo:'x'});
assert.equal(p[1].partyType,'grain_party');assert.equal(p[1].partyId,'P1');
assert.equal(p[0].debit,p[1].credit,'balanced');
// Zero -> no lines; no party -> throws (not silent)
assert.deepEqual(lines({farmerId:'F1',amount:0,memo:'x'}),[]);
assert.throws(()=>lines({amount:10,memo:'x'}));
assert.equal(grainPayableParty({}),null);

// Action: payable posting is no longer gated on wallet, and errors are surfaced
const action=fs.readFileSync('src/actions/grain-procurement.ts','utf8');
assert.ok(action.includes('grainPayableJournalLines('));
assert.ok(!action.includes('postWalletMovement('),'old wallet-gated posting removed');
assert.ok(action.includes('if ("error" in payablePosted)'),'payable failure returns error');
assert.ok(action.indexOf('const payableLines')<action.indexOf('getGrainProductId(supabase, grainType)'));

// Migration 524
const files=fs.readdirSync('supabase/migrations');
assert.equal(files.filter(n=>n.startsWith('524_')).length,1);
const sql=fs.readFileSync('supabase/migrations/524_grain_payable_khata.sql','utf8');
assert.match(sql,/'account', '2040', 'debit', v_amount/);
assert.ok(!/'account', '5020', 'debit'/.test(sql),'payment no longer debits 5020');
assert.match(sql,/else 'grain_party' end/);
assert.match(sql,/fn_party_combined_ledger/);
assert.match(sql,/l\.account_code in \('1150', '2040'\)/);
assert.match(sql,/customers c where c\.id = p_customer/);
assert.match(sql,/fn_grain_payments_missing_journal/);
assert.equal((sql.match(/journal_entry_id is null/g)||[]).length,2);
assert.ok(!/\b(delete from|drop table|truncate|update journal_)/i.test(sql),'additive only');

// Statement page uses combined khata with fallback
const page=fs.readFileSync('src/app/admin/crm/[id]/statement/page.tsx','utf8');
assert.ok(page.includes('fn_party_combined_ledger')&&page.includes('fn_customer_ledger'));
console.log('grain-payable-khata: ok');
