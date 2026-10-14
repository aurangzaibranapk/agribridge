const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const posPage = read("src/app/admin/pos/page.tsx");
const products = read("src/actions/products.ts");
const intake = read("src/actions/product-intake.ts");
const migration = read("supabase/migrations/20261014091708_repair_zero_sale_rate_flags.sql");

assert.match(
  posPage,
  /sale_rate_pending \|\| Number\(product\?\.selling_price \?\? 0\) <= 0/,
  "POS must hide a product when its sale rate is pending or non-positive",
);
assert.match(
  posPage,
  /rateBaqiProductIds\.add\(row\.product_id\)/,
  "POS must count missing rates once per product, not once per stock batch",
);
assert.match(
  products,
  /sale_rate_pending: input\.sellingPrice == null \|\| input\.sellingPrice <= 0/,
  "Quick-created products must mark a missing/zero sale rate as pending",
);
assert.match(
  intake,
  /sale_rate_pending: r\.selling_price == null \|\| Number\(r\.selling_price\) <= 0/,
  "Approved intake products must mark a missing/zero sale rate as pending",
);
assert.match(
  migration,
  /where coalesce\(selling_price, 0\) <= 0\s+and sale_rate_pending = false/,
  "Migration must repair historical zero-rate products",
);
assert.match(
  migration,
  /products_zero_sale_rate_must_be_pending/,
  "Database must prevent zero-rate products from being marked complete again",
);

console.log("POS sale-rate guard checks passed.");
