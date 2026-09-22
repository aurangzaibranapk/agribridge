"use client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

interface ShopChartData {
  name: string;
  revenue: number;
  cogs: number;
  expenses: number;
  netProfit: number;
}
interface ExpenseSlice {
  name: string;
  value: number;
}

const PIE_COLORS = ["#16a34a", "#2563eb", "#f59e0b", "#dc2626", "#8b5cf6", "#0891b2", "#64748b"];

export function PnlCharts({ shops, expenseBreakdown }: { shops: ShopChartData[]; expenseBreakdown: ExpenseSlice[] }) {
  const lang = useLang();
  if (shops.length === 0 && expenseBreakdown.length === 0) return null;

  return (
    <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
      {shops.length > 0 && (
        <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
          <h3 className="mb-3 text-sm font-semibold text-surface-900 dark:text-white">{t("rr_shop_comparison", lang)}</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={shops}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value: number) => `Rs ${value.toLocaleString()}`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="revenue" name="Sale (Revenue)" fill="#2563eb" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill="#dc2626" radius={[4, 4, 0, 0]} />
              <Bar dataKey="netProfit" name="Net Profit" fill="#16a34a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {expenseBreakdown.length > 0 && (
        <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
          <h3 className="mb-3 text-sm font-semibold text-surface-900 dark:text-white">{t("rr_where_spent", lang)}</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={expenseBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(entry) => entry.name}>
                {expenseBreakdown.map((_, idx) => (
                  <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => `Rs ${value.toLocaleString()}`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}