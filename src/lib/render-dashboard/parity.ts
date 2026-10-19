/**
 * "New look" (Render) owner dashboard -- PARITY REGISTRY.
 *
 * Malik ki shart: *"is dashboard sy hamra koi data missing ni hona
 * chiaye"*. Purane Command Center ka har card / KPI / chart / list /
 * link yahan darj hai, aur naye view mein `data-parity="<id>"` ke sath
 * maujood hona zaroori hai (tests/render-dashboard-parity.cjs check karta hai).
 * Data source dono views mein BILKUL wohi hai -- page.tsx ek hi dafa load
 * karta hai aur wohi variables dono ko deta hai.
 */
export interface ParityItem {
  id: string;
  /** Purane dashboard par title / label. */
  old: string;
  /** Data source (wohi jo purana use karta hai). */
  source: string;
  /** Naye view mein kahan. */
  where: string;
}

export const PARITY_ITEMS: ParityItem[] = [
  { id: "header-home-link", old: "AgriBridge OS Home (link)", source: "static link /admin/my-home", where: "Top bar, right" },
  { id: "live-refresh", old: "LiveRefresh (realtime)", source: "LiveRefresh tables pos_sales, company_expense_requests, labour_work_entries, party_settlements, whatsapp_submissions, journal_entries, finance_transactions", where: "Top bar, right" },
  { id: "staff-motivation", old: "StaffMotivationCard", source: "fn_recalc_score + fn_score_for", where: "Hero strip under top bar" },
  { id: "daily-sales-breakdown", old: "Pichli sale ka khulasa + Dukan chunein", source: "DailySalesBreakdown (7d) + SalesShopSelect, shops table", where: "Main column, 'Aaj / Kal / 7 din' card" },
  { id: "kpi-today-sales", old: "Today Sales", source: "loadMoneyToday().revenue", where: "Metric rail #1 (+sparkline from loadSalesTrend)" },
  { id: "kpi-today-expenses", old: "Today Expenses", source: "loadMoneyToday().expenses", where: "Metric rail #2" },
  { id: "kpi-net-position", old: "Net Position", source: "loadMoneyToday().net", where: "Metric rail #3 (red if < 0)" },
  { id: "kpi-cash-position", old: "Cash Position", source: "loadMoneyToday().cash", where: "Metric rail #4" },
  { id: "kpi-receivables", old: "Receivables", source: "loadMoneyToday().receivable", where: "Metric rail #5" },
  { id: "kpi-payables", old: "Payables", source: "loadMoneyToday().payable", where: "Metric rail #6" },
  { id: "dept-overview", old: "Department Overview (revenue/cost/P&L/pending/incomplete per dept)", source: "loadDeptKpis()", where: "Main column, department tiles" },
  { id: "sales-trend", old: "Sales Trend (Last 30 Days)", source: "loadSalesTrend()", where: "Hero area chart (7D/14D/30D, crosshair)" },
  { id: "sales-by-dept", old: "Sales by Department (MTD) donut", source: "loadDeptKpis().revenue", where: "Animated donut card" },
  { id: "financial-position", old: "Financial Position bars", source: "loadMoneyToday() cash/receivable/payable", where: "Financial Position card (animated bars)" },
  { id: "entities", old: "Business Structure & Parties (6 counts)", source: "count(branches, shops, farmers, suppliers, dealers, buyers)", where: "Parties card" },
  { id: "control-compliance", old: "Control & Compliance (6 links + pending count)", source: "loadAlerts() non-green count", where: "Control card + Approvals gauge" },
  { id: "bridge-ai", old: "Abram (4 links)", source: "static links", where: "Abram card" },
  { id: "book-totals", old: "Department Book Totals (revenue/cost/net/attention/margin/excluded)", source: "deptTotals(loadDeptKpis())", where: "Book totals card + Margin gauge" },
  { id: "branch-performance", old: "Branch Performance table", source: "loadBranchPerformance()", where: "Right rail" },
  { id: "top-shops", old: "Top Shops (MTD) table", source: "loadTopShops()", where: "Right rail" },
  { id: "attention-queue", old: "Attention Queue (top 4 alerts)", source: "loadAlerts()", where: "Right rail" },
  { id: "management-insight", old: "Management Insight (top 3 lines)", source: "conclude(loadDeptKpis())", where: "'Aaj ki khabar' card (highlighted phrases)" },
  { id: "quick-control", old: "Quick Control (4 links)", source: "static links", where: "Right rail" },
  { id: "rule-footnote", old: "Rule: sirf real system data footnote", source: "static", where: "Footer" },
];
