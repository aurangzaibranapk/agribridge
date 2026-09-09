"use client";

import Link from "next/link";
import { ArrowRight, BarChart3, CheckCircle2, LayoutGrid, Sparkles } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { iconByName } from "@/lib/access/icons";

type Item = { href: string; label: string; icon: string | null; description?: string | null; section?: string | null };
type Tile = { label: string; value: string; hint?: string; href?: string; tone?: "normal" | "warn" | "alert" };

const COLORS = ["#1f6b3a", "#2f80ed", "#f2a93b", "#7559c9", "#d64545"];

export function CanonicalDepartmentDashboard({ label, description, icon, items, tiles }: { label: string; description: string; icon: string | null; items: Item[]; tiles: Tile[] }) {
  const Icon = iconByName(icon);
  const sections = [...new Set(items.map((i) => i.section || "Operations"))].map((section) => ({ section, value: items.filter((i) => (i.section || "Operations") === section).length }));
  const reports = items.filter((i) => i.href.includes("report"));
  const primary = items.filter((i) => !i.href.includes("report")).slice(0, 8);
  const displayTiles = tiles.length ? tiles.slice(0, 4) : [
    { label: "Available Work", value: String(items.length), hint: "Permission-based features" },
    { label: "Operations", value: String(items.filter((i) => (i.section || "Operations") === "Operations").length), hint: "Daily work areas" },
    { label: "Reports", value: String(reports.length), hint: reports.length ? "Department reports" : "No separate report" },
    { label: "Setup & Control", value: String(items.filter((i) => ["Setup", "Finance & Ledger"].includes(i.section || "")).length), hint: "Configured controls" },
  ];

  return (
    <div className="mx-auto w-full max-w-[1800px] space-y-3 2xl:h-[calc(100vh-7rem)] 2xl:overflow-hidden">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-brand-50 p-2.5 text-brand-700 dark:bg-surface-800"><Icon className="h-6 w-6" /></span>
          <div><h1 className="font-display text-2xl font-bold tracking-tight text-surface-900 dark:text-white">{label} Dashboard</h1><p className="mt-0.5 text-sm text-surface-500">{description}</p></div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />Live workspace</span>
      </div>

      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        {displayTiles.map((tile, index) => {
          const card = <div className={`h-full rounded-xl border bg-white p-3.5 shadow-card dark:bg-surface-900 ${tile.tone === "alert" ? "border-red-200" : tile.tone === "warn" ? "border-amber-200" : "border-surface-200 dark:border-surface-800"}`}><p className="text-[11px] font-semibold text-surface-500">{tile.label}</p><p className={`mt-1 text-xl font-bold ${tile.tone === "alert" ? "text-red-600" : tile.tone === "warn" ? "text-amber-700" : "text-surface-900 dark:text-white"}`}>{tile.value}</p>{tile.hint && <p className="mt-0.5 text-[10px] text-surface-400">{tile.hint}</p>}</div>;
          return tile.href ? <Link key={`${tile.label}-${index}`} href={tile.href}>{card}</Link> : <div key={`${tile.label}-${index}`}>{card}</div>;
        })}
      </div>

      <div className="grid gap-3 xl:grid-cols-[1.45fr_.75fr]">
        <section className="rounded-xl border border-surface-200 bg-white p-3.5 shadow-card dark:border-surface-800 dark:bg-surface-900">
          <div className="mb-3 flex items-center justify-between"><div><h2 className="flex items-center gap-2 text-sm font-bold"><LayoutGrid className="h-4 w-4 text-brand-600" />Department Operations</h2><p className="text-[11px] text-surface-500">Aap ke permissions ke mutabiq available work</p></div><span className="text-[10px] text-surface-400">{items.length} features</span></div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{primary.map((item) => { const ItemIcon = iconByName(item.icon); return <Link key={item.href} href={item.href} className="group rounded-xl border border-surface-200 p-3 transition hover:border-brand-300 hover:bg-brand-25 dark:border-surface-800"><div className="flex items-center justify-between"><span className="rounded-lg bg-brand-50 p-2 text-brand-700 dark:bg-surface-800"><ItemIcon className="h-4 w-4" /></span><ArrowRight className="h-3.5 w-3.5 text-surface-300 group-hover:text-brand-600" /></div><p className="mt-2 text-xs font-bold text-surface-900 dark:text-white">{item.label}</p><p className="mt-0.5 line-clamp-2 text-[10px] text-surface-500">{item.description || item.section || "Department operation"}</p></Link>; })}</div>
          {primary.length === 0 && <p className="py-12 text-center text-xs text-surface-400">Is department ke features abhi assign nahi hue.</p>}
        </section>

        <section className="rounded-xl border border-surface-200 bg-white p-3.5 shadow-card dark:border-surface-800 dark:bg-surface-900">
          <h2 className="flex items-center gap-2 text-sm font-bold"><BarChart3 className="h-4 w-4 text-brand-600" />Work Structure</h2>
          <div className="grid h-[220px] grid-cols-[1.1fr_1fr] items-center"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={sections.length ? sections : [{ section: "No features", value: 1 }]} dataKey="value" nameKey="section" innerRadius="48%" outerRadius="78%">{(sections.length ? sections : [{ section: "No features", value: 1 }]).map((_, i) => <Cell key={i} fill={sections.length ? COLORS[i % COLORS.length] : "#e2e8e3"} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer><div className="space-y-2">{sections.map((s, i) => <div key={s.section} className="flex items-center justify-between gap-2 text-[10px]"><span className="flex min-w-0 items-center gap-2"><i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: COLORS[i % COLORS.length] }} /><span className="truncate">{s.section}</span></span><strong>{s.value}</strong></div>)}</div></div>
        </section>
      </div>

      <div className="grid gap-3 xl:grid-cols-[1.3fr_.7fr]">
        <section className="rounded-xl border border-surface-200 bg-white p-3.5 shadow-card dark:border-surface-800 dark:bg-surface-900"><h2 className="mb-2 text-sm font-bold">Department Coverage</h2><div className="h-[150px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={sections} layout="vertical" margin={{ left: 10, right: 20 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8e3" /><XAxis type="number" allowDecimals={false} tick={{ fontSize: 9 }} /><YAxis type="category" dataKey="section" width={90} tick={{ fontSize: 9 }} /><Tooltip /><Bar dataKey="value" name="Features" fill="#1f6b3a" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div></section>
        <section className="rounded-xl border border-surface-200 bg-white p-3.5 shadow-card dark:border-surface-800 dark:bg-surface-900"><div className="mb-2 flex items-center justify-between"><h2 className="flex items-center gap-2 text-sm font-bold"><Sparkles className="h-4 w-4 text-brand-600" />Quick Access</h2></div><div className="space-y-1.5">{items.slice(8, 13).map((item) => <Link key={item.href} href={item.href} className="flex items-center justify-between rounded-lg border border-surface-100 px-3 py-2 text-xs hover:bg-surface-50 dark:border-surface-800"><span>{item.label}</span><ArrowRight className="h-3.5 w-3.5 text-surface-300" /></Link>)}{items.length <= 8 && <p className="py-8 text-center text-xs text-surface-400">Primary operations upar available hain.</p>}</div></section>
      </div>
    </div>
  );
}
