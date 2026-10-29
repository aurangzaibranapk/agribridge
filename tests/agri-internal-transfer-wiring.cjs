const assert = require("assert");
const fs = require("fs");
const path = require("path");
const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

const grn = read("src/actions/agri-grn.ts");
assert.match(grn, /planAgriInternalReceipt/);
assert.match(grn, /receiptJournalLines/);
assert.match(grn, /sourceModule: "agri_grn"/);
assert.match(grn, /grnPayable/);
assert.ok(!grn.includes("item.unit_price + item.unit_price * chargeRatio"), "GRN batch ab order price par nahi");

const movement = read("src/lib/stock-movement.ts");
assert.match(movement, /issueJournalLines/);
assert.ok(!movement.includes("ACC.cogs"), "COGS lines ab transfer helper mein");

const dispatch = read("src/actions/agri-dispatch.ts");
assert.match(dispatch, /journalSourceModule: "agri_dispatch"/);
assert.match(dispatch, /outType: "transfer_out"/);

console.log("agri internal transfer wiring ok");
