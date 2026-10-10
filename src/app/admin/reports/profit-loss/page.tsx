import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { isMissingMigrationError, pctChange, resolveRange } from "@/lib/reports/pnl";
import { ProfitLossDashboard, type DashboardData } from "./profit-loss-dashboard";

export const dynamic = "force-dynamic";

type SP = { range?: string; from?: string; to?: string; branch?: string };

export default async function ProfitLossPage({ searchParams }: { searchParams: Promise<SP> }) {
  const params = await searchParams;
  // Migration 526 ke functions abhi generated types mein nahi, is liye untyped client.
  const supabase = createClient() as any;
  const range = resolveRange(params.range, new Date(), params.from, params.to);
  const branch = params.branch && /^[0-9a-f-]{36}$/i.test(params.branch) ? params.branch : null;

  const { data: branches } = await supabase.from("branches").select("id,name").eq("is_active", true).order("name");

  const [summary, trend, expenses, products, departments, health] = await Promise.all([
    supabase.rpc("fn_pnl_summary", { p_from: range.from, p_to: range.to, p_branch: branch, p_dept: null }),
    supabase.rpc("fn_pnl_trend", { p_from: range.from, p_to: range.to, p_grain: range.grain, p_branch: branch }),
    supabase.rpc("fn_pnl_expense_breakdown", { p_from: range.from, p_to: range.to, p_branch: branch }),
    supabase.rpc("fn_pnl_top_products", { p_from: range.from, p_to: range.to, p_branch: branch, p_limit: 20 }),
    supabase.rpc("fn_pnl_by_department", { p_from: range.from, p_to: range.to, p_branch: branch }),
    supabase.from("v_pnl_data_health").select("issue,count,amount,link"),
  ]);

  const firstError = [summary, trend, expenses, products, departments, health].map((r) => r.error).find(Boolean);
  const header = <PageHeader title="Nafa Nuqsan Dashboard / Profit & Loss" description={`${range.from} se ${range.to} tak (ledger ke mutabiq)`} />;

  if (firstError) {
    const missing = isMissingMigrationError(firstError);
    return (
      <div>
        {header}
        <div className="rounded-card border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
          <p className="font-semibold">{missing ? "P&L dashboard ki migration (526) abhi live par nahi chali / Migration 526 not applied yet" : "Data load nahi ho saka / Could not load data"}</p>
          <p className="mt-1">{missing ? "Backup le kar supabase/migrations/526_pnl_dashboard.sql chalayein, phir ye safha kaam karega." : firstError.message}</p>
          <p className="mt-3"><Link className="underline" href="/admin/reports/pnl">Purana P&amp;L report dekhein / Open old P&amp;L report</Link></p>
        </div>
      </div>
    );
  }

  const rows = (summary.data ?? []) as any[];
  const cur = rows.find((r) => r.period === "current") ?? {};
  const prev = rows.find((r) => r.period === "previous") ?? {};
  const n = (v: unknown) => Number(v ?? 0);
  const card = (k: string) => ({ value: n(cur[k]), previous: n(prev[k]), change: pctChange(n(cur[k]), n(prev[k])) });

  const data: DashboardData = {
    range, branch, branches: (branches ?? []) as { id: string; name: string }[],
    cards: { revenue: card("revenue"), cogs: card("cogs"), gross_profit: card("gross_profit"), net_profit: card("net_profit") },
    operating_expenses: n(cur.operating_expenses), stock_adjustments: n(cur.stock_adjustments),
    trend: ((trend.data ?? []) as any[]).map((t) => ({ bucket: String(t.bucket), revenue: n(t.revenue), cogs: n(t.cogs), expenses: n(t.expenses), net_profit: n(t.net_profit) })),
    expenses: ((expenses.data ?? []) as any[]).map((e) => ({ name: String(e.expense_group ?? "Other"), value: n(e.amount) })),
    products: ((products.data ?? []) as any[]).map((p) => ({ name: String(p.product_name ?? "—"), qty: n(p.qty), revenue: n(p.revenue), cogs: n(p.cogs), profit: n(p.profit), margin: p.margin_pct == null ? null : n(p.margin_pct), flagged: n(p.cost_above_price_lines) })),
    departments: ((departments.data ?? []) as any[]).map((d) => ({ name: String(d.department), revenue: n(d.revenue), cogs: n(d.cogs), gross: n(d.gross_profit), expenses: n(d.expenses), net: n(d.net_profit), margin: d.margin_pct == null ? null : n(d.margin_pct) })),
    health: ((health.data ?? []) as any[]).map((h) => ({ issue: String(h.issue), count: n(h.count), amount: n(h.amount), link: String(h.link) })),
  };

  return (<div>{header}<ProfitLossDashboard data={data} /></div>);
}
