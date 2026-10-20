const assert = require("assert");
const fs = require("fs");
const s = fs.readFileSync(require("path").join(__dirname, "..", "src/lib/access/my-work.ts"), "utf8");
// products table mein status column nahi hai (live 400: column products.status does not exist).
assert.ok(!/count\("products",[^\n]*"status"/.test(s), "products ko status se na ginein");
assert.match(s, /count\("products", \(q\) => q\.eq\("is_deleted", false\)\.eq\("is_available", true\)\)/, "active products = is_deleted false + is_available");
console.log("my-work products count: theek");
