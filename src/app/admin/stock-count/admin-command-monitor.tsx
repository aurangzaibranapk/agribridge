"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/layout-primitives";
import { BarChart3, CheckCircle2, ChevronRight, Clock3, Eye, Filter, Package, Search, Send, Users, X } from "lucide-react";

export interface StockCountCommandRow {
  id: string;
  warehouseName: string;
  staffName: string;
  commandAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  totalProducts: number;
  countedProducts: number;
  status: string;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-PK", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function statusText(status: string): string {
  if (status === "assigned") return "Command assigned / response pending";
  if (status === "posted") return "Final posted";
  if (status === "verified") return "Manager verified";
  if (status === "counting") return "Response pending / counting";
  return status || "—";
}

function statusClass(status: string): string {
  if (status === "posted") return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300";
  if (status === "verified") return "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300";
  if (status === "counting") return "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300";
  if (status === "assigned") return "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300";
  return "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300";
}

function initials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "—";
}

export function AdminCommandMonitor({ rows }: { rows: StockCountCommandRow[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [warehouse, setWarehouse] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(rows[0]?.id ?? null);
  const warehouses = useMemo(() => Array.from(new Set(rows.map((row) => row.warehouseName))).sort(), [rows]);
  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesSearch = !query || `${row.staffName} ${row.warehouseName} ${statusText(row.status)}`.toLowerCase().includes(query);
      return matchesSearch && (status === "all" || row.status === status) && (warehouse === "all" || row.warehouseName === warehouse);
    });
  }, [rows, search, status, warehouse]);
  const selected = filteredRows.find((row) => row.id === selectedId) ?? filteredRows[0] ?? null;
  const total = rows.length;
  const pending = rows.filter((row) => row.status === "assigned" || row.status === "counting").length;
  const completed = rows.filter((row) => row.status === "posted" || row.status === "verified").length;
  const products = rows.reduce((sum, row) => sum + row.totalProducts, 0);
  const counted = rows.reduce((sum, row) => sum + row.countedProducts, 0);
  const overallProgress = products ? Math.round((counted / products) * 100) : 0;

  return (
    <Card className="overflow-hidden border-brand-200 bg-surface-50/60 p-0 dark:border-brand-900/40 dark:bg-surface-950/30">
      <div className="border-b border-surface-200 bg-white px-5 py-5 dark:border-surface-800 dark:bg-surface-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300"><Package className="h-5 w-5" /></span><div><h2 className="font-display text-xl font-bold text-surface-900 dark:text-white">Stock Count Command Center</h2><p className="text-xs text-surface-500 dark:text-surface-400">Admin monitor — staff command, response aur progress</p></div></div>
            <p className="mt-3 max-w-3xl text-xs leading-relaxed text-surface-500 dark:text-surface-400">Kis staff ko kis godam ki ginti di gayi, command kab record hui, response kitna aaya aur final status kya hai. Actual SMS send time tabhi dikhaya jayega jab SMS log database mein save hoga.</p>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">Existing stock data protected</div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[["Total Commands", total, Send, "bg-emerald-50 text-emerald-700"], ["Pending Responses", pending, Clock3, "bg-amber-50 text-amber-700"], ["Completed Counts", completed, CheckCircle2, "bg-blue-50 text-blue-700"], ["Overall Progress", `${overallProgress}%`, BarChart3, "bg-violet-50 text-violet-700"]].map(([label, value, Icon, tone]) => <div key={String(label)} className="flex items-center gap-3 rounded-2xl border border-surface-200 bg-white p-4 shadow-sm dark:border-surface-800 dark:bg-surface-900"><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tone}`}><Icon className="h-5 w-5" /></span><div><p className="text-xs text-surface-500">{label}</p><p className="mt-0.5 text-2xl font-bold tabular-nums text-surface-900 dark:text-white">{value}</p></div></div>)}
        </div>
      </div>
      <div className="border-b border-surface-200 bg-white px-5 py-4 dark:border-surface-800 dark:bg-surface-900">
        <div className="grid gap-2 md:grid-cols-[1.1fr_1fr_1fr_1.3fr]">
          <label className="relative block"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-surface-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search staff, warehouse..." className="h-10 w-full rounded-xl border border-surface-200 bg-white pl-9 pr-3 text-sm outline-none ring-brand-500 focus:ring-2 dark:border-surface-700 dark:bg-surface-950" /></label>
          <label className="relative block"><Filter className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-surface-400" /><select value={warehouse} onChange={(event) => setWarehouse(event.target.value)} className="h-10 w-full appearance-none rounded-xl border border-surface-200 bg-white pl-9 pr-3 text-sm outline-none dark:border-surface-700 dark:bg-surface-950"><option value="all">All Warehouses</option>{warehouses.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-xl border border-surface-200 bg-white px-3 text-sm outline-none dark:border-surface-700 dark:bg-surface-950"><option value="all">All Status</option><option value="assigned">Assigned</option><option value="counting">Counting</option><option value="verified">Verified</option><option value="posted">Posted</option></select>
          <div className="flex items-center justify-end text-xs text-surface-500"><Users className="mr-1.5 h-4 w-4" /> Showing {filteredRows.length} of {rows.length} commands</div>
        </div>
      </div>
      <div className="grid xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="overflow-x-auto bg-white dark:bg-surface-900">
          {filteredRows.length === 0 ? <div className="px-5 py-12 text-center text-sm text-surface-500">Abhi is filter ke mutabiq koi command nahi mili.</div> : <table className="w-full min-w-[930px] text-sm"><thead className="bg-surface-50 text-left text-[10px] uppercase tracking-wide text-surface-500 dark:bg-surface-800/70"><tr><th className="px-4 py-3">Staff / Godam</th><th className="px-3 py-3">Assigned</th><th className="px-3 py-3">Command sent</th><th className="px-3 py-3">Response</th><th className="px-3 py-3">Work</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">View</th></tr></thead><tbody>{filteredRows.map((row) => { const progress = row.totalProducts ? Math.round((row.countedProducts / row.totalProducts) * 100) : 0; const isSelected = selected?.id === row.id; return <tr key={row.id} onClick={() => setSelectedId(row.id)} className={`cursor-pointer border-t border-surface-100 transition hover:bg-brand-50/40 dark:border-surface-800 dark:hover:bg-brand-950/20 ${isSelected ? "bg-brand-50/70 dark:bg-brand-950/20" : ""}`}><td className="px-4 py-3"><div className="flex items-center gap-2.5"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-800 dark:bg-brand-950/50 dark:text-brand-300">{initials(row.staffName)}</span><div><p className="font-semibold text-surface-900 dark:text-white">{row.staffName}</p><p className="text-xs text-surface-500">{row.warehouseName}</p></div></div></td><td className="px-3 py-3 text-center font-semibold tabular-nums text-surface-800 dark:text-surface-200">{row.totalProducts}</td><td className="px-3 py-3 text-xs text-surface-600 dark:text-surface-300">{formatDate(row.commandAt)}</td><td className="px-3 py-3 text-xs text-surface-600 dark:text-surface-300">{formatDate(row.startedAt)}</td><td className="px-3 py-3"><p className="font-semibold tabular-nums text-surface-900 dark:text-white">{row.countedProducts} / {row.totalProducts}</p><div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-surface-100 dark:bg-surface-800"><div className="h-full rounded-full bg-brand-600" style={{ width: `${progress}%` }} /></div><p className="mt-1 text-[10px] text-surface-400">{progress}%</p></td><td className="px-3 py-3"><span className={`inline-flex max-w-[155px] items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium ${statusClass(row.status)}`}>{row.status === "posted" || row.status === "verified" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}{statusText(row.status)}</span></td><td className="px-3 py-3"><button type="button" aria-label={`View ${row.staffName}`} className="grid h-8 w-8 place-items-center rounded-lg border border-surface-200 text-surface-500 hover:border-brand-300 hover:text-brand-700 dark:border-surface-700"><Eye className="h-4 w-4" /></button></td></tr>; })}</tbody></table>}
        </div>
        <aside className="border-t border-surface-200 bg-white p-5 xl:border-l xl:border-t-0 dark:border-surface-800 dark:bg-surface-900">
          {selected ? <><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-2.5"><span className="grid h-10 w-10 place-items-center rounded-full bg-brand-100 font-bold text-brand-800 dark:bg-brand-950/50 dark:text-brand-300">{initials(selected.staffName)}</span><div><p className="font-semibold text-surface-900 dark:text-white">{selected.staffName}</p><p className="text-xs text-surface-500">{selected.warehouseName}</p></div></div><button type="button" onClick={() => setSelectedId(null)} className="text-surface-400 hover:text-surface-700"><X className="h-4 w-4" /></button></div><div className="mt-5 border-b border-surface-200 pb-3 text-xs dark:border-surface-800"><div className="flex gap-4"><span className="border-b-2 border-brand-600 pb-2 font-semibold text-brand-700">Details</span><span className="text-surface-400">Timeline</span><span className="text-surface-400">Notes</span></div></div><div className="mt-4 flex items-center gap-2"><Package className="h-4 w-4 text-brand-700" /><p className="font-semibold text-surface-900 dark:text-white">Assigned Products ({selected.totalProducts})</p></div><div className="mt-3 rounded-xl border border-surface-200 p-3 dark:border-surface-800"><div className="flex justify-between text-xs text-surface-500"><span>Counted products</span><strong className="text-surface-900 dark:text-white">{selected.countedProducts} / {selected.totalProducts}</strong></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-100 dark:bg-surface-800"><div className="h-full rounded-full bg-brand-600" style={{ width: `${selected.totalProducts ? Math.round((selected.countedProducts / selected.totalProducts) * 100) : 0}%` }} /></div></div><div className="mt-5 space-y-3 text-xs"><div className="flex gap-2"><Send className="h-4 w-4 shrink-0 text-brand-600" /><div><p className="font-semibold text-surface-800 dark:text-surface-200">Command assigned</p><p className="text-surface-500">{formatDate(selected.commandAt)}</p></div></div><div className="flex gap-2"><Clock3 className="h-4 w-4 shrink-0 text-blue-600" /><div><p className="font-semibold text-surface-800 dark:text-surface-200">Response started</p><p className="text-surface-500">{formatDate(selected.startedAt)}</p></div></div><div className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /><div><p className="font-semibold text-surface-800 dark:text-surface-200">Completed / verified</p><p className="text-surface-500">{formatDate(selected.completedAt)}</p></div></div></div><div className="mt-6 rounded-xl border border-surface-200 bg-surface-50 p-3 text-xs dark:border-surface-800 dark:bg-surface-950/50"><p className="font-semibold text-surface-800 dark:text-surface-200">Current response</p><p className="mt-1 text-surface-500">{statusText(selected.status)}</p></div><div className="mt-5 flex gap-2"><button type="button" className="flex-1 rounded-xl border border-emerald-600 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300">Verify Count</button><button type="button" className="flex-1 rounded-xl bg-brand-700 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-800">Approve &amp; Close</button></div><p className="mt-3 flex items-center gap-1 text-[10px] text-surface-400"><ChevronRight className="h-3 w-3" /> Buttons will follow existing permission checks when connected.</p></> : <div className="py-12 text-center text-sm text-surface-500">Row select kar ke detail dekhein.</div>}
        </aside>
      </div>
    </Card>
  );
}
