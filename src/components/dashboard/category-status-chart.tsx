"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

interface CategoryStatusChartProps {
  data: { status: string; count: number }[];
  color: string;
}

export function CategoryStatusChart({ data, color }: CategoryStatusChartProps) {
  const lang = useLang();
  const shades = [`${color}`, `${color}b3`, `${color}59`];

  const hasData = data.some((d) => d.count > 0);

  if (!hasData) {
    return (
      <div className="flex h-48 w-full items-center justify-center text-sm text-surface-400">{t("sh_no_requests", lang)}</div>
    );
  }

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="count" nameKey="status" innerRadius={40} outerRadius={65} paddingAngle={2}>
            {data.map((entry, index) => (
              <Cell key={entry.status} fill={shades[index % shades.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
