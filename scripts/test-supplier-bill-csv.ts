import assert from "node:assert/strict";
import { importBillCsv } from "../src/lib/purchases/bill-csv-import";

const products = [
  { id: "coke-2l", name: "Coke 2L", product_code: "110557", pack_size: "2L", unit: "Bottle", units_per_pack: 6 },
];

const csv = [
  "Code,Product Name,Expiry Date,Pack/QUENTI,Quantity,Trade rate pack,Wholesale rate pack,Retail rate botal,Mrp rate,Amount",
  "110557,Coke 2L,08-04-2027,10×6,60,1065.37,1090,220,230,10653.7",
].join("\n");

const result = importBillCsv(csv, products);
assert.deepEqual(result.errors, []);
assert.equal(result.rows.length, 1);
assert.equal(result.rows[0].sourceCode, "110557");
assert.equal(result.rows[0].systemCode, "110557");
assert.equal(result.rows[0].product_id, "coke-2l");
assert.equal(result.rows[0].quantity, "10");
assert.equal(result.rows[0].units_per_pack_override, "6");
assert.equal(result.rows[0].unit_cost, "1065.37");
assert.equal(result.rows[0].wholesale_rate, "1090");
assert.equal(result.rows[0].sale_rate, "220");
assert.equal(result.rows[0].mrp_rate, "230");
assert.equal(result.rows[0].expiry_date, "2027-04-08");
assert.equal(result.rows[0].lineTotal, 10653.7);

console.log("Supplier bill CSV auto-fill test passed.");
