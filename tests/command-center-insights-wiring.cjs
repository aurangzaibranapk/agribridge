// Wiring: mojooda widgets bache rahein, naye hisse lage hon, owner-only, reduced motion, koi migration nahi.
const fs = require("fs");
const assert = require("assert");
const page = fs.readFileSync("src/app/admin/command-center/page.tsx", "utf8");
for (const keep of ["Department Overview", "Sales Trend (Last 30 Days)", "Sales by Department (MTD)", "Financial Position", "Branch Performance", "Top Shops (MTD)", "Attention Queue", "Quick Control", "RenderOwnerDashboard", "DailySalesBreakdown", "LiveRefresh", "OWNER_ROLES.includes(me.role)"]) {
  assert.ok(page.includes(keep), `mojooda hissa gayab: ${keep}`);
}
for (const add of ["InsightsFilters", "InsightsKpis", "InsightsTrendAndFeed", "InsightsGrid", "ThemeToggle", "parseInsightFilters"]) assert.ok(page.includes(add), `naya hissa nahi laga: ${add}`);
// Role check naye data se pehle
assert.ok(page.indexOf("OWNER_ROLES.includes(me.role)") < page.indexOf("loadInsights("), "role check pehle");
// pos_sales realtime list mein
assert.ok(/liveTables = \[[^\]]*"pos_sales"/.test(page));
const client = fs.readFileSync("src/components/dashboard/insights/insights-client.tsx", "utf8");
assert.ok(client.includes("prefers-reduced-motion: reduce"));
assert.ok(client.includes("isAnimationActive={!reduced}"));
for (const tf of ["live", "aaj", "7d", "30d", "1y"]) assert.ok(client.includes(`"${tf}"`) || client.includes(`${tf}:`), tf);
const lib = fs.readFileSync("src/lib/command-center-insights.ts", "utf8");
assert.ok(lib.includes("shop_allowed_categories"), "dukan ki category ijazat");
assert.ok(!/\.(insert|update|delete|upsert)\(/.test(lib), "sirf parhna");
assert.ok(!fs.readdirSync("supabase/migrations").some((f) => f.startsWith("688")), "koi migration nahi");
console.log("command-center-insights-wiring: ok");
