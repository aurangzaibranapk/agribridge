import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { loadMoneyToday, loadDeptKpis, loadAlerts, conclude, deptTotals } from "@/lib/command-center";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Boxes,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  CreditCard,
  Landmark,
  Package,
  ReceiptText,
  Scale,
  Sparkles,
  Store,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { LiveRefresh } from "@/components/live/live-refresh";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

const OWNER_ROLES = ["owner", "super_admin", "admin"];

function rs(value: number | null): string {
  if (value == null) return "—";
  return `Rs ${Math.round(value).toLocaleString()}`;
}

function pct(value: number | null): string {
  if (value == null) return "—";
  return `${value.toFixed(1)}%`;
}

function withBold(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="text-surface-900 dark:text-white">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

const deptIcon: Record<string, typeof Package> = {
  sales: CircleDollarSign,
  retail: CircleDollarSign,
  procurement: Package,
  grain: Package,
  milk: Wallet,
  dairy: Wallet,
  machinery: Boxes,
  purchases: ReceiptText,
  inventory: Boxes,
  fleet: Building2,
};

export default async function CommandCenterPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle()
    : { data: null };

  if (!me?.is_active || !OWNER_ROLES.includes(me.role)) {
    return <div className="p-8 text-center text-surface-400">{t("c_only_owner_admin", lang)}</div>;
  }

  const [money, depts, alerts] = await Promise.all([loadMoneyToday(), loadDeptKpis(lang), loadAlerts()]);
  const lines = conclude(depts, lang);
  const totals = deptTotals(depts);

  const topTiles = [
    { label: "Today Sales", value: rs(money.revenue), href: "/admin/pos", icon: CircleDollarSign },
    { label: "Today Expenses", value: rs(money.expenses), href: "/admin/company-expenses", icon: ReceiptText },
    { label: "Net Position", value: rs(money.net), href: "/admin/reports/pnl", icon: TrendingUp, danger: money.net < 0 },
    { label: "Cash Position", value: rs(money.cash), href: "/admin/finance", icon: Wallet },
    { label: "Receivables", value: rs(money.receivable), href: "/admin/branch-credit", icon: CreditCard },
  ];

  const entityLinks = [
    { label: "Branches", href: "/admin/branches", icon: Building2 },
    { label: "Shops", href: "/admin/shops", icon: Store },
    { label: "Farmers", href: "/admin/farmers", icon: Users },
    { label: "Suppliers", href: "/admin/suppliers", icon: Package },
    { label: "Dealers", href: "/admin/dealers", icon: Users },
    { label: "Buyers", href: "/admin/buyers", icon: Users },
  ];

  return (
    <div className="space-y-3 2xl:h-[calc(100vh-6.25rem)] 2xl:overflow-hidden">
      <PageHeader
        title="Master Command"
        description="Al Rana Traders — organization, departments, finance aur controls ek nazar mein"
        actions={
          <LiveRefresh
            tables={[
              "pos_sales",
              "company_expense_requests",
              "labour_work_entries",
              "party_settlements",
              "whatsapp_submissions",
              "journal_entries",
              "finance_transactions",
            ]}
          />
        }
      />

      {/* Primary business position */}
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {topTiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <Link key={tile.label} href={tile.href}>
              <Card className="h-full p-3 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-surface-500">{tile.label}</p>
                    <p className={`mt-0.5 text-lg font-bold tabular-nums ${tile.danger ? "text-red-600" : "text-surface-900 dark:text-white"}`}>
                      {tile.value}
                    </p>
                  </div>
                  <span className="rounded-lg bg-brand-50 p-1.5 text-brand-700 dark:bg-brand-950/30 dark:text-brand-300">
                    <Icon className="h-4 w-4" />
                  </span>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-3 2xl:min-h-0 2xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid content-start gap-3 xl:grid-cols-2">
          {/* Department overview */}
          <Card className="p-3 xl:col-span-2">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-semibold text-surface-900 dark:text-white">Department Overview</h2>
                <p className="text-xs text-surface-500">Current month — real departmental books</p>
              </div>
              <Link href="/admin/master-dashboard" className="text-xs font-medium text-brand-700 hover:underline">View details →</Link>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
              {depts.map((d) => {
                const Icon = deptIcon[d.key] ?? Package;
                return (
                  <Link key={d.key} href={d.href} className="rounded-xl border border-surface-200 p-2.5 transition hover:border-brand-300 hover:bg-brand-25 dark:border-surface-800 dark:hover:bg-surface-900">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-2 text-sm font-semibold text-surface-900 dark:text-white">
                        <span className="rounded-lg bg-surface-100 p-1.5 text-brand-700 dark:bg-surface-800 dark:text-brand-300"><Icon className="h-4 w-4" /></span>
                        {d.label}
                      </span>
                      {d.pending > 0 && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">{d.pending}</span>}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-y-0.5 text-[11px]">
                      <span className="text-surface-400">Revenue</span><span className="text-right font-semibold tabular-nums">{rs(d.revenue)}</span>
                      <span className="text-surface-400">Cost</span><span className="text-right tabular-nums">{rs(d.directCost)}</span>
                      <span className="text-surface-400">P&L</span><span className={`text-right font-semibold tabular-nums ${d.profit != null && d.profit < 0 ? "text-red-600" : "text-green-700 dark:text-green-400"}`}>{rs(d.profit)}</span>
                    </div>
                    {d.state === "incomplete" && <p className="mt-2 text-[10px] text-amber-700">Reconciliation incomplete</p>}
                  </Link>
                );
              })}
            </div>
          </Card>

          {/* Core master entities */}
          <Card className="p-3">
            <div className="mb-2">
              <h2 className="font-display text-base font-semibold text-surface-900 dark:text-white">Business Structure & Parties</h2>
              <p className="text-xs text-surface-500">Canonical masters — duplicate menus ke baghair</p>
            </div>
            <div className="grid gap-1.5 sm:grid-cols-3">
              {entityLinks.map((entity) => {
                const Icon = entity.icon;
                return (
                  <Link key={entity.label} href={entity.href} className="flex items-center justify-between rounded-lg border border-surface-200 px-2.5 py-2 text-xs font-medium text-surface-800 transition hover:border-brand-300 hover:bg-brand-25 dark:border-surface-800 dark:text-surface-200">
                    <span className="flex items-center gap-2"><Icon className="h-4 w-4 text-brand-600" />{entity.label}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-surface-300" />
                  </Link>
                );
              })}
            </div>
          </Card>

          {/* Control row */}
          <Card className="p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-semibold text-surface-900 dark:text-white">Control & Compliance</h2>
                <p className="text-xs text-surface-500">Sirf wo cheezein jo action mangti hain</p>
              </div>
              <Link href="/admin/reports/audit" className="text-xs font-medium text-brand-700 hover:underline">Audit Center →</Link>
            </div>
            <div className="grid gap-1.5 grid-cols-3">
              <Link href="/admin/submissions" className="rounded-lg border border-surface-200 p-2 dark:border-surface-800"><Bell className="h-3.5 w-3.5 text-amber-600"/><p className="mt-1 text-[10px] text-surface-500">Pending Approvals</p><p className="text-sm font-bold">{alerts.filter(a => a.tone !== "green").length}</p></Link>
              <Link href="/admin/reconciliation" className="rounded-lg border border-surface-200 p-2 dark:border-surface-800"><Scale className="h-3.5 w-3.5 text-brand-600"/><p className="mt-1 text-[10px] text-surface-500">Reconciliation</p><p className="text-xs font-semibold">Review</p></Link>
              <Link href="/admin/cash-close" className="rounded-lg border border-surface-200 p-2 dark:border-surface-800"><Wallet className="h-3.5 w-3.5 text-brand-600"/><p className="mt-1 text-[10px] text-surface-500">Cash Closing</p><p className="text-xs font-semibold">Control</p></Link>
              <Link href="/admin/stock-count" className="rounded-lg border border-surface-200 p-2 dark:border-surface-800"><Boxes className="h-3.5 w-3.5 text-brand-600"/><p className="mt-1 text-[10px] text-surface-500">Stock Count</p><p className="text-xs font-semibold">Verify</p></Link>
              <Link href="/admin/shop-360" className="rounded-lg border border-surface-200 p-2 dark:border-surface-800"><Store className="h-3.5 w-3.5 text-brand-600"/><p className="mt-1 text-[10px] text-surface-500">Shop 360</p><p className="text-xs font-semibold">Zero Leakage</p></Link>
              <Link href="/admin/field-watch" className="rounded-lg border border-surface-200 p-2 dark:border-surface-800"><AlertTriangle className="h-3.5 w-3.5 text-red-600"/><p className="mt-1 text-[10px] text-surface-500">Field Watch</p><p className="text-xs font-semibold">Exceptions</p></Link>
            </div>
          </Card>

          {/* Bridge AI */}
          <Card className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <h2 className="flex items-center gap-2 font-display text-base font-semibold text-surface-900 dark:text-white"><Sparkles className="h-4 w-4 text-brand-600"/>Bridge AI</h2>
                <p className="text-xs text-surface-500">Suggestions, actions aur human escalation</p>
              </div>
              <Link href="/admin/bridge-ai" className="text-xs font-medium text-brand-700 hover:underline">Open Bridge AI →</Link>
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2">
              <Link href="/admin/bridge-ai/activity-log" className="rounded-lg border border-surface-200 p-2 dark:border-surface-800"><p className="text-[10px] text-surface-500">AI Activity</p><p className="text-xs font-semibold">Activity Log</p></Link>
              <Link href="/admin/bridge-ai/action-requests" className="rounded-lg border border-surface-200 p-2 dark:border-surface-800"><p className="text-[10px] text-surface-500">Pending AI Actions</p><p className="text-xs font-semibold">Review Queue</p></Link>
              <Link href="/admin/ai-suggestions" className="rounded-lg border border-surface-200 p-2 dark:border-surface-800"><p className="text-[10px] text-surface-500">Suggestions</p><p className="text-xs font-semibold">Purchase Intelligence</p></Link>
              <Link href="/admin/ai-instructions" className="rounded-lg border border-surface-200 p-2 dark:border-surface-800"><p className="text-[10px] text-surface-500">Controls</p><p className="text-xs font-semibold">AI Instructions</p></Link>
            </div>
          </Card>

          {/* Book totals */}
          <Card className="p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div><h2 className="font-display text-base font-semibold">Department Book Totals</h2><p className="text-xs text-surface-500">Sirf complete departments ka consolidated result</p></div>
              <span className="text-xs text-surface-400">Margin {pct(totals.revenue > 0 ? (totals.net / totals.revenue) * 100 : null)}</span>
            </div>
            <div className="grid gap-2 grid-cols-4">
              <div className="rounded-lg bg-surface-50 p-2 dark:bg-surface-900"><p className="text-[10px] text-surface-500">Revenue</p><p className="text-sm font-bold">{rs(totals.revenue)}</p></div>
              <div className="rounded-lg bg-surface-50 p-2 dark:bg-surface-900"><p className="text-[10px] text-surface-500">Direct Cost</p><p className="text-sm font-bold">{rs(totals.cost)}</p></div>
              <div className="rounded-lg bg-surface-50 p-2 dark:bg-surface-900"><p className="text-[10px] text-surface-500">Net</p><p className={`text-sm font-bold ${totals.net < 0 ? "text-red-600" : "text-green-700 dark:text-green-400"}`}>{rs(totals.net)}</p></div>
              <div className="rounded-lg bg-surface-50 p-2 dark:bg-surface-900"><p className="text-[10px] text-surface-500">Attention</p><p className="text-sm font-bold">{totals.attention}</p></div>
            </div>
            {totals.excluded.length > 0 && <p className="mt-3 text-xs text-amber-700">Incomplete totals excluded: {totals.excluded.join(", ")}</p>}
          </Card>
        </div>

        {/* Right management rail */}
        <aside className="space-y-3 2xl:min-h-0">
          <Card className="p-3">
            <div className="mb-2 flex items-center justify-between"><h2 className="font-display text-sm font-semibold">Attention Queue</h2><Link href="/admin/submissions" className="text-[11px] text-brand-700 hover:underline">View all</Link></div>
            <div className="space-y-1.5">
              {alerts.slice(0, 4).map((alert, i) => (
                <Link key={`${alert.href}-${i}`} href={alert.href} className="flex items-start gap-2 rounded-lg border border-surface-100 p-2 transition hover:bg-surface-50 dark:border-surface-800 dark:hover:bg-surface-900">
                  {alert.tone === "green" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600"/> : <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${alert.tone === "red" ? "text-red-600" : "text-amber-600"}`}/>} 
                  <div className="min-w-0"><p className="text-xs font-semibold text-surface-900 dark:text-white">{alert.title}</p><p className="mt-0.5 line-clamp-2 text-[11px] text-surface-500">{alert.detail}</p></div>
                </Link>
              ))}
              {alerts.length === 0 && <p className="py-4 text-center text-xs text-surface-400">No current alerts.</p>}
            </div>
          </Card>

          <Card className="p-3">
            <h2 className="mb-2 font-display text-sm font-semibold">Management Insight</h2>
            <ul className="space-y-2">
              {lines.slice(0, 3).map((line, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-surface-600 dark:text-surface-300">
                  <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
                  <span>{withBold(line)}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-3">
            <h2 className="mb-2 font-display text-sm font-semibold">Quick Control</h2>
            <div className="grid grid-cols-2 gap-1 text-xs">
              <Link href="/admin/money-trail" className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-surface-50 dark:hover:bg-surface-900"><span className="flex items-center gap-2"><Scale className="h-3.5 w-3.5 text-brand-600"/>Money Trail</span></Link>
              <Link href="/admin/finance/banks" className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-surface-50 dark:hover:bg-surface-900"><span className="flex items-center gap-2"><Landmark className="h-3.5 w-3.5 text-brand-600"/>Banks</span></Link>
              <Link href="/admin/inventory" className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-surface-50 dark:hover:bg-surface-900"><span className="flex items-center gap-2"><Boxes className="h-3.5 w-3.5 text-brand-600"/>Inventory</span></Link>
              <Link href="/admin/reports" className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-surface-50 dark:hover:bg-surface-900"><span className="flex items-center gap-2"><TrendingUp className="h-3.5 w-3.5 text-brand-600"/>Reports</span></Link>
            </div>
          </Card>
        </aside>
      </div>

      <p className="px-1 text-[11px] text-surface-400 2xl:hidden">
        Rule: dashboard par sirf real system data dikhaya gaya hai. Jis cheez ka reliable source available nahi, us ka fake Rs 0 ya fake count nahi banaya gaya.
      </p>
    </div>
  );
}
