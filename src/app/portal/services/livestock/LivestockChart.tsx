"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

type ChartItem = {
  animal: string;
  count: number;
};

const COLORS = ["#7c3aed", "#16a34a", "#f59e0b"];

export default function LivestockChart({ data }: { data: ChartItem[] }) {
  const lang = useLang();
  const total = data.reduce((sum, d) => sum + d.count, 0);
  if (total === 0) return null;

  return (
    <div className="mt-6 rounded-card border border-surface-200 bg-white p-4 shadow-card">
      <h3 className="mb-3 text-sm font-semibold text-surface-900">{t("pm_chart_animals", lang)}</h3>
      <ResponsiveContainer width="100%" height={Math.max(120, data.length * 50)}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
          <XAxis type="number" allowDecimals={false} hide />
          <YAxis type="category" dataKey="animal" width={80} tick={{ fontSize: 12 }} />
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