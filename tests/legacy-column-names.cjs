// Live schema guard: ye column live par maujood nahi (16 Oct 2026 ki jaanch).
//   bridge_orders: dealer_id -> assigned_dealer_id, created_at -> placed_at
//   produce_orders: created_at -> placed_at
//   products: is_active nahi -> is_deleted = false
// Chalane ka tareeqa: node tests/legacy-column-names.cjs
const fs = require("fs");
const path = require("path");
const RULES = [
  { table: "bridge_orders", bad: /\b(?<!assigned_)dealer_id\b|\bcreated_at\b/ },
  { table: "produce_orders", bad: /\bcreated_at\b/ },
  { table: "products", bad: /\bis_active\b/ },
];
function walk(d, out = []) {
  for (const n of fs.readdirSync(d)) {
    const p = path.join(d, n);
    if (fs.statSync(p).isDirectory()) { if (n !== "node_modules") walk(p, out); }
    else if (/\.(ts|tsx)$/.test(p) && !p.includes("database.types")) out.push(p);
  }
  return out;
}
const problems = [];
for (const f of walk("src")) {
  const src = fs.readFileSync(f, "utf8");
  // Har .from("x") se agle .from( / ; tak ka query chain
  const re = /\.from\("([a-z_]+)"\)([\s\S]*?)(?=\.from\(|;)/g;
  let m;
  while ((m = re.exec(src))) {
    const rule = RULES.find((r) => r.table === m[1]);
    if (!rule) continue;
    const chain = m[2].replace(/\.insert\([\s\S]*$/, "");
    const hit = chain.match(rule.bad);
    if (hit) problems.push(`${f}: ${m[1]}.${hit[0]}`);
  }
  // farmers par `phone` nahi -- `phone_number` hai (embedded select bhi).
  for (const e of src.matchAll(/farmers!?[a-z_]*\(([^)]*)\)/g)) if (/\bphone\b/.test(e[1])) problems.push(`${f}: farmers.phone (use phone_number)`);
}
if (problems.length) { console.error("GHALAT COLUMN:\n  " + problems.join("\n  ")); process.exit(1); }
console.log("legacy column names: theek");
