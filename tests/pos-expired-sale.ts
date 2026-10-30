import assert from "node:assert/strict";
import {
  cartHasExpiredBatch,
  expiredBatchSaleBlockMessage,
  expiryIsPast,
  isExpiredBatchSaleBlock,
  pktDay,
} from "../src/lib/pos/expired-sale";

const msg = expiredBatchSaleBlockMessage("SB-2026-007");
assert.match(msg, /SB-2026-007/);
assert.match(msg, /stock mein show ho rahi hai/);
assert.match(msg, /physically side-line/);
assert.match(msg, /nuqsan/);
assert.match(msg, /admin ka code lagayein/);
assert.equal(isExpiredBatchSaleBlock(msg), true);
assert.equal(isExpiredBatchSaleBlock("Expire batch ki bikri band hai (batch SB-2026-007)."), true);
assert.equal(isExpiredBatchSaleBlock("Admin ka code ghalat hai. Expire batch ki bikri nahi hui — aur ye koshish darj kar di gayi hai."), true);
assert.equal(isExpiredBatchSaleBlock("Payment poora nahi hai."), false);
assert.equal(isExpiredBatchSaleBlock(null), false);

assert.equal(expiryIsPast("2020-01-01", "2026-10-30"), true);
assert.equal(expiryIsPast("2026-10-30", "2026-10-30"), false);
assert.equal(expiryIsPast("2099-01-01", "2026-10-30"), false);
assert.equal(expiryIsPast(null, "2026-10-30"), false);
assert.equal(expiryIsPast("not-a-date", "2026-10-30"), false);

const cart = cartHasExpiredBatch(
  [{ product_id: "p1" }, { product_id: "p2" }],
  [
    { product_id: "p1", expiry_date: "2020-01-01", batch_number: "SB-2026-007" },
    { product_id: "p2", expiry_date: "2099-01-01", batch_number: "FRESH" },
  ],
  "2026-10-30"
);
assert.equal(cart.blocked, true);
assert.deepEqual(cart.batchNumbers, ["SB-2026-007"]);

const clear = cartHasExpiredBatch(
  [{ product_id: "p2" }],
  [{ product_id: "p2", expiry_date: "2099-01-01", batch_number: "FRESH" }],
  "2026-10-30"
);
assert.equal(clear.blocked, false);

const day = pktDay(new Date("2026-10-30T19:30:00Z"));
assert.equal(day, "2026-10-31");

console.log("pos expired-sale copy: theek");
