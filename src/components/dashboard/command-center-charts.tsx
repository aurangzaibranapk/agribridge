"use client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

/** Pichle 30 din ki POS bikri -- asal roz ki raqam, seedhi lakeer. */
export function SalesTrendChart({ points }: { points: { date: string; amount: number }[] }) {
  const data = points.map((p) => ({ ...p, label: p.date.slice(5) }));
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={4} />
        <YAxis tick={{ fontSize: 10 }} width={44} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
        <Tooltip formatter={(value) => [`Rs ${Number(value).toLocaleString()}`, "Sale"]} labelFormatter={(l) => `Date: ${l}`} />
        <Line type="monotone" dataKey="amount" stroke="#16a34a" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Rang har department ke liye fixed hain (categorical, kabhi cycle nahi). */
const DEPT_COLOR = ["#10b981", "#0ea5e9", "#8b5cf6", "#f59e0b", "#f43f5e", "#06b6d4", "#6366f1", "#84cc16"];

export function DeptSalesDonut({ slices }: { slices: { key: string; label: string; amount: number }[] }) {
  const real = slices.filter((s) => s.amount > 0);
  const total = real.reduce((s, m) => s + m.amount, 0);
  if (total <= 0) return <p className="py-6 text-center text-xs text-surface-400">Is mahine ka data abhi nahi.</p>;

  return (
    <div className="flex items-center gap-4">
      <div className="h-[140px] w-[140px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={real} dataKey="amount" nameKey="label" innerRadius={38} outerRadius={62} paddingAngle={2} stroke="none">
              {real.map((s, i) => (
                <Cell key={s.key} fill={DEPT_COLOR[i % DEPT_COLOR.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value, name) => [`Rs ${Number(value).toLocaleString()}`, String(name)]} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="min-w-0 flex-1 space-y-1.5">
        {real.map((s, i) => (
          <li key={s.key} className="flex items-center justify-between gap-2 text-[11px]">
            <span className="flex min-w-0 items-center gap-1.5 text-surface-600 dark:text-surface-300">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: DEPT_COLOR[i % DEPT_COLOR.length] }} />
              <span className="truncate">{s.label}</span>
            </span>
            <span className="shrink-0 font-medium tabular-nums text-surface-800 dark:text-surface-100">
              {Math.round((s.amount / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
