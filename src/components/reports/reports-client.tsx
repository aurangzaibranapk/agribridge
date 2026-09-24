"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Input, Label, Badge } from "@/components/ui/form";
import { Card } from "@/components/ui/layout-primitives";
import { TrendingUp, Wallet, Receipt, AlertTriangle } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

interface SalesSummary {
  total_sales: number;
  cash_total: number;
  khata_total: number;
  transaction_count: number;
  total_profit: number;
}

interface AgingRow {
  customer_id: string;
  customer_name: string;
  phone: string | null;
  balance: number;
  last_transaction_date: string | null;
  days_outstanding: number | null;
}

export function ReportsClient({
  dealerName,
  summary,
  aging,
}: {
  dealerName: string;
  summary: SalesSummary | null;
  aging: AgingRow[];
}) {
  const supabase = createClient();
  const lang = useLang();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [currentSummary, setCurrentSummary] = useState<SalesSummary | null>(summary);
  const [loading, setLoading] = useState(false);

  async function loadForDate(newDate: string) {
    setDate(newDate);
    setLoading(true);
    const { data } = await supabase.rpc("get_daily_sales_summary", { p_date: newDate });
    setCurrentSummary(data?.[0] ?? null);
    setLoading(false);
  }

  function agingTone(days: number | null) {
    if (days === null) return "gray" as const;
    if (days >= 30) return "red" as const;
    if (days >= 15) return "amber" as const;
    return "green" as const;
  }

  const s = currentSummary ?? {
    total_sales: 0,
    cash_total: 0,
    khata_total: 0,
    transaction_count: 0,
    total_profit: 0,
  };

  return (
    <div className="space-y-8 p-4">
      <div>
        <h1 className="font-display text-xl font-semibold text-surface-900 dark:text-white">
          {dealerName} — Reports
        </h1>
        <p className="mt-1 text-sm text-surface-500">{t("sh_reports_sub", lang)}</p>
      </div>

      {/* Daily Sales Summary */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-surface-900 dark:text-surface-100">{t("sh_daily_sales", lang)}</h2>
          <div className="w-48">
            <Input type="date" value={date} onChange={(e) => loadForDate(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <p className="py-6 text-center text-sm text-surface-400">{t("ba_loading", lang)}</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Card className="border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
              <div className="flex items-center gap-2 text-surface-500">
                <Receipt className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">{t("sh_transactions", lang)}</span>
              </div>
              <p className="mt-2 font-display text-xl font-semibold text-surface-900 dark:text-white">
                {s.transaction_count}
              </p>
            </Card>

            <Card className="border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
              <div className="flex items-center gap-2 text-surface-500">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">{t("sh_total_sales", lang)}</span>
              </div>
              <p className="mt-2 font-display text-xl font-semibold text-surface-900 dark:text-white">
                Rs {s.total_sales.toLocaleString()}
              </p>
            </Card>

            <Card className="border-brand-200 bg-brand-50 dark:border-brand-900/40 dark:bg-brand-950/30">
              <div className="flex items-center gap-2 text-brand-600">
                <Wallet className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">{t("sh_cash_received", lang)}</span>
              </div>
              <p className="mt-2 font-display text-xl font-semibold text-brand-700 dark:text-brand-300">
                Rs {s.cash_total.toLocaleString()}
              </p>
            </Card>

            <Card className="border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/30">
              <div className="flex items-center gap-2 text-red-600">
                <Wallet className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">{t("sh_khata_credit", lang)}</span>
              </div>
              <p className="mt-2 font-display text-xl font-semibold text-red-700 dark:text-red-300">
                Rs {s.khata_total.toLocaleString()}
              </p>
            </Card>

            <Card className="border-purple-200 bg-purple-50 dark:border-purple-900/40 dark:bg-purple-950/30">
              <div className="flex items-center gap-2 text-purple-600">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">{t("sh_est_profit", lang)}</span>
              </div>
              <p className="mt-2 font-display text-xl font-semibold text-purple-700 dark:text-purple-300">
                Rs {s.total_profit.toLocaleString()}
              </p>
            </Card>
          </div>
        )}
      </div>

      {/* Khata Aging Report */}
      <div>
        <div className="mb-4 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-surface-500" />
          <h2 className="font-display text-base font-semibold text-surface-900 dark:text-surface-100">{t("sh_khata_aging", lang)}</h2>
        </div>

        <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                <th className="px-4 py-3 font-medium text-surface-500">{t("db_customer", lang)}</th>
                <th className="px-4 py-3 font-medium text-surface-500">{t("c_phone", lang)}</th>
                <th className="px-4 py-3 text-right font-medium text-surface-500">{t("c_balance", lang)}</th>
                <th className="px-4 py-3 text-right font-medium text-surface-500">{t("sh_days_outstanding", lang)}</th>
              </tr>
            </thead>
            <tbody>
              {aging.map((row) => (
                <tr key={row.customer_id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                  <td className="px-4 py-3 font-medium text-surface-800 dark:text-surface-200">
                    {row.customer_name}
                  </td>
                  <td className="px-4 py-3 text-surface-500">{row.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold text-red-600">
                    Rs {row.balance.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Badge tone={agingTone(row.days_outstanding)}>
                      {row.days_outstanding ?? 0} days
                    </Badge>
                  </td>
                </tr>
              ))}
              {aging.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-surface-400">{t("sh_no_khata", lang)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
