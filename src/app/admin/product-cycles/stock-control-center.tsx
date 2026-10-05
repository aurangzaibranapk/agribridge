// @ts-nocheck — generated database unions can include stale icon tuple types until schema types are regenerated.
"use client";

import { BarChart3, CheckCircle2, Clock3, Send, Store, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { StockCountCommandRow } from "@/app/admin/stock-count/admin-command-monitor";
import { AdminCommandMonitor } from "@/app/admin/stock-count/admin-command-monitor";

function metricTone(tone: string) {
  return tone === "green" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : tone === "amber" ? "border-amber-200 bg-amber-50 text-amber-800" : tone === "violet" ? "border-violet-200 bg-violet-50 text-violet-800" : "border-blue-200 bg-blue-50 text-blue-800";
}

export function StockControlCenter({ rows, showMonitor, totalShops }: { rows: StockCountCommandRow[]; showMonitor: boolean; totalShops: number }) {
  const pending = rows.filter((r) => r.status === "assigned" || r.status === "counting").length;
  const completed = rows.filter((r) => r.status === "verified" || r.status === "posted").length;
  const products = rows.reduce((sum, r) => sum + r.totalProducts, 0);
  const counted = rows.reduce((sum, r) => sum + r.countedProducts, 0);
  const progress = products ? Math.round((counted / products) * 100) : 0;
  const staff = Array.from(new Map(rows.map((r) => [r.staffName, r])).values());
  const shopCount = new Set(rows.map((r) => r.warehouseName)).size;
  const metrics: Array<[string, string | number, LucideIcon, string]> = [
    ["Total Commands", rows.length, Send, "blue"],
    ["Pending Response", pending, Clock3, "amber"],
    ["Completed", completed, CheckCircle2, "green"],
    ["Products Counted", `${counted}/${products}`, BarChart3, "violet"],
    ["Overall Progress", `${progress}%`, BarChart3, "blue"],
  ];
  return <div className="mb-6 space-y-4">
    <div className="rounded-2xl border border-brand-200 bg-gradient-to-r from-brand-50 via-white to-emerald-50 p-5 shadow-sm dark:border-brand-900/40 dark:from-brand-950/30 dark:via-surface-900 dark:to-emerald-950/20">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-brand-700">Inventory Control Center</p><h2 className="mt-1 font-display text-2xl font-bold text-surface-900 dark:text-white">Stock Count &amp; Product Cycles</h2><p className="mt-1 text-sm text-surface-500">Admin ko assignment, response, counting progress aur shop/warehouse history ek jagah.</p></div><div className="flex items-center gap-2 rounded-xl bg-white/80 px-3 py-2 text-xs font-semibold text-emerald-700 shadow-sm dark:bg-surface-900/70 dark:text-emerald-300"><Store className="h-4 w-4" />{totalShops} shops registered</div></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[["Total Commands", rows.length, Send, "blue"], ["Pending Response", pending, Clock3, "amber"], ["Completed", completed, CheckCircle2, "green"], ["Products Counted", `${counted}/${products}`, BarChart3, "violet"], ["Overall Progress", `${progress}%`, BarChart3, "blue"]].map(([label, value, Icon, tone]) => { const MetricIcon = Icon as LucideIcon; return <div key={String(label)} className={`flex items-center gap-3 rounded-xl border p-3 ${metricTone(String(tone))}`}><span className="grid h-9 w-9 place-items-center rounded-lg bg-white/80"><MetricIcon className="h-4 w-4" /></span><div><p className="text-[11px] font-medium opacity-75">{label}</p><p className="mt-0.5 text-xl font-bold tabular-nums">{value}</p></div></div>; })}
      </div>
    </div>
    <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
      <div className="rounded-2xl border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900"><div className="mb-3 flex items-center justify-between"><h3 className="flex items-center gap-2 font-semibold"><Users className="h-4 w-4 text-brand-600" />Staff-wise progress</h3><span className="text-xs text-surface-400">{staff.length} assignments</span></div>{staff.length === 0 ? <p className="py-8 text-center text-sm text-surface-400">Abhi command/response ka record nahi mila.</p> : <div className="space-y-3">{staff.slice(0, 8).map((r) => { const pct = r.totalProducts ? Math.round(r.countedProducts / r.totalProducts * 100) : 0; return <div key={`${r.staffName}-${r.warehouseName}`}><div className="mb-1 flex justify-between gap-3 text-xs"><span className="font-medium text-surface-800 dark:text-surface-200">{r.staffName} <span className="font-normal text-surface-400">· {r.warehouseName}</span></span><span className="tabular-nums text-surface-500">{r.countedProducts}/{r.totalProducts} · {pct}%</span></div><div className="h-2 overflow-hidden rounded-full bg-surface-100 dark:bg-surface-800"><div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${pct}%` }} /></div></div>})}</div>}</div>
      <div className="rounded-2xl border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900"><h3 className="mb-3 flex items-center gap-2 font-semibold"><BarChart3 className="h-4 w-4 text-violet-600" />Assignment status</h3><div className="space-y-3">{[["Pending response", pending, "bg-amber-500"], ["Counting", rows.filter((r) => r.status === "counting").length, "bg-blue-500"], ["Verified / posted", completed, "bg-emerald-500"]].map(([label, value, color]) => <div key={String(label)} className="flex items-center gap-3"><span className={`h-3 w-3 rounded-full ${color}`} /><span className="flex-1 text-sm text-surface-600 dark:text-surface-300">{label}</span><strong className="text-lg tabular-nums text-surface-900 dark:text-white">{value}</strong></div>)}<div className="mt-4 border-t border-surface-100 pt-3 text-xs text-surface-500 dark:border-surface-800">{shopCount} shops/warehouses ke assignments track ho rahe hain. Har row mein assigned time, response time, counted quantity aur status محفوظ rahega.</div></div></div>
    </div>
    {showMonitor && <AdminCommandMonitor rows={rows} />}
  </div>;
}
