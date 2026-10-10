"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { toCsv, type RangeKey } from "@/lib/reports/pnl";

type Card = { value: number; previous: number; change: number | null };
export type DashboardData = {
  range: { key: RangeKey; from: string; to: string; grain: "day" | "month" };
  branch: string | null;
  branches: { id: string; name: string }[];
  cards: { revenue: Card; cogs: Card; gross_profit: Card; net_profit: Card };
  operating_expenses: number; stock_adjustments: number;
  trend: { bucket: string; revenue: number; cogs: number; expenses: number; net_profit: number }[];
  expenses: { name: string; value: number }[];
  products: { name: string; qty: number; revenue: number; cogs: number; profit: number; margin: number | null; flagged: number }[];
  departments: { name: string; revenue: number; cogs: number; gross: number; expenses: number; net: number; margin: number | null }[];
  health: { issue: string; count: number; amount: number; link: string }[];
};

const COLORS = ["#16a34a", "#2563eb", "#f59e0b", "#dc2626", "#8b5cf6", "#0891b2", "#64748b"];
const rs = (n: number) => `Rs ${Math.round(n).toLocaleString("en-PK")}`;
const box = "rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900";
const HEALTH_LABELS: Record<string, string> = {
  cost_above_price: "Lagat qeemat se zyada (cost > price) lines",
  grain_procurement_no_journal: "Grain khareed jo ledger mein nahi gayi",
  grain_payment_no_journal: "Grain payment jo ledger mein nahi gayi",
  stock_adjustment_share_pct: "Stock count adjustment (6110) kharchon ka %",
};

function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href);
}

