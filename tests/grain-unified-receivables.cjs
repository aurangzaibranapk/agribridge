// Guards: grain_sale_payments has no buyer_id column; buyer must come via grain_sales.
const fs = require("fs"); const assert = require("assert");
const s = fs.readFileSync("src/app/admin/grain-procurement/unified/page.tsx", "utf8");
assert(!/sp\.buyer_id/.test(s), "must not read buyer_id off a payment row");
assert(/grain_sale_payments"\)\.select\("amount, sale_id, grain_sales\(buyer_id, buyers\(business_name\)\)"\)/.test(s), "payments query must join through grain_sales");
console.log("grain-unified-receivables: ok");
