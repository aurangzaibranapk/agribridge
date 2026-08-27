"use client";

import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

type TrendPoint = { month: string; requests: number };
type ServicePoint = { service: string; count: number };

export function ActivityTrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <div className="rounded-2xl border border-surface-200 bg-white p-5 shadow-card">
      <h3 className="mb-4 text-sm font-semibold text-surface-900">Activity Trend</h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
          <Tooltip />
          <Line type="monotone" dataKey="requests" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ServiceBreakdownChart({ data }: { data: ServicePoint[] }) {
  return (
    <div className="rounded-2xl border border-surface-200 bg-white p-5 shadow-card">
      <h3 className="mb-4 text-sm font-semibold text-surface-900">Requests by Service</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis dataKey="service" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" fill="#f59e0b" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}