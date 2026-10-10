const assert = require("assert");

function shouldApplyTransfer({ status, oldStatus, existingMovements }) {
  if (status !== "completed" || oldStatus === "completed") return false;
  if (existingMovements > 0) return false;
  return true;
}

assert.equal(shouldApplyTransfer({ status: "completed", oldStatus: "in_transit", existingMovements: 0 }), true);
assert.equal(shouldApplyTransfer({ status: "completed", oldStatus: "in_transit", existingMovements: 2 }), false);
assert.equal(shouldApplyTransfer({ status: "completed", oldStatus: "completed", existingMovements: 0 }), false);
assert.equal(shouldApplyTransfer({ status: "in_transit", oldStatus: "pending", existingMovements: 0 }), false);
console.log("transfer apply once: theek");
