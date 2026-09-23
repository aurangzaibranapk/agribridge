"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ShopDailySalesPoint } from "@/lib/pos/shop-360";

interface ShopSalesChartProps {
  data: ShopDailySalesPoint[];
}

function formatRs(v: number) {
  if (v >= 100000) return `Rs ${(v / 1000).toFixed(0)}k`;
  if (v >= 1000) return `Rs ${(v / 1000).toFixed(1)}k`;
  return `Rs ${v.toLocaleString()}`;
}

export function ShopSalesChart({ data }: ShopSalesChartProps) {
  const hasAny = data.some((d) => d.total > 0);

  if (!hasAny) {
    return (
      <div className="flex h-24 items-center justify-center text-[12px] text-surface-400">
        Is period mein koi sale nahi hui.
      </div>
    );
  }

  return (
    <div className="h-28 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#d1fae5" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#6ee7b7" tickLine={false} />
          <YAxis tickFormatter={(v) => formatRs(v)} tick={{ fontSize: 10 }} stroke="#6ee7b7" tickLine={false} width={52} />
          <Tooltip
            formatter={(value) => [`Rs ${Number(value).toLocaleString()}`, "Sale"]}
            contentStyle={{ borderRadius: 8, border: "1px solid #d1fae5", fontSize: 11 }}
            cursor={{ fill: "#ecfdf5" }}
          />
          <Bar dataKey="total" fill="#10b981" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
