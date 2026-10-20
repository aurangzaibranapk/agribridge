const assert = require("assert");
const fs = require("fs");
const path = require("path");
const dir = path.join(__dirname, "..", "supabase", "migrations");
const strip = (s) => s.replace(/--[^\n]*/g, "");
for (const f of fs.readdirSync(dir)) {
  const n = parseInt(f, 10);
  if (!(n >= 624 && n <= 699)) continue;
  const s = strip(fs.readFileSync(path.join(dir, f), "utf8"));
  assert.ok(!/create\s+or\s+replace\s+function\s+(public\.)?fn_phone_key\b/i.test(s), `${f}: fn_phone_key dobara na banayein (124 wali 10 hindse rakhein)`);
  assert.ok(!/drop\s+function\s+(if\s+exists\s+)?(public\.)?fn_phone_key\b/i.test(s), `${f}: fn_phone_key drop na karein (farmers.phone_key us par chalta hai)`);
}
const m124 = fs.readFileSync(path.join(dir, "124_farmer_master.sql"), "utf8");
assert.match(m124, /fn_phone_key\(p_phone text\)/, "124 asal fn_phone_key(p_phone)");
console.log("migration 631 phone key: theek");
// 641: index predicate mein enum::text (STABLE) mana hai — live par 42P17.
const m641 = strip(fs.readFileSync(path.join(dir, "641_finance_maker_checker_and_indexes.sql"), "utf8"));
assert.ok(!/transaction_type::text\s*=\s*'income'/.test(m641), "641 index predicate immutable ho");
console.log("migration 641 predicate: theek");
