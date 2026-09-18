"use client";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

/**
 * Aaj kis tareeqe se kitna aaya -- donut chart.
 *
 * Rang har tareeqe ke liye fixed hain (categorical, kabhi cycle nahi
 * hote) -- taake "Cash" hamesha wohi rang rahe, chahe us din koi aur
 * tareeqa istemal ho ya na ho.
 */
const METHOD_COLOR: Record<string, string> = {
  cash: "#10b981",
  bank_transfer: "#0ea5e9",
  card: "#8b5cf6",
  jazzcash: "#f43f5e",
  easypaisa: "#f59e0b",
  qr: "#06b6d4",
  khata: "#64748b",
  waseela_card: "#6366f1",
  load: "#22c55e",
};

export function PaymentDonut({ slices }: { slices: { key: string; label: string; amount: number }[] }) {
  const total = slices.reduce((s, m) => s + m.amount, 0);
  if (total <= 0 || slices.length === 0) return null;

  return (
    <div className="flex items-center gap-4">
      <div className="h-32 w-32 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="amount" nameKey="label" innerRadius={38} outerRadius={58} paddingAngle={2} stroke="none">
              {slices.map((s) => (
                <Cell key={s.key} fill={METHOD_COLOR[s.key] ?? "#94a3b8"} />
              ))}
            </Pie>
            <Tooltip formatter={(value, name) => [`Rs ${Number(value).toLocaleString()}`, String(name)]} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="min-w-0 flex-1 space-y-1.5">
        {slices.map((s) => (
          <li key={s.key} className="flex items-center justify-between gap-2 text-[12px]">
            <span className="flex min-w-0 items-center gap-1.5 text-surface-600 dark:text-surface-300">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: METHOD_COLOR[s.key] ?? "#94a3b8" }} />
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
