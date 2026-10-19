"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const AXIS = { fontSize: 11, fill: "#7c8a9e" };
const GRID = "rgba(148,163,184,0.22)";
const tip = {
  contentStyle: { borderRadius: 12, border: "1px solid rgba(148,163,184,.25)", fontSize: 12, background: "rgba(255,255,255,.97)", color: "#0f1f17" },
};

export function MilkAreaChart({ data }: { data: { label: string; liters: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={230}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="milkFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} interval={4} tickLine={false} axisLine={false} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip {...tip} formatter={(v: unknown) => [`${v} L`, ""] as [string, string]} />
        <Area type="monotone" dataKey="liters" stroke="#0ea5e9" strokeWidth={2.5} fill="url(#milkFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export interface MonthBarsLabels {
  udhaar: string;
  adaigi: string;
  milk: string;
  kharcha: string;
}

export function MonthBarsChart({
  data,
  labels,
}: {
  data: { label: string; udhaar: number; adaigi: number; milk: number; kharcha: number }[];
  labels: MonthBarsLabels;
}) {
  // Sirf wo silsile dikhao jin mein kuch hai -- khali rangon ki legend shor hai.
  const series = (
    [
      ["udhaar", "#f43f5e"],
      ["adaigi", "#16a34a"],
      ["milk", "#0ea5e9"],
      ["kharcha", "#f59e0b"],
    ] as const
  ).filter(([k]) => data.some((d) => d[k] > 0));
  return (
    <ResponsiveContainer width="100%" height={210}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
        <YAxis
          tick={AXIS}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
        />
        <Tooltip {...tip} formatter={(v: unknown, name: unknown) => [`Rs ${Math.round(Number(v)).toLocaleString("en-IN")}`, String(name)] as [string, string]} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
        {series.map(([k, c]) => (
          <Bar key={k} dataKey={k} name={labels[k]} fill={c} radius={[5, 5, 0, 0]} maxBarSize={22} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function HerdDonut({ parts, centerLabel }: { parts: { name: string; value: number; color: string }[]; centerLabel: string }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  const shown = parts.filter((p) => p.value > 0);
  return (
    <div className="flex items-center gap-5">
      <div className="relative h-[150px] w-[150px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={shown} dataKey="value" innerRadius={48} outerRadius={70} paddingAngle={2} stroke="none">
              {shown.map((p) => (
                <Cell key={p.name} fill={p.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-extrabold text-surface-900 dark:text-white">{total}</span>
          <span className="text-[10px] text-surface-500 dark:text-slate-400">{centerLabel}</span>
        </div>
      </div>
      <ul className="space-y-2 text-[13px]">
        {parts.map((p) => (
          <li key={p.name} className="flex items-center gap-2 text-surface-700 dark:text-slate-300">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: p.color }} />
            {p.name} <b className="text-surface-900 dark:text-white">{p.value}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}
