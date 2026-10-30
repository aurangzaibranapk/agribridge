const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const out = ts.transpileModule(fs.readFileSync('src/lib/pos/stock-availability.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const mod={exports:{}}; new Function('require','module','exports',out)(require,mod,mod.exports);
const { isOutOfStock, canAddToCart, sortInStockFirst, POS_ALLOW_NEGATIVE_STOCK, maxSelectableQty, stockLimitMessage, lineStockUnits, exceedsSellable, sellableFromLots, isBatchSellable, todayPkt } = mod.exports;
assert.equal(POS_ALLOW_NEGATIVE_STOCK,false);
assert.equal(isOutOfStock({stock_quantity:0}),true);
assert.equal(isOutOfStock({stock_quantity:null}),true);
assert.equal(isOutOfStock({stock_quantity:-2}),true);
assert.equal(isOutOfStock({stock_quantity:3}),false);
assert.equal(canAddToCart({stock_quantity:0}),false,'zero stock blocked by default');
assert.equal(canAddToCart({stock_quantity:0},true),true,'negative-stock setting allows');
assert.equal(canAddToCart({stock_quantity:5}),true);
const s=sortInStockFirst([{n:'a',stock_quantity:0},{n:'b',stock_quantity:2},{n:'c',stock_quantity:0},{n:'d',stock_quantity:1}]);
assert.deepEqual(s.map(x=>x.n),['b','d','a','c']);
const page=fs.readFileSync('src/app/admin/pos/page.tsx','utf8');
assert.ok(!/\.eq\("warehouse_id", warehouseId\)\s*\.gt\("quantity_on_hand", 0\)/.test(page),'POS must load zero-stock rows');
assert.ok(page.includes('sellableFromLots'), 'POS stock badge uses sellable shop stock');
const client=fs.readFileSync('src/components/pos/pos-client.tsx','utf8');
assert.ok(client.includes('Out of stock / Stock khatam') && client.includes('canAddToCart(item)') && client.includes('Demand'));
assert.ok(client.includes('maxSelectableQty') && client.includes('function updateQuantity') && client.includes('cap.max'), 'click, stepper, and typed qty share the cap');
const action=fs.readFileSync('src/actions/pos.ts','utf8');
assert.ok(action.includes('checkSellableStock') && action.includes('sellableFromLots'), 'checkout refuses qty above sellable stock');

assert.equal(maxSelectableQty(0), 0);
assert.equal(maxSelectableQty(1), 1);
assert.equal(maxSelectableQty(1.9), 1);
assert.equal(maxSelectableQty(null), 0);
assert.equal(maxSelectableQty(5, { allowNegative: true }), Infinity);
assert.equal(maxSelectableQty(24, { carton: true, unitsPerPack: 12 }), 2);
assert.equal(maxSelectableQty(5, { carton: true, unitsPerPack: 12 }), 0, 'partial PET is not selectable');
assert.equal(lineStockUnits({ quantity: 2, unitPrice: 100, saleUnit: 'carton', unitsPerPack: 12, sellingPrice: 10 }), 24);
assert.equal(lineStockUnits({ quantity: 21, unitPrice: 30, saleUnit: 'unit', unitsPerPack: 1, sellingPrice: 20 }), 21);
assert.equal(exceedsSellable({ quantity: 21, unitPrice: 30, saleUnit: 'unit', unitsPerPack: 1, sellingPrice: 20, sellableBottles: 1 }), true);
assert.equal(exceedsSellable({ quantity: 1, unitPrice: 30, saleUnit: 'unit', unitsPerPack: 1, sellingPrice: 20, sellableBottles: 1 }), false);
assert.match(stockLimitMessage('Gengwei', 1), /sirf 1 hai/);
assert.match(stockLimitMessage('Gengwei', 0), /Out of stock/);
assert.match(stockLimitMessage('White Salt', 5, { carton: true, unitsPerPack: 12 }), /Not enough stock/);

const today = '2026-10-30';
assert.equal(isBatchSellable(null, today), true);
assert.equal(isBatchSellable('2026-10-30', today), true);
assert.equal(isBatchSellable('2026-10-29', today), false);
const expiry = new Map([['exp', '2026-01-01'], ['ok', '2026-12-01']]);
const mixed = sellableFromLots(
  [
    { batch_id: 'exp', quantity_on_hand: 20 },
    { batch_id: 'ok', quantity_on_hand: 1 },
    { batch_id: null, quantity_on_hand: 0 },
  ],
  expiry,
  today
);
assert.equal(mixed.sellable, 1, 'expired bottles are not sellable');
assert.equal(mixed.expiredQty, 20);
assert.equal(mixed.sellableExpiry, '2026-12-01');
const onlyExpired = sellableFromLots([{ batch_id: 'exp', quantity_on_hand: 1 }], expiry, today);
assert.equal(onlyExpired.sellable, 0);
assert.equal(onlyExpired.expiredExpiry, '2026-01-01');
assert.match(todayPkt(new Date('2026-10-30T19:30:00Z')), /^2026-10-31$/);
console.log('PASS: POS out-of-stock visible, qty capped at sellable shop stock');
