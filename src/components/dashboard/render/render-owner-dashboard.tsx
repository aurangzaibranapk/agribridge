import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, ArrowRight, Bell, Boxes, Building2, CheckCircle2, Home, Landmark, Package, Scale, Sparkles, Store, TrendingUp, Users, Wallet } from "lucide-react";
import type { Alert, DeptKpi, DeptTotals, MoneyToday, RankedRow, SalesTrendPoint } from "@/lib/command-center";
import type { Lang } from "@/lib/i18n/translations";
import { CountUp, DeptDonut, Gauge, LookToggle, SalesAreaChart, Sparkline } from "./render-islands";
import { formatRs } from "./format";
import "./render.css";

/**
 * "New look" (Render-style) Owner Command Center.
 *
 * ZERO DATA LOSS: ye component KHUD koi data load nahi karta. page.tsx
 * wohi variables (money, depts, alerts, entityCounts, salesTrend,
 * branchPerformance, topShops, lines, totals) deta hai jo purana view use
 * karta hai, aur server slots (motivation, dailySales, liveRefresh) wohi
 * purane components hain. Har purane widget ka `data-parity` id
 * `src/lib/render-dashboard/parity.ts` mein darj hai.
 */

type L3 = { en: string; rm: string; ur: string };
const L = {
  title: { en: "Owner Command Center", rm: "Owner Command Center", ur: "مالک کمانڈ سینٹر" },
  subtitle: { en: "Today's money, departments and actions — at a glance", rm: "Aaj ka paisa, departments aur zaroori kaam — ek nazar mein", ur: "آج کا پیسہ، شعبے اور ضروری کام — ایک نظر میں" },
  home: { en: "AgriBridge OS Home", rm: "AgriBridge OS Home", ur: "ایگری برج ہوم" },
  lookOld: { en: "Classic", rm: "Purana look", ur: "پرانا انداز" },
  lookNew: { en: "New look", rm: "Naya look", ur: "نیا انداز" },
  todaySales: { en: "Today Sales", rm: "Aaj ki sale", ur: "آج کی سیل" },
  todayExp: { en: "Today Expenses", rm: "Aaj ke kharche", ur: "آج کے اخراجات" },
  net: { en: "Net Position", rm: "Net position", ur: "خالص پوزیشن" },
  cash: { en: "Cash Position", rm: "Cash / Bank", ur: "نقد / بینک" },
  recv: { en: "Receivables", rm: "Udhaar (lena)", ur: "ادھار (لینا)" },
  pay: { en: "Payables", rm: "Dena (payables)", ur: "دینا" },
  daily: { en: "Recent sales summary", rm: "Pichli sale ka khulasa", ur: "پچھلی سیل کا خلاصہ" },
  trend: { en: "Sales Trend (Last 30 Days)", rm: "Sale trend (pichle 30 din)", ur: "سیل رجحان (پچھلے 30 دن)" },
  trendSub: { en: "POS sales per day", rm: "POS bikri, roz ke hisaab se", ur: "POS فروخت، روزانہ" },
  sale: { en: "Sale", rm: "Sale", ur: "سیل" },
  date: { en: "Date", rm: "Tareekh", ur: "تاریخ" },
  gauges: { en: "Health", rm: "Sehat", ur: "صحت" },
  margin: { en: "Margin", rm: "Margin", ur: "منافع شرح" },
  approvals: { en: "Pending Approvals", rm: "Pending approvals", ur: "زیر التوا منظوریاں" },
  attentionG: { en: "Attention", rm: "Tawajjo", ur: "توجہ" },
  dept: { en: "Department Overview", rm: "Department overview", ur: "شعبہ جات کا جائزہ" },
  deptSub: { en: "Current month — real departmental books", rm: "Is mahine — asal departmental books", ur: "اس مہینے — اصل کھاتے" },
  details: { en: "View details", rm: "Tafseel", ur: "تفصیل" },
  revenue: { en: "Revenue", rm: "Aamdani", ur: "آمدنی" },
  cost: { en: "Cost", rm: "Lagat", ur: "لاگت" },
  pnl: { en: "P&L", rm: "Nafa/Nuqsan", ur: "نفع/نقصان" },
  incomplete: { en: "Reconciliation incomplete", rm: "Hisaab adhoora", ur: "حساب ادھورا" },
  byDept: { en: "Sales by Department (MTD)", rm: "Department wise sale (MTD)", ur: "شعبہ وار سیل (اس ماہ)" },
  noData: { en: "No data this month yet.", rm: "Is mahine ka data abhi nahi.", ur: "اس مہینے کا ڈیٹا ابھی نہیں۔" },
  fin: { en: "Financial Position", rm: "Maali position", ur: "مالی پوزیشن" },
  finSub: { en: "Straight from the ledger", rm: "Ledger se seedha -- koi cached number nahi", ur: "لیجر سے براہ راست" },
  cashBank: { en: "Cash & Bank", rm: "Cash & Bank", ur: "نقد و بینک" },
  parties: { en: "Business Structure & Parties", rm: "Business structure & parties", ur: "کاروبار اور پارٹیاں" },
  control: { en: "Control & Compliance", rm: "Control & compliance", ur: "کنٹرول" },
  audit: { en: "Audit Center", rm: "Audit Center", ur: "آڈٹ سینٹر" },
  abram: { en: "Abram", rm: "Abram", ur: "ابرام" },
  abramSub: { en: "Suggestions, actions and human escalation", rm: "Suggestions, actions aur human escalation", ur: "تجاویز اور کام" },
  openAbram: { en: "Open Abram", rm: "Abram kholein", ur: "ابرام کھولیں" },
  book: { en: "Department Book Totals", rm: "Department book totals", ur: "شعبہ جاتی کل" },
  directCost: { en: "Direct Cost", rm: "Seedhi lagat", ur: "براہ راست لاگت" },
  netShort: { en: "Net", rm: "Net", ur: "خالص" },
  excluded: { en: "Incomplete totals excluded", rm: "Adhoore hisaab shaamil nahi", ur: "ادھورے حساب شامل نہیں" },
  branchPerf: { en: "Branch Performance", rm: "Branch performance", ur: "برانچ کارکردگی" },
  topShops: { en: "Top Shops (MTD)", rm: "Top dukanein (MTD)", ur: "ٹاپ دکانیں" },
  branch: { en: "Branch", rm: "Branch", ur: "برانچ" },
  shop: { en: "Shop", rm: "Dukan", ur: "دکان" },
  salesMtd: { en: "Sales (MTD)", rm: "Sale (MTD)", ur: "سیل" },
  growth: { en: "Growth", rm: "Farq", ur: "اضافہ" },
  viewAll: { en: "View all", rm: "Sab dekhein", ur: "سب دیکھیں" },
  queue: { en: "Attention Queue", rm: "Tawajjo ki qatar", ur: "توجہ طلب" },
  noAlerts: { en: "No current alerts.", rm: "Abhi koi alert nahi.", ur: "ابھی کوئی الرٹ نہیں۔" },
  news: { en: "Today's news (Management Insight)", rm: "Aaj ki khabar (Management insight)", ur: "آج کی خبر" },
  quick: { en: "Quick Control", rm: "Quick control", ur: "فوری کنٹرول" },
  rule: { en: "Rule: only real system data is shown. Where no reliable source exists, no fake Rs 0 or count is made.", rm: "Rule: dashboard par sirf real system data dikhaya gaya hai. Jis cheez ka reliable source available nahi, us ka fake Rs 0 ya fake count nahi banaya gaya.", ur: "اصول: صرف اصل سسٹم ڈیٹا دکھایا گیا ہے۔" },
} satisfies Record<string, L3>;