export function ProfitLossDashboard({ data }: { data: DashboardData }) {
  const router = useRouter();
  const [from, setFrom] = useState(data.range.from);
  const [to, setTo] = useState(data.range.to);
  const go = (patch: Record<string, string | null>) => {
    const q = new URLSearchParams();
    const merged = { range: data.range.key, branch: data.branch, ...(data.range.key === "custom" ? { from: data.range.from, to: data.range.to } : {}), ...patch };
    Object.entries(merged).forEach(([k, v]) => { if (v) q.set(k, v); });
    router.push(`/admin/reports/profit-loss?${q.toString()}`);
  };

  const exportRows = (): (string | number | null)[][] => [
    ["Period", `${data.range.from} to ${data.range.to}`],
    [],
    ["Metric", "Current", "Previous", "Change %"],
    ...(["revenue", "cogs", "gross_profit", "net_profit"] as const).map((k) => [k, data.cards[k].value, data.cards[k].previous, data.cards[k].change]),
    ["operating_expenses", data.operating_expenses], ["stock_adjustments_6110", data.stock_adjustments],
    [], ["Expense group", "Amount"], ...data.expenses.map((e) => [e.name, e.value]),
    [], ["Department", "Revenue", "COGS", "Gross", "Expenses", "Net", "Margin %"], ...data.departments.map((d) => [d.name, d.revenue, d.cogs, d.gross, d.expenses, d.net, d.margin]),
    [], ["Product", "Qty", "Revenue", "COGS", "Profit", "Margin %", "Cost>Price lines"], ...data.products.map((p) => [p.name, p.qty, p.revenue, p.cogs, p.profit, p.margin, p.flagged]),
  ];
  const exportCsv = () => download(`pnl_${data.range.from}_${data.range.to}.csv`, "\ufeff" + toCsv(exportRows()), "text/csv;charset=utf-8");
  // Excel 2003 XML spreadsheet: Excel khud khol leta hai, koi nayi library nahi chahiye.
  const exportXls = () => {
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const xmlRows = exportRows().map((r) => `<Row>${r.map((c) => typeof c === "number" ? `<Cell><Data ss:Type="Number">${c}</Data></Cell>` : `<Cell><Data ss:Type="String">${esc(String(c ?? ""))}</Data></Cell>`).join("")}</Row>`).join("");
    const xml = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="PnL"><Table>${xmlRows}</Table></Worksheet></Workbook>`;
    download(`pnl_${data.range.from}_${data.range.to}.xls`, xml, "application/vnd.ms-excel");
  };

  const cards = [
    { k: "revenue", label: "Kul Bikri / Revenue", good: true },
    { k: "cogs", label: "Maal ki Lagat / COGS", good: false },
    { k: "gross_profit", label: "Gross Munafa / Gross Profit", good: true },
    { k: "net_profit", label: "Asal Munafa / Net Profit", good: true },
  ] as const;
  const healthIssues = data.health.filter((h) => h.issue === "stock_adjustment_share_pct" ? h.amount > 20 : h.count > 0);

  return (
    <div className="space-y-4">
      <div className={`${box} flex flex-wrap items-end gap-3`}>
        <div className="flex flex-wrap gap-1">
          {([["this_month", "Yeh Mahina / This Month"], ["last_month", "Pichla Mahina / Last Month"], ["this_year", "Yeh Saal / This Year"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => go({ range: k, from: null, to: null })} className={`rounded-lg px-3 py-2 text-sm ${data.range.key === k ? "bg-brand-600 text-white" : "bg-surface-100 dark:bg-surface-800"}`}>{l}</button>
          ))}
        </div>
        <label className="text-xs">Se / From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="ml-1 rounded border px-2 py-1 dark:bg-surface-800" /></label>
        <label className="text-xs">Tak / To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="ml-1 rounded border px-2 py-1 dark:bg-surface-800" /></label>
        <button onClick={() => go({ range: "custom", from, to })} className={`rounded-lg px-3 py-2 text-sm ${data.range.key === "custom" ? "bg-brand-600 text-white" : "bg-surface-100 dark:bg-surface-800"}`}>Custom</button>
        <select value={data.branch ?? ""} onChange={(e) => go({ branch: e.target.value || null })} className="rounded-lg border px-2 py-2 text-sm dark:bg-surface-800">
          <option value="">Sab Dukanen / All Branches</option>
          {data.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <div className="ml-auto flex gap-2">
          <button onClick={exportCsv} className="rounded-lg border px-3 py-2 text-sm">CSV</button>
          <button onClick={exportXls} className="rounded-lg border px-3 py-2 text-sm">Excel</button>
        </div>
      </div>

      {healthIssues.length > 0 && (
        <div className="rounded-card border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
          <p className="font-semibold">Data mein masle / Data health warnings — in ki wajah se adad poore sahi nahi:</p>
          <ul className="mt-1 list-disc pl-5">
            {healthIssues.map((h) => (
              <li key={h.issue}><Link href={h.link} className="underline">{HEALTH_LABELS[h.issue] ?? h.issue}</Link>: {h.issue === "stock_adjustment_share_pct" ? `${h.amount}% (is mahine)` : `${h.count} (${rs(h.amount)})`}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ k, label, good }) => {
          const c = data.cards[k];
          const up = (c.change ?? 0) >= 0;
          const positive = good ? up : !up;
          return (
            <div key={k} className={box}>
              <p className="text-xs text-surface-400">{label}</p>
              <p className={`mt-1 font-display text-2xl font-bold ${k === "net_profit" && c.value < 0 ? "text-red-600" : "text-surface-900 dark:text-white"}`}>{rs(c.value)}</p>
              <p className={`mt-1 text-xs ${c.change == null ? "text-surface-400" : positive ? "text-green-600" : "text-red-600"}`}>
                {c.change == null ? "Pichla period: —" : `${up ? "▲" : "▼"} ${Math.abs(c.change)}% pichle period se / vs previous`}
              </p>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-surface-500">Kharche / Operating expenses: {rs(data.operating_expenses)} · Stock ginti ka farq (6110) alag / Stock-count adjustments shown separately: {rs(data.stock_adjustments)}</p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className={`${box} lg:col-span-2`}>
          <h3 className="mb-3 text-sm font-semibold">Rujhan / Trend ({data.range.grain === "month" ? "mahana" : "rozana"})</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data.trend}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="bucket" fontSize={11} /><YAxis fontSize={11} />
              <Tooltip formatter={(v) => rs(Number(v))} /><Legend />
              <Line type="monotone" dataKey="revenue" name="Bikri" stroke="#16a34a" dot={false} />
              <Line type="monotone" dataKey="cogs" name="Lagat" stroke="#f59e0b" dot={false} />
              <Line type="monotone" dataKey="net_profit" name="Munafa" stroke="#2563eb" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className={box}>
          <h3 className="mb-3 text-sm font-semibold">Kharche / Expenses</h3>
          {data.expenses.length === 0 ? <p className="text-sm text-surface-400">Koi kharcha nahi</p> : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={data.expenses} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95}>
                  {data.expenses.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => rs(Number(v))} /><Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className={`${box} overflow-x-auto`}>
          <h3 className="mb-3 text-sm font-semibold">Product wise Munafa / Top Products by Profit</h3>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-surface-400"><th>Product</th><th className="text-right">Bikri</th><th className="text-right">Munafa</th><th className="text-right">Margin</th></tr></thead>
            <tbody>
              {data.products.map((p) => (
                <tr key={p.name} className={`border-t border-surface-100 dark:border-surface-800 ${p.flagged ? "bg-red-50 dark:bg-red-950" : ""}`}>
                  <td className="py-1">{p.name}{p.flagged > 0 && <span className="ml-1 text-xs text-red-600" title="Lagat qeemat se zyada">⚠ {p.flagged}</span>}</td>
                  <td className="text-right">{rs(p.revenue)}</td>
                  <td className={`text-right ${p.profit < 0 ? "text-red-600" : ""}`}>{rs(p.profit)}</td>
                  <td className="text-right">{p.margin == null ? "—" : `${p.margin}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={`${box} overflow-x-auto`}>
          <h3 className="mb-3 text-sm font-semibold">Shoba wise Munafa / Profit by Department</h3>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-surface-400"><th>Shoba</th><th className="text-right">Bikri</th><th className="text-right">Lagat</th><th className="text-right">Kharche</th><th className="text-right">Munafa</th><th className="text-right">Margin</th></tr></thead>
            <tbody>
              {data.departments.map((d) => (
                <tr key={d.name} className="border-t border-surface-100 dark:border-surface-800">
                  <td className="py-1">{d.name}</td><td className="text-right">{rs(d.revenue)}</td><td className="text-right">{rs(d.cogs)}</td>
                  <td className="text-right">{rs(d.expenses)}</td><td className={`text-right ${d.net < 0 ? "text-red-600" : ""}`}>{rs(d.net)}</td>
                  <td className="text-right">{d.margin == null ? "—" : `${d.margin}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={`${box} flex flex-wrap gap-2 text-sm`}>
        {[["/admin/reports/sales", "Bikri Report / Sales"], ["/admin/reports/stock-value", "Stock Value"], ["/admin/finance/ledger", "Ledger"], ["/admin/finance/statement-of-account", "Statement of Account"], ["/admin/reports/pnl", "Purana P&L / Shop-wise P&L"]].map(([href, l]) => (
          <Link key={href} href={href} className="rounded-lg bg-surface-100 px-3 py-2 hover:bg-surface-200 dark:bg-surface-800">{l}</Link>
        ))}
      </div>
    </div>
  );
}
