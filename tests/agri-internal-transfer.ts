import assert from "node:assert/strict";
import { ACC } from "../src/lib/ledger/rules";
import {
  internalTransferNet,
  issueJournalLines,
  planAgriInternalReceipt,
  receiptJournalLines,
  roundMoney,
} from "../src/lib/inventory/agri-internal-transfer";

// Purana raasta: dispatch Cr 1200, GRN batch order price par, 1200 debit nahi.
// Farq batch ki transfer-price value ke barabar barhta hai (23 Oct: 21,180).
function legacyGap(dispatchCost: number, receivedQty: number, orderPrice: number): number {
  const batchDelta = -dispatchCost + receivedQty * orderPrice;
  const ledgerDelta = -dispatchCost;
  return roundMoney(batchDelta - ledgerDelta);
}

const cokeOrderPrice = 200;
const coke = planAgriInternalReceipt({
  slices: [{ productId: "coke", taken: 12, cost: 12 * 120 }],
  lines: [{ lineKey: "coke", productId: "coke", receivedQty: 12, orderUnitPrice: cokeOrderPrice }],
});
assert.equal(coke.stockValue, 1440);
assert.equal(coke.lines[0].unitCost, 120);
assert.notEqual(coke.lines[0].unitCost, cokeOrderPrice);
assert.equal(legacyGap(1440, 12, cokeOrderPrice), 2400);

const egg = planAgriInternalReceipt({
  slices: [{ productId: "egg", taken: 30, cost: 600 }],
  lines: [{ lineKey: "egg", productId: "egg", receivedQty: 30, orderUnitPrice: 30 }],
});
assert.equal(egg.stockValue, 600);
assert.equal(egg.lines[0].unitCost, 20);
assert.equal(legacyGap(600, 30, 30), 900);

const bothCost = 1440 + 600;
const both = planAgriInternalReceipt({
  slices: [
    { productId: "coke", taken: 12, cost: 1440 },
    { productId: "egg", taken: 30, cost: 600 },
  ],
  lines: [
    { lineKey: "coke", productId: "coke", receivedQty: 12, orderUnitPrice: 200 },
    { lineKey: "egg", productId: "egg", receivedQty: 30, orderUnitPrice: 30 },
  ],
});
assert.equal(both.stockValue, bothCost);
assert.equal(both.fifoRecovered, bothCost);
const full = internalTransferNet(bothCost, both);
assert.equal(full.cogs5000, 0);
assert.equal(full.stock1200, 0);
assert.equal(full.batchValue, 0);
assert.equal(full.gap, 0);

const short = planAgriInternalReceipt({
  slices: [{ productId: "coke", taken: 12, cost: 1440 }],
  lines: [{ lineKey: "coke", productId: "coke", receivedQty: 10, orderUnitPrice: 200 }],
});
assert.equal(short.stockValue, 1200);
assert.equal(short.lines[0].unitCost, 120);
const shortNet = internalTransferNet(1440, short);
assert.equal(shortNet.cogs5000, 240);
assert.equal(shortNet.stock1200, -240);
assert.equal(shortNet.gap, 0);

const split = planAgriInternalReceipt({
  slices: [
    { productId: "coke", taken: 4, cost: 400 },
    { productId: "coke", taken: 6, cost: 600 },
  ],
  lines: [
    { lineKey: "a", productId: "coke", receivedQty: 6, orderUnitPrice: 999 },
    { lineKey: "b", productId: "coke", receivedQty: 4, orderUnitPrice: 999 },
  ],
});
assert.equal(split.stockValue, 1000);
assert.equal(split.lines[0].stockValue, 600);
assert.equal(split.lines[1].stockValue, 400);
assert.equal(internalTransferNet(1000, split).cogs5000, 0);
assert.equal(internalTransferNet(1000, split).gap, 0);

const dusty = planAgriInternalReceipt({
  slices: [{ productId: "coke", taken: 12, cost: 1000 }],
  lines: [{ lineKey: "coke", productId: "coke", receivedQty: 12, orderUnitPrice: 80 }],
});
assert.equal(dusty.lines[0].unitCost, 83.33);
assert.equal(dusty.stockValue, roundMoney(12 * 83.33));
assert.equal(internalTransferNet(1000, dusty).gap, 0);
assert.equal(dusty.stockValue, dusty.cogsReversal);

const withFreight = planAgriInternalReceipt({
  slices: [{ productId: "coke", taken: 10, cost: 1000 }],
  lines: [{ lineKey: "coke", productId: "coke", receivedQty: 10, orderUnitPrice: 200, freightAmount: 50 }],
});
assert.equal(withFreight.fifoRecovered, 1000);
assert.equal(withFreight.lines[0].unitCost, 105);
assert.equal(withFreight.stockValue, 1050);
const freightNet = internalTransferNet(1000, withFreight);
assert.equal(freightNet.gap, 0);
assert.equal(freightNet.stock1200, 50);
assert.equal(freightNet.cogs5000, -50);

const missingCost = planAgriInternalReceipt({
  slices: [],
  lines: [{ lineKey: "coke", productId: "coke", receivedQty: 12, orderUnitPrice: 200 }],
});
assert.equal(missingCost.fifoRecovered, 0);
assert.equal(missingCost.stockValue, 0);
assert.equal(missingCost.lines[0].unitCost, 0);

const issue = issueJournalLines(1440);
const receipt = receiptJournalLines(1440);
assert.equal(issue[0].account, ACC.cogs);
assert.equal(issue[0].debit, 1440);
assert.equal(issue[1].account, ACC.stockGoods);
assert.equal(issue[1].credit, 1440);
assert.equal(receipt[0].account, ACC.stockGoods);
assert.equal(receipt[0].debit, 1440);
assert.equal(receipt[1].account, ACC.cogs);
assert.equal(receipt[1].credit, 1440);
assert.deepEqual(issueJournalLines(0), []);
assert.deepEqual(receiptJournalLines(0), []);

console.log("agri internal transfer: 1200 matches batches, pure move has no net COGS");
