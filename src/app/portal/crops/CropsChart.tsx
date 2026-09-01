"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

type ChartCrop = {
  crop_name: string;
  percent: number;
  daysRemaining: number;
};

export default function CropsChart({ data }: { data: ChartCrop[] }) {
  const lang = useLang();
  if (data.length === 0) return null;

  return (
    <div className="mt-6 rounded-card border border-surface-200 bg-white p-4 shadow-card">
      <h3 className="mb-3 text-sm font-semibold text-surface-900">{t("pm_chart_progress", lang)}</h3>
      <ResponsiveContainer width="100%" height={Math.max(120, data.length * 50)}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
          <XAxis type="number" domain={[0, 100]} hide />
          <YAxis type="category" dataKey="crop_name" width={90} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value: any) => [`${value}%`, "Complete"]} />
          <Bar dataKey="percent" radius={[0, 6, 6, 0]} barSize={20}>
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.daysRemaining <= 0 ? "#16a34a" : entry.daysRemaining <= 14 ? "#f59e0b" : "#16a34a"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}