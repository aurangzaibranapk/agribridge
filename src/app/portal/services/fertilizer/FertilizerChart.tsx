"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

type ChartItem = {
  crop_type: string;
  count: number;
};

const COLORS = ["#f59e0b", "#16a34a", "#2563eb", "#7c3aed", "#dc2626", "#0891b2"];

export default function FertilizerChart({ data }: { data: ChartItem[] }) {
  if (data.length === 0) return null;

  return (
    <div className="mt-6 rounded-card border border-surface-200 bg-white p-4 shadow-card">
      <h3 className="mb-3 text-sm font-semibold text-surface-900">Requests by Crop Type</h3>
      <ResponsiveContainer width="100%" height={Math.max(120, data.length * 50)}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
          <XAxis type="number" allowDecimals={false} hide />
          <YAxis type="category" dataKey="crop_type" width={100} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={20}>
            {data.map((_, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}