export interface RenderOwnerDashboardProps {
  lang: Lang;
  money: MoneyToday;
  depts: DeptKpi[];
  alerts: Alert[];
  entityCounts: (number | null)[];
  salesTrend: SalesTrendPoint[];
  branchPerformance: RankedRow[];
  topShops: RankedRow[];
  lines: string[];
  totals: DeptTotals;
  /** Purane server components -- bilkul wohi. */
  motivation: ReactNode;
  dailySales: ReactNode;
  dailySalesTitle: ReactNode;
  shopSelect: ReactNode;
  liveRefresh: ReactNode;
}

function withHighlight(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i} className="rd-hl text-surface-900 dark:text-white">{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>
  );
}

function Growth({ v }: { v: number | null }) {
  return <span dir="ltr" className={`rd-num ${v == null ? "text-surface-400" : v >= 0 ? "text-green-600" : "text-red-600"}`}>{v == null ? "—" : `${v >= 0 ? "↑" : "↓"} ${Math.abs(v)}%`}</span>;
}

export function RenderOwnerDashboard(p: RenderOwnerDashboardProps) {
  const T = (k: keyof typeof L) => L[k][p.lang] ?? L[k].rm;
  const { money, totals } = p;
  const spark = p.salesTrend.map((s) => s.amount);
  const pendingApprovals = p.alerts.filter((a) => a.tone !== "green").length;
  const marginPct = totals.revenue > 0 ? (totals.net / totals.revenue) * 100 : null;
  const rtl = p.lang === "ur";
  let i = 0;
  const nx = () => ({ "--i": i++ } as React.CSSProperties);

  const kpis = [
    { id: "kpi-today-sales", label: T("todaySales"), value: money.revenue, href: "/admin/pos", spark: true },
    { id: "kpi-today-expenses", label: T("todayExp"), value: money.expenses, href: "/admin/company-expenses" },
    { id: "kpi-net-position", label: T("net"), value: money.net, href: "/admin/reports/pnl", danger: money.net < 0 },
    { id: "kpi-cash-position", label: T("cash"), value: money.cash, href: "/admin/finance" },
    { id: "kpi-receivables", label: T("recv"), value: money.receivable, href: "/admin/branch-credit" },
    { id: "kpi-payables", label: T("pay"), value: money.payable, href: "/admin/finance/accounts" },
  ];
  const entityLinks = [
    { label: "Branches", href: "/admin/branches", icon: Building2, count: p.entityCounts[0] },
    { label: "Shops", href: "/admin/shops", icon: Store, count: p.entityCounts[1] },
    { label: "Farmers", href: "/admin/farmers", icon: Users, count: p.entityCounts[2] },
    { label: "Suppliers", href: "/admin/suppliers", icon: Package, count: p.entityCounts[3] },
    { label: "Dealers", href: "/admin/dealers", icon: Users, count: p.entityCounts[4] },
    { label: "Buyers", href: "/admin/buyers", icon: Users, count: p.entityCounts[5] },
  ];
  const controls = [
    { href: "/admin/submissions", icon: Bell, cls: "text-amber-600", label: T("approvals"), value: String(pendingApprovals) },
    { href: "/admin/reconciliation", icon: Scale, cls: "text-brand-600", label: "Reconciliation", value: "Review" },
    { href: "/admin/cash-close", icon: Wallet, cls: "text-brand-600", label: "Cash Closing", value: "Control" },
    { href: "/admin/stock-count", icon: Boxes, cls: "text-brand-600", label: "Stock Count", value: "Verify" },
    { href: "/admin/shop-360", icon: Store, cls: "text-brand-600", label: "Shop 360", value: "Zero Leakage" },
    { href: "/admin/field-watch", icon: AlertTriangle, cls: "text-red-600", label: "Field Watch", value: "Exceptions" },
  ];
  const abram = [
    { href: "/admin/bridge-ai/activity-log", k: "AI Activity", v: "Activity Log" },
    { href: "/admin/bridge-ai/action-requests", k: "Pending AI Actions", v: "Review Queue" },
    { href: "/admin/ai-suggestions", k: "Suggestions", v: "Purchase Intelligence" },
    { href: "/admin/ai-instructions", k: "Controls", v: "AI Instructions" },
  ];
  const quick = [
    { href: "/admin/money-trail", icon: Scale, label: "Money Trail" },
    { href: "/admin/finance/banks", icon: Landmark, label: "Banks" },
    { href: "/admin/inventory", icon: Boxes, label: "Inventory" },
    { href: "/admin/reports", icon: TrendingUp, label: "Reports" },
  ];
  const finMax = Math.max(money.cash, money.receivable ?? 0, money.payable ?? 0, 1);
  const H2 = "font-display text-sm font-semibold text-surface-900 dark:text-white";

  return (
    <div className="rd-root mx-auto w-full max-w-[1800px] space-y-3 pb-4" dir={rtl ? "rtl" : "ltr"} data-testid="render-dashboard">
      <div className="rd-aurora" aria-hidden="true"><i /><i /><i /></div>

      <div className="flex flex-wrap items-start justify-between gap-3 rd-in" style={nx()}>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-surface-900 dark:text-white">{T("title")}</h1>
          <p className="mt-0.5 text-sm text-surface-500">{T("subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <LookToggle current="new" labels={{ old: T("lookOld"), new: T("lookNew") }} />
          <Link data-parity="header-home-link" href="/admin/my-home" className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-white px-3 py-2 text-xs font-semibold text-brand-800 shadow-sm hover:bg-brand-50 dark:border-surface-700 dark:bg-surface-900 dark:text-brand-300"><Home className="h-3.5 w-3.5" />{T("home")}</Link>
          <span data-parity="live-refresh">{p.liveRefresh}</span>
        </div>
      </div>

      <div data-parity="staff-motivation" className="rd-in" style={nx()}>{p.motivation}</div>

      <div className="grid gap-3 xl:grid-cols-[15rem_minmax(0,1fr)_21rem]">
        {/* Metric rail */}
        <div className="grid content-start gap-2 sm:grid-cols-2 xl:grid-cols-1">
          {kpis.map((k) => (
            <Link key={k.id} data-parity={k.id} href={k.href} className="rd-card rd-in block p-3 transition hover:-translate-y-0.5" style={nx()}>
              <p className="text-[11px] font-medium text-surface-500">{k.label}</p>
              <CountUp value={k.value} className={`mt-0.5 block text-xl font-bold tracking-tight ${k.danger ? "text-red-600" : "text-surface-900 dark:text-white"}`} />
              {k.spark && <Sparkline points={spark} />}
            </Link>
          ))}
        </div>

        {/* Main */}
        <div className="grid content-start gap-3 lg:grid-cols-2">
          <section data-parity="sales-trend" className="rd-card rd-in p-4 lg:col-span-2" style={nx()}>
            <h2 className={H2}>{T("trend")}</h2>
            <p className="mb-1 text-xs text-surface-500">{T("trendSub")}</p>
            <SalesAreaChart points={p.salesTrend} labels={{ sale: T("sale"), date: T("date") }} />
          </section>

          <section data-parity="daily-sales-breakdown" className="rd-card rd-in p-4 lg:col-span-2" style={nx()}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className={H2}>{p.dailySalesTitle}</h2>
              {p.shopSelect}
            </div>
            {p.dailySales}
          </section>

          <section className="rd-card rd-in p-4" style={nx()}>
            <h2 className={H2}>{T("gauges")}</h2>
            <div className="mt-2 grid grid-cols-3 gap-1">
              <Gauge label={T("margin")} value={marginPct == null ? null : Math.max(0, marginPct)} max={100} display={marginPct == null ? "—" : `${marginPct.toFixed(1)}%`} />
              <Gauge label={T("approvals")} value={pendingApprovals} max={Math.max(10, pendingApprovals)} display={String(pendingApprovals)} color="#f59e0b" />
              <Gauge label={T("attentionG")} value={totals.attention} max={Math.max(10, totals.attention)} display={String(totals.attention)} color="#f43f5e" />
            </div>
          </section>

          <section data-parity="sales-by-dept" className="rd-card rd-in p-4" style={nx()}>
            <h2 className={`${H2} mb-2`}>{T("byDept")}</h2>
            <DeptDonut slices={p.depts.map((d) => ({ key: d.key, label: d.label, amount: d.revenue ?? 0 }))} empty={T("noData")} />
          </section>

          <section data-parity="dept-overview" className="rd-card rd-in p-4 lg:col-span-2" style={nx()}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <div><h2 className={H2}>{T("dept")}</h2><p className="text-xs text-surface-500">{T("deptSub")}</p></div>
              <Link href="/admin/master-dashboard" className="text-xs font-medium text-brand-700 hover:underline">{T("details")} →</Link>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {p.depts.map((d) => (
                <Link key={d.key} href={d.href} className="rounded-xl border border-surface-200/70 p-3 transition hover:border-brand-300 dark:border-surface-800">
                  <div className="flex items-center justify-between gap-2"><span className="text-sm font-bold text-surface-900 dark:text-white">{d.label}</span>{d.pending > 0 && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">{d.pending}</span>}</div>
                  <div className="mt-2 grid grid-cols-2 gap-y-1 text-[11px]">
                    <span className="text-surface-400">{T("revenue")}</span><span className="rd-num text-end font-semibold" dir="ltr">{formatRs(d.revenue)}</span>
                    <span className="text-surface-400">{T("cost")}</span><span className="rd-num text-end" dir="ltr">{formatRs(d.directCost)}</span>
                    <span className="text-surface-400">{T("pnl")}</span><span dir="ltr" className={`rd-num text-end font-semibold ${d.profit != null && d.profit < 0 ? "text-red-600" : "text-green-700 dark:text-green-400"}`}>{formatRs(d.profit)}</span>
                  </div>
                  {d.state === "incomplete" && <p className="mt-2 text-[10px] text-amber-700">{T("incomplete")}</p>}
                </Link>
              ))}
            </div>
          </section>

          <section data-parity="financial-position" className="rd-card rd-in p-4" style={nx()}>
            <h2 className={H2}>{T("fin")}</h2>
            <p className="mb-3 text-xs text-surface-500">{T("finSub")}</p>
            <div className="space-y-2.5">
              {[{ label: T("cashBank"), value: money.cash, tone: "bg-emerald-500" }, { label: T("recv"), value: money.receivable, tone: "bg-sky-500" }, { label: T("pay"), value: money.payable, tone: "bg-rose-500" }].map((row) => (
                <div key={row.label}>
                  <div className="mb-1 flex items-center justify-between text-xs"><span className="text-surface-500">{row.label}</span><span className="rd-num font-semibold" dir="ltr">{formatRs(row.value)}</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-100 dark:bg-surface-800">{row.value != null && <div className={`rd-bar h-full rounded-full ${row.tone}`} style={{ width: `${Math.max(2, (row.value / finMax) * 100)}%` }} />}</div>
                </div>
              ))}
            </div>
          </section>

          <section data-parity="book-totals" className="rd-card rd-in p-4" style={nx()}>
            <div className="mb-2 flex items-center justify-between gap-2"><h2 className={H2}>{T("book")}</h2><span className="text-xs text-surface-400" dir="ltr">{T("margin")} {marginPct == null ? "—" : `${marginPct.toFixed(1)}%`}</span></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-surface-50 p-2 dark:bg-surface-800/60"><p className="text-[10px] text-surface-500">{T("revenue")}</p><CountUp value={totals.revenue} className="text-sm font-bold" /></div>
              <div className="rounded-lg bg-surface-50 p-2 dark:bg-surface-800/60"><p className="text-[10px] text-surface-500">{T("directCost")}</p><CountUp value={totals.cost} className="text-sm font-bold" /></div>
              <div className="rounded-lg bg-surface-50 p-2 dark:bg-surface-800/60"><p className="text-[10px] text-surface-500">{T("netShort")}</p><CountUp value={totals.net} className={`text-sm font-bold ${totals.net < 0 ? "text-red-600" : "text-green-700 dark:text-green-400"}`} /></div>
              <div className="rounded-lg bg-surface-50 p-2 dark:bg-surface-800/60"><p className="text-[10px] text-surface-500">{T("attentionG")}</p><p className="text-sm font-bold">{totals.attention}</p></div>
            </div>
            {totals.excluded.length > 0 && <p className="mt-2 text-xs text-amber-700">{T("excluded")}: {totals.excluded.join(", ")}</p>}
          </section>

          <section data-parity="entities" className="rd-card rd-in p-4" style={nx()}>
            <h2 className={`${H2} mb-2`}>{T("parties")}</h2>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {entityLinks.map((e) => { const Icon = e.icon; return (
                <Link key={e.label} href={e.href} className="flex items-center justify-between rounded-lg border border-surface-200/70 px-2.5 py-2 text-xs font-medium dark:border-surface-800">
                  <span className="flex items-center gap-2"><Icon className="h-3.5 w-3.5 text-brand-600" />{e.label}<strong className="rd-num text-surface-900 dark:text-white">{e.count ?? "—"}</strong></span><ArrowRight className="h-3.5 w-3.5 text-surface-300 rtl:rotate-180" />
                </Link>); })}
            </div>
          </section>

          <section data-parity="control-compliance" className="rd-card rd-in p-4" style={nx()}>
            <div className="mb-2 flex items-center justify-between gap-3"><h2 className={H2}>{T("control")}</h2><Link href="/admin/reports/audit" className="text-xs font-medium text-brand-700 hover:underline">{T("audit")} →</Link></div>
            <div className="grid grid-cols-3 gap-1.5">
              {controls.map((c) => { const Icon = c.icon; return (
                <Link key={c.href} href={c.href} className="rounded-lg border border-surface-200/70 p-2 dark:border-surface-800"><Icon className={`h-3.5 w-3.5 ${c.cls}`} /><p className="mt-1 text-[10px] text-surface-500">{c.label}</p><p className="text-xs font-semibold">{c.value}</p></Link>); })}
            </div>
          </section>

          <section data-parity="bridge-ai" className="rd-card rd-in p-4 lg:col-span-2" style={nx()}>
            <div className="mb-2 flex items-center justify-between"><div><h2 className={`${H2} flex items-center gap-2`}><Sparkles className="h-4 w-4 text-brand-600" />{T("abram")}</h2><p className="text-xs text-surface-500">{T("abramSub")}</p></div><Link href="/admin/bridge-ai" className="text-xs font-medium text-brand-700 hover:underline">{T("openAbram")} →</Link></div>
            <div className="grid gap-1.5 sm:grid-cols-4">
              {abram.map((a) => <Link key={a.href} href={a.href} className="rounded-lg border border-surface-200/70 p-2 dark:border-surface-800"><p className="text-[10px] text-surface-500">{a.k}</p><p className="text-xs font-semibold">{a.v}</p></Link>)}
            </div>
          </section>
        </div>

        {/* Right rail */}
        <aside className="space-y-3">
          <section data-parity="management-insight" className="rd-card rd-in p-4" style={nx()}>
            <h2 className={`${H2} mb-2`}>{T("news")}</h2>
            <ul className="space-y-2">{p.lines.slice(0, 3).map((line, j) => <li key={j} className="flex items-start gap-2 text-xs text-surface-600 dark:text-surface-300"><TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" /><span>{withHighlight(line)}</span></li>)}</ul>
          </section>

          <section data-parity="attention-queue" className="rd-card rd-in p-4" style={nx()}>
            <div className="mb-2 flex items-center justify-between"><h2 className={H2}>{T("queue")}</h2><Link href="/admin/submissions" className="text-[11px] text-brand-700 hover:underline">{T("viewAll")}</Link></div>
            <div className="space-y-1.5">
              {p.alerts.slice(0, 4).map((a, j) => (
                <Link key={`${a.href}-${j}`} href={a.href} className="flex items-start gap-2 rounded-lg border border-surface-100 p-2 dark:border-surface-800">
                  {a.tone === "green" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" /> : <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${a.tone === "red" ? "text-red-600" : "text-amber-600"}`} />}
                  <div className="min-w-0"><p className="text-xs font-semibold text-surface-900 dark:text-white">{a.title}</p><p className="mt-0.5 line-clamp-2 text-[11px] text-surface-500">{a.detail}</p></div>
                </Link>
              ))}
              {p.alerts.length === 0 && <p className="py-4 text-center text-xs text-surface-400">{T("noAlerts")}</p>}
            </div>
          </section>

          <section data-parity="branch-performance" className="rd-card rd-in p-4" style={nx()}>
            <div className="mb-2 flex items-center justify-between"><h2 className={H2}>{T("branchPerf")}</h2><Link href="/admin/branches" className="text-[11px] text-brand-700 hover:underline">{T("viewAll")} →</Link></div>
            {p.branchPerformance.length === 0 ? <p className="py-2 text-center text-xs text-surface-400">{T("noData")}</p> : (
              <table className="w-full text-xs"><thead className="text-surface-400"><tr><th className="pb-1.5 text-start font-medium">{T("branch")}</th><th className="pb-1.5 text-end font-medium">{T("salesMtd")}</th><th className="pb-1.5 text-end font-medium">{T("growth")}</th></tr></thead>
                <tbody>{p.branchPerformance.map((r) => <tr key={r.id} className="border-t border-surface-100 dark:border-surface-800"><td className="py-1.5 font-medium">{r.name}</td><td className="rd-num py-1.5 text-end" dir="ltr">{formatRs(r.salesMtd)}</td><td className="py-1.5 text-end"><Growth v={r.growthPct} /></td></tr>)}</tbody></table>
            )}
          </section>

          <section data-parity="top-shops" className="rd-card rd-in p-4" style={nx()}>
            <div className="mb-2 flex items-center justify-between"><h2 className={H2}>{T("topShops")}</h2><Link href="/admin/shops" className="text-[11px] text-brand-700 hover:underline">{T("viewAll")} →</Link></div>
            {p.topShops.length === 0 ? <p className="py-2 text-center text-xs text-surface-400">{T("noData")}</p> : (
              <table className="w-full text-xs"><thead className="text-surface-400"><tr><th className="pb-1.5 text-start font-medium">#</th><th className="pb-1.5 text-start font-medium">{T("shop")}</th><th className="pb-1.5 text-end font-medium">{T("salesMtd")}</th><th className="pb-1.5 text-end font-medium">{T("growth")}</th></tr></thead>
                <tbody>{p.topShops.map((r, j) => <tr key={r.id} className="border-t border-surface-100 dark:border-surface-800"><td className="py-1.5 text-surface-400">{j + 1}</td><td className="py-1.5 font-medium">{r.name}</td><td className="rd-num py-1.5 text-end" dir="ltr">{formatRs(r.salesMtd)}</td><td className="py-1.5 text-end"><Growth v={r.growthPct} /></td></tr>)}</tbody></table>
            )}
          </section>

          <section data-parity="quick-control" className="rd-card rd-in p-4" style={nx()}>
            <h2 className={`${H2} mb-2`}>{T("quick")}</h2>
            <div className="grid grid-cols-2 gap-1 text-xs">
              {quick.map((q) => { const Icon = q.icon; return <Link key={q.href} href={q.href} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-50 dark:hover:bg-surface-800"><Icon className="h-3.5 w-3.5 text-brand-600" />{q.label}</Link>; })}
            </div>
          </section>
        </aside>
      </div>

      <p data-parity="rule-footnote" className="px-1 text-[11px] text-surface-400">{T("rule")}</p>
    </div>
  );
}
