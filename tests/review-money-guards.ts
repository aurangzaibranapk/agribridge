import assert from "node:assert/strict";
import {
  cashRefundAllowed,
  cashRefundCap,
  discountOverCap,
  duplicatePhoneName,
  expectedPosUnitPrice,
  farmerCreditNeedsOverride,
  makerIsNotChecker,
  marginAllowed,
  phoneDuplicateKey,
  posCreditExceeds,
  priceMatchesCatalog,
  shopBillExpenseAccount,
} from "../src/lib/money/review-guards";

assert.equal(discountOverCap(10000, 500), false);
assert.equal(discountOverCap(10000, 501), true);
assert.equal(discountOverCap(1000, 60), true);
assert.equal(discountOverCap(1000, 50), false);
assert.equal(discountOverCap(0, 0), false);

assert.equal(cashRefundCap(1000, 400), 600);
assert.equal(cashRefundAllowed(1000, 400, 600), true);
assert.equal(cashRefundAllowed(1000, 400, 601), false);

assert.equal(posCreditExceeds(100, null, 50), false);
assert.equal(posCreditExceeds(100, 0, 50), false);
assert.equal(posCreditExceeds(100, 120, 30), true);

assert.equal(farmerCreditNeedsOverride(null, 0, 10), true);
assert.equal(farmerCreditNeedsOverride(0, 0, 10), true);
assert.equal(farmerCreditNeedsOverride(100, 80, 10), false);
assert.equal(farmerCreditNeedsOverride(100, 95, 10), true);

assert.equal(marginAllowed(0), true);
assert.equal(marginAllowed(25), true);
assert.equal(marginAllowed(25.01), false);
assert.equal(marginAllowed(-1), false);

assert.equal(makerIsNotChecker("a", "a"), false);
assert.equal(makerIsNotChecker("a", "a", "manager"), false);
assert.equal(makerIsNotChecker("a", "a", "admin"), true);
assert.equal(makerIsNotChecker("a", "a", "owner"), true);
assert.equal(makerIsNotChecker("a", "b"), true);
assert.equal(makerIsNotChecker(null, "b"), true);
assert.equal(makerIsNotChecker("a", null), false);

assert.equal(expectedPosUnitPrice({ sellingPrice: 100, wholesalePrice: 80, wholesaleCustomer: true }), 80);
assert.equal(expectedPosUnitPrice({ sellingPrice: 100, wholesalePrice: 0, wholesaleCustomer: true }), 100);
assert.equal(expectedPosUnitPrice({ sellingPrice: 100, wholesalePrice: 80, wholesaleCustomer: false }), 100);
assert.equal(priceMatchesCatalog(80, 80.004), true);
assert.equal(priceMatchesCatalog(90, 80), false);

assert.equal(shopBillExpenseAccount("Shop rent"), "6030");
assert.equal(shopBillExpenseAccount("Bijli"), "6040");
assert.equal(shopBillExpenseAccount("Other"), "6090");

assert.equal(phoneDuplicateKey(""), null);
assert.equal(phoneDuplicateKey("0343"), null);
assert.equal(phoneDuplicateKey("03438796385"), "923438796385");
assert.equal(phoneDuplicateKey("+92 343 8796385"), "923438796385");
assert.equal(
  duplicatePhoneName(
    [
      { id: "1", name: "Sial", phone_number: "03438796385" },
      { id: "2", name: "Blank", phone_number: "" },
    ],
    "923438796385",
    "2",
  ),
  "Sial",
);
assert.equal(duplicatePhoneName([{ id: "1", name: "Sial", phone_number: "03438796385" }], "923438796385", "1"), null);
assert.equal(duplicatePhoneName([{ id: "1", name: "A", phone_number: "" }], "", null), null);

console.log("review money guards: theek");
