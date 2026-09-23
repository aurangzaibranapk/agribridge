"use client";

import Link from "next/link";
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, Bell, Boxes, CheckCircle2, Clock3, DollarSign, Download, Leaf, MapPin, RefreshCw, ShoppingCart, Sprout, Users, WalletCards } from "lucide-react";

type Row = { name: string; value: number };
type TrendRow = { label: string; sales: number; profit: number };

export function ModernMasterDashboard({
  stockDifference,
  inventoryValue,
  stockLedger,
  totalBankBalance,
  receivables,
  payables,
  totalRevenue,
  netProfit,
  totalInventoryValue,
  topSellingItems,
  topDebtors,
  salesTrend,
  missingBatchCount,
}: {
  stockDifference: number | null;
  inventoryValue: number;
  stockLedger: number | null;
  totalBankBalance: number | null;
  receivables: number | null;
  payables: number | null;
  totalRevenue: number;
  netProfit: number;
  totalInventoryValue: number;
  topSellingItems: { name: string; qty: number; unit: string }[];
  topDebtors: { name: string; balance: number }[];
  salesTrend: TrendRow[];
  missingBatchCount: number;
}) {
  const money = (n: number | null) => n === null ? "—" : `Rs ${Math.round(n).toLocaleString()}`;
  const chartProducts = topSellingItems.slice(0, 6).map((x) => ({ name: x.name.length > 18 ? `${x.name.slice(0, 18)}…` : x.name, value: x.qty }));
  const chartDebtors = topDebtors.slice(0, 5).map((x) => ({ name: x.name.length > 18 ? `${x.name.slice(0, 18)}…` : x.name, value: x.balance }));
  const hasMismatch = stockDifference !== null && Math.abs(stockDifference) > 1;

  const kpis = [
    { label: "Today Sales", value: money(totalRevenue), note: "current period", icon: ShoppingCart, color: "text-emerald-700", bg: "bg-emerald-50" },
    { label: "Net Profit", value: money(netProfit), note: netProfit >= 0 ? "positive" : "needs attention", icon: ArrowUpCircle, color: netProfit >= 0 ? "text-emerald-700" : "text-red-600", bg: netProfit >= 0 ? "bg-emerald-50" : "bg-red-50" },
    { label: "Cash & Bank", value: money(totalBankBalance), note: "ledger balance", icon: WalletCards, color: "text-sky-700", bg: "bg-sky-50" },
    { label: "Receivable", value: money(receivables), note: "customers se lena", icon: ArrowDownCircle, color: "text-amber-700", bg: "bg-amber-50" },
    { label: "Stock Value", value: money(totalInventoryValue), note: "batch cost", icon: Boxes, color: "text-violet-700", bg: "bg-violet-50" },
    { label: "Pending Approvals", value: String(missingBatchCount), note: hasMismatch ? "reconciliation required" : "all clear", icon: Bell, color: hasMismatch ? "text-orange-700" : "text-emerald-700", bg: hasMismatch ? "bg-orange-50" : "bg-emerald-50" },
  ];

  return (
    <div className="space-y-5 pb-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">AgriBridge ERP</p>
          <h1 className="font-display text-3xl font-bold tracking-tight text-surface-950 dark:text-white">Master Dashboard</h1>
          <p className="mt-1 text-sm text-surface-500">Poora business ek nazar mein — real-time business intelligence</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className="rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm shadow-sm dark:border-surface-700 dark:bg-surface-900 dark:text-white"><option>Sab Shops</option></select>
          <button className="flex items-center gap-2 rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm text-surface-700 shadow-sm dark:border-surface-700 dark:bg-surface-900 dark:text-white"><RefreshCw className="h-4 w-4" /> Refresh</button>
          <button className="flex items-center gap-2 rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm text-surface-700 shadow-sm dark:border-surface-700 dark:bg-surface-900 dark:text-white"><Download className="h-4 w-4" /> Export</button>
        </div>
      </div>

      {hasMismatch && (
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4 shadow-sm dark:border-amber-900/50 dark:from-amber-950/30 dark:to-orange-950/20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <div className="rounded-xl bg-amber-600 p-2.5 text-white"><AlertTriangle className="h-5 w-5" /></div>
              <div><p className="font-semibold text-amber-950 dark:text-amber-200">Stock ke do adad abhi barabar nahi.</p><p className="mt-1 text-xs leading-relaxed text-amber-800 dark:text-amber-300">Kisi product ka batch record missing hai. Inventory aur ledger ko reconcile karein.</p></div>
            </div>
            <div className="grid grid-cols-3 gap-5 text-sm"><div><p className="text-xs text-amber-700">Godam ki qeemat</p><p className="font-bold text-amber-950">{money(inventoryValue)}</p></div><div><p className="text-xs text-amber-700">Ledger 1200</p><p className="font-bold text-amber-950">{money(stockLedger)}</p></div><div><p className="text-xs text-amber-700">Farq</p><p className="font-bold text-red-700">{money(stockDifference)}</p></div></div>
            <Link href="/admin/inventory" className="shrink-0 rounded-xl bg-orange-700 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-orange-800">Inventory Kholo →</Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
        {kpis.map(({ label, value, note, icon: Icon, color, bg }) => <div key={label} className="rounded-2xl border border-surface-200 bg-white p-4 shadow-sm dark:border-surface-800 dark:bg-surface-900"><div className="flex items-start justify-between"><div><p className="text-xs font-medium text-surface-500">{label}</p><p className="mt-2 text-xl font-bold tracking-tight text-surface-950 dark:text-white">{value}</p><p className="mt-1 text-[11px] text-surface-400">{note}</p></div><div className={`rounded-xl p-2 ${bg} ${color}`}><Icon className="h-4 w-4" /></div></div></div>)}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.65fr_1fr]">
        <section className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm dark:border-surface-800 dark:bg-surface-900">
          <div className="mb-4 flex items-center justify-between"><div><h2 className="font-display text-base font-semibold text-surface-950 dark:text-white">Sales &amp; Profit Trend</h2><p className="text-xs text-surface-400">Recent POS performance</p></div><div className="flex gap-3 text-xs"><span className="flex items-center gap-1 text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-600" /> Sales</span><span className="flex items-center gap-1 text-lime-700"><span className="h-2 w-2 rounded-full bg-lime-500" /> Profit</span></div></div>
          <div className="h-64"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={salesTrend}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} /><Tooltip formatter={(v: any) => money(Number(v))} /><Bar dataKey="sales" fill="#16834d" radius={[4, 4, 0, 0]} /><Line type="monotone" dataKey="profit" stroke="#84cc16" strokeWidth={3} dot={{ r: 3 }} /></ComposedChart></ResponsiveContainer></div>
        </section>
        <section className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm dark:border-surface-800 dark:bg-surface-900"><div className="mb-3 flex items-center justify-between"><h2 className="font-display text-base font-semibold text-surface-950 dark:text-white">Live Business Alerts</h2><Bell className="h-4 w-4 text-brand-700" /></div><div className="space-y-2.5"><Alert icon={<AlertTriangle />} title={hasMismatch ? "Stock reconciliation required" : "Inventory is balanced"} detail={hasMismatch ? `${money(stockDifference)} ka farq` : "No mismatch detected"} tone={hasMismatch ? "amber" : "green"} /><Alert icon={<Boxes />} title="Inventory review" detail={`${missingBatchCount} item(s) batch check ke liye`} tone="blue" /><Alert icon={<ArrowDownCircle />} title="Customer recovery" detail={`${topDebtors.length} top receivable accounts`} tone="red" /><Alert icon={<Users />} title="New farmer activity" detail="Recent registrations dekhein" tone="green" /></div></section>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <DataCard title="Top Buyers" icon={<Users />}><SimpleTable headers={["#", "Buyer", "Outstanding"]} rows={topDebtors.slice(0, 5).map((x, i) => [String(i + 1), x.name, money(x.balance)])} /></DataCard>
        <section className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm dark:border-surface-800 dark:bg-surface-900"><div className="mb-3 flex items-center gap-2"><span className="text-brand-700"><Boxes className="h-5 w-5" /></span><h2 className="font-display text-base font-semibold text-surface-950 dark:text-white">Top Selling Products</h2></div><div className="h-56"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartProducts} layout="vertical" margin={{ left: 8, right: 12 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" /><XAxis type="number" tick={{ fontSize: 10 }} /><YAxis dataKey="name" type="category" width={95} tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="value" fill="#39a96b" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer></div></section>
        <DataCard title="New Farmers" icon={<Sprout />}><SimpleTable headers={["Name", "Status", "Action"]} rows={[["Recent registrations", `${missingBatchCount} pending`, "View"], ["Farmer activity", "Live", "Open"], ["Portal onboarding", "Active", "View"]]} /></DataCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-2"><section className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm dark:border-surface-800 dark:bg-surface-900"><div className="mb-3 flex items-center gap-2"><MapPin className="h-5 w-5 text-brand-700" /><h2 className="font-display text-base font-semibold text-surface-950 dark:text-white">Sales by Location</h2></div><div className="h-56"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartDebtors} layout="vertical" margin={{ left: 8, right: 12 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" /><XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} /><YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 10 }} /><Tooltip formatter={(v: any) => money(Number(v))} /><Bar dataKey="value" fill="#6abf91" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer></div></section><DataCard title="Inventory & Finance Alerts" icon={<DollarSign />}><div className="space-y-3 text-sm"><Alert icon={<Clock3 />} title="Stock mismatch" detail={money(stockDifference)} tone="amber" /><Alert icon={<ArrowUpCircle />} title="Payables" detail={money(payables)} tone="red" /><Alert icon={<CheckCircle2 />} title="Cash position" detail={money(totalBankBalance)} tone="green" /></div></DataCard></div>
    </div>
  );
}

function DataCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) { return <section className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm dark:border-surface-800 dark:bg-surface-900"><div className="mb-3 flex items-center gap-2"><span className="text-brand-700">{icon}</span><h2 className="font-display text-base font-semibold text-surface-950 dark:text-white">{title}</h2></div>{children}</section>; }
function SimpleTable({ headers, rows }: { headers: string[]; rows: string[][] }) { return <div className="overflow-hidden rounded-xl border border-surface-100 dark:border-surface-800"><table className="w-full text-left text-xs"><thead className="bg-surface-50 text-surface-500 dark:bg-surface-800"><tr>{headers.map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i} className="border-t border-surface-100 dark:border-surface-800"><>{row.map((cell, j) => <td key={j} className={`px-3 py-2 ${j === row.length - 1 ? "font-semibold text-brand-700" : "text-surface-700 dark:text-surface-200"}`}>{cell}</td>)}</></tr>)}</tbody></table></div>; }
function Alert({ icon, title, detail, tone }: { icon: React.ReactNode; title: string; detail: string; tone: "amber" | "red" | "green" | "blue" }) { const tones = { amber: "bg-amber-50 text-amber-700", red: "bg-red-50 text-red-600", green: "bg-emerald-50 text-emerald-700", blue: "bg-sky-50 text-sky-700" }; return <div className="flex items-center gap-3 rounded-xl border border-surface-100 p-2.5 dark:border-surface-800"><span className={`rounded-lg p-1.5 ${tones[tone]}`}>{icon}</span><div className="min-w-0"><p className="truncate text-xs font-semibold text-surface-800 dark:text-surface-100">{title}</p><p className="truncate text-[11px] text-surface-400">{detail}</p></div></div>; }
