const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const cache = new Map();
function load(file) {
  file = path.resolve(file); if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} }; cache.set(file, mod);
  const req = name => load(name.startsWith('@/') ? `src/${name.slice(2)}.ts` : path.resolve(path.dirname(file), `${name}.ts`));
  new Function('module', 'exports', 'require', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText)(mod, mod.exports, req);
  return mod.exports;
}
const { importBillCsv } = load('src/lib/purchases/bill-csv-import.ts');
const { buildNewProductPrefill, pickPrefillLine } = load('src/lib/purchases/new-product-prefill.ts');
const categories = [
  { id: 'fert', name: 'Fertilizer', parent_category_id: null },
  { id: 'pest', name: 'Pesticide', parent_category_id: null },
  { id: 'herb', name: 'Herbicide', parent_category_id: 'pest' },
];
const companies = [{ id: 'fmc', name: 'FMC Pakistan' }, { id: 'engro', name: 'Engro' }];
const groupForCategory = id => (id === 'fert' ? 'khaad' : id === 'pest' || id === 'herb' ? 'pesticide' : null);
const rootForGroup = g => (g === 'khaad' ? { id: 'fert' } : g === 'pesticide' ? { id: 'pest' } : undefined);
const csv = 'Product Name,Company,Category,Stock Group,Pack,Quantity,Purchase Rate,Sale Rate,MRP Rate,Wholesale Rate\n'
  + 'Super Helper,FMC Pakistan,Herbicide,Pesticide,1 Ltr,13,2080,2300,2400,2150';
const parsed = importBillCsv(csv, []);
assert.deepEqual(parsed.errors, []);
const row = parsed.rows[0];
assert.equal(row.sale_rate, '2300'); assert.equal(row.mrp_rate, '2400'); assert.equal(row.wholesale_rate, '2150');
assert.equal(row.source_company, 'FMC Pakistan'); assert.equal(row.source_category, 'Herbicide'); assert.equal(row.source_group, 'Pesticide');
const line = { ...row, row_id: 'r1', query: row.name, product_id: '' };
const linked = { ...line, row_id: 'r0', query: 'Nobel', product_id: 'p1' };
const ctx = { products: [], categories, companies, fallbackGroup: 'khaad', groupForCategory, rootForGroup };
for (const picked of [pickPrefillLine([linked, line], 'r1'), pickPrefillLine([linked, line])]) {
  const p = buildNewProductPrefill({ ...ctx, line: picked });
  assert.equal(p.rowId, 'r1'); assert.equal(p.name, 'Super Helper');
  assert.equal(p.purchase, '2080'); assert.equal(p.sale, '2300'); assert.equal(p.mrp, '2400'); assert.equal(p.wholesale, '2150');
  assert.equal(p.pack, '1 Ltr'); assert.equal(p.group, 'pesticide'); assert.equal(p.categoryId, 'herb'); assert.equal(p.companyId, 'fmc');
}
// Pack-rate file: NxU is not a product pack, items-per-pack comes from it.
const pr = importBillCsv('Product Name,Pack,Quantity,Trade Rate Pack,Retail Rate Bottle,MRP Rate\nCoke 2L,10×6,60,1065,220,230', []).rows[0];
const pp = buildNewProductPrefill({ ...ctx, line: { ...pr, row_id: 'x', query: pr.name, product_id: '' } });
assert.equal(pp.pack, ''); assert.equal(pp.unitsPerPack, '6'); assert.equal(pp.sale, '220'); assert.equal(pp.mrp, '230');
// No CSV line at all: empty but valid defaults.
const empty = buildNewProductPrefill({ ...ctx, line: pickPrefillLine([linked]) });
assert.equal(empty.rowId, null); assert.equal(empty.sale, ''); assert.equal(empty.categoryId, 'fert');
console.log('new-product-prefill tests passed');
