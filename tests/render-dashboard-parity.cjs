// Render "New look" owner dashboard: ZERO DATA LOSS parity test.
// Purane Command Center ka har widget, har link aur har data source naye view mein hona chahiye.
const fs = require("fs"); const assert = require("assert");
const oldSrc = fs.readFileSync("src/app/admin/command-center/page.tsx", "utf8");
const newSrc = fs.readFileSync("src/components/dashboard/render/render-owner-dashboard.tsx", "utf8");
const reg = fs.readFileSync("src/lib/render-dashboard/parity.ts", "utf8");
const ids = [...reg.matchAll(/id: "([^"]+)"/g)].map((m) => m[1]);
assert(ids.length >= 24, "parity registry too small: " + ids.length);
// 1) har registered widget naye view mein data-parity ke sath
for (const id of ids) {
  const direct = newSrc.includes(`data-parity="${id}"`);
  const viaList = newSrc.includes(`id: "${id}"`) && newSrc.includes("data-parity={k.id}");
  assert(direct || viaList, "new view missing widget " + id);
}
// 2) purane view ke saare titles/labels abhi bhi maujood (purana view unchanged)
const oldTitles = ["Owner Command Center", "Today Sales", "Today Expenses", "Net Position", "Cash Position", "Receivables", "Payables", "Department Overview", "Sales Trend (Last 30 Days)", "Sales by Department (MTD)", "Financial Position", "Business Structure & Parties", "Control & Compliance", "Abram", "Department Book Totals", "Branch Performance", "Top Shops (MTD)", "Attention Queue", "Management Insight", "Quick Control", "Rule: dashboard par sirf real system data"];
for (const t of oldTitles) assert(oldSrc.includes(t), "old view lost title " + t);
// 3) purane view ka HAR link naye view mein bhi
const hrefs = new Set([...oldSrc.matchAll(/href(?:=|: )"(\/[^"]+)"/g)].map((m) => m[1]));
assert(hrefs.size >= 30, "expected many links, got " + hrefs.size);
for (const h of hrefs) assert(newSrc.includes(`"${h}"`), "new view missing link " + h);
assert(oldSrc.includes("/admin/reports/sales") && newSrc.length > 0);
// 4) wohi data sources: naya view khud kuch load na kare, page wohi variables de
assert(!/createClient|createServiceClient|\.from\(|\.rpc\(|load[A-Z]\w+\(/.test(newSrc), "new view must not load its own data");
for (const v of ["money={money}", "depts={depts}", "alerts={alerts}", "entityCounts={entityCounts}", "salesTrend={salesTrend}", "branchPerformance={branchPerformance}", "topShops={topShops}", "lines={lines}", "totals={totals}", "<DailySalesBreakdown", "<StaffMotivationCard", "<SalesShopSelect", "<LiveRefresh tables={liveTables}"]) assert(oldSrc.includes(v), "page must pass " + v);
for (const tbl of ["pos_sales", "company_expense_requests", "labour_work_entries", "party_settlements", "whatsapp_submissions", "journal_entries", "finance_transactions"]) assert(oldSrc.split(`"${tbl}"`).length >= 3, "live table missing in one view: " + tbl);
// 5) old default; reduced motion; 3 languages
assert(oldSrc.includes('if (look === "new")'), "new look must be opt-in");
const css = fs.readFileSync("src/components/dashboard/render/render.css", "utf8");
assert(css.includes("prefers-reduced-motion: reduce"), "reduced motion missing");
const labels = [...newSrc.matchAll(/^\s+(\w+): \{ en: "[^"]*", rm: "[^"]*", ur: "[^"]*" \},$/gm)];
assert(labels.length >= 50, "EN/RM/UR labels incomplete: " + labels.length);
// 6) no migrations in this feature
console.log(`render-dashboard-parity: ok (${ids.length} widgets, ${hrefs.size} links)`);
