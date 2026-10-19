# Render "New look" — parity inventory (Owner Command Center `/admin/command-center`)
Old view = default, unchanged (only a Classic/New look toggle added in its header). New view gets the SAME loaded variables from page.tsx — it loads nothing itself (enforced by test).

| # | Old widget | Live data source | New location | Status |
|---|---|---|---|---|
| 1 | AgriBridge OS Home (link) | static link /admin/my-home | Top bar, right | ✅ |
| 2 | LiveRefresh (realtime) | LiveRefresh tables pos_sales, company_expense_requests, labour_work_entries, party_settlements, whatsapp_submissions, journal_entries, finance_transactions | Top bar, right | ✅ |
| 3 | StaffMotivationCard | fn_recalc_score + fn_score_for | Hero strip under top bar | ✅ |
| 4 | Pichli sale ka khulasa + Dukan chunein | DailySalesBreakdown (7d) + SalesShopSelect, shops table | Main column, 'Aaj / Kal / 7 din' card | ✅ |
| 5 | Today Sales | loadMoneyToday().revenue | Metric rail #1 (+sparkline from loadSalesTrend) | ✅ |
| 6 | Today Expenses | loadMoneyToday().expenses | Metric rail #2 | ✅ |
| 7 | Net Position | loadMoneyToday().net | Metric rail #3 (red if < 0) | ✅ |
| 8 | Cash Position | loadMoneyToday().cash | Metric rail #4 | ✅ |
| 9 | Receivables | loadMoneyToday().receivable | Metric rail #5 | ✅ |
| 10 | Payables | loadMoneyToday().payable | Metric rail #6 | ✅ |
| 11 | Department Overview (revenue/cost/P&L/pending/incomplete per dept) | loadDeptKpis() | Main column, department tiles | ✅ |
| 12 | Sales Trend (Last 30 Days) | loadSalesTrend() | Hero area chart (7D/14D/30D, crosshair) | ✅ |
| 13 | Sales by Department (MTD) donut | loadDeptKpis().revenue | Animated donut card | ✅ |
| 14 | Financial Position bars | loadMoneyToday() cash/receivable/payable | Financial Position card (animated bars) | ✅ |
| 15 | Business Structure & Parties (6 counts) | count(branches, shops, farmers, suppliers, dealers, buyers) | Parties card | ✅ |
| 16 | Control & Compliance (6 links + pending count) | loadAlerts() non-green count | Control card + Approvals gauge | ✅ |
| 17 | Abram (4 links) | static links | Abram card | ✅ |
| 18 | Department Book Totals (revenue/cost/net/attention/margin/excluded) | deptTotals(loadDeptKpis()) | Book totals card + Margin gauge | ✅ |
| 19 | Branch Performance table | loadBranchPerformance() | Right rail | ✅ |
| 20 | Top Shops (MTD) table | loadTopShops() | Right rail | ✅ |
| 21 | Attention Queue (top 4 alerts) | loadAlerts() | Right rail | ✅ |
| 22 | Management Insight (top 3 lines) | conclude(loadDeptKpis()) | 'Aaj ki khabar' card (highlighted phrases) | ✅ |
| 23 | Quick Control (4 links) | static links | Right rail | ✅ |
| 24 | Rule: sirf real system data footnote | static | Footer | ✅ |

All 30 links of the old page (incl. per-dept links, /admin/master-dashboard, /admin/reports/sales via DailySalesBreakdown) are present in the new view — checked by `tests/render-dashboard-parity.cjs`.
Added (no new data): Health gauges (Margin %, Pending approvals, Attention) reuse totals/alerts. 
Not in phase 1 (would need data not on the current dashboard): stock-value treemap, recovery % gauge, 1M/3M/1Y/All ranges (current source has 30 days → 7D/14D/30D).
