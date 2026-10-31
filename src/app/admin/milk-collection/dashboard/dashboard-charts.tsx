"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function TrendChart({ data }: { data: { date: string; aaya: number; gaya: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gAaya" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#1f6b3a" stopOpacity={0.3} /><stop offset="100%" stopColor="#1f6b3a" stopOpacity={0} /></linearGradient>
          <linearGradient id="gGaya" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#2b5f8a" stopOpacity={0.25} /><stop offset="100%" stopColor="#2b5f8a" stopOpacity={0} /></linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e3e9e3" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v) => `${Number(v).toFixed(1)} L`} />
        <Legend />
        <Area type="monotone" dataKey="aaya" name="Aaya (chiller)" stroke="#1f6b3a" strokeWidth={2.5} fill="url(#gAaya)" />
        <Area type="monotone" dataKey="gaya" name="Gaya (dispatch)" stroke="#2b5f8a" strokeWidth={2.5} fill="url(#gGaya)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

const COLORS = ["#1f6b3a", "#2b5f8a", "#d9a62e", "#1a8a80", "#c03636"];

export function CarrierDonut({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={62} outerRadius={96} paddingAngle={2}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip formatter={(v) => `${Number(v).toFixed(1)} L`} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function ChillerBars({ data }: { data: { name: string; aaya: number; gaya: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e3e9e3" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v) => `${Number(v).toFixed(1)} L`} />
        <Legend />
        <Bar dataKey="aaya" name="Aaya" fill="#1f6b3a" radius={[6, 6, 0, 0]} />
        <Bar dataKey="gaya" name="Gaya" fill="#2b5f8a" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
