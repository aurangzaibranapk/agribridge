"use client";
import { useState } from "react";
import { ChevronDown, Receipt, TrendingUp, TrendingDown } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const CATEGORY_LABELS: Record<string, string> = {
  land_prep: "Zameen Tayari",
  seed: "Beej",
  water: "Pani",
  fertilizer: "Khaad",
  spray: "Spray/Pesticide",
  labor: "Mazdori",
  other: "Doosra",
};

interface CategoryTotal {
  category: string;
  amount: number;
}

export function ExpenseStatement({
  categoryTotals,
  totalExpense,
  totalRevenue,
}: {
  categoryTotals: CategoryTotal[];
  totalExpense: number;
  totalRevenue: number;
}) {
  const [open, setOpen] = useState(false);
  const lang = useLang();
  const netProfit = totalRevenue - totalExpense;

  return (
    <div className="rounded-card border border-surface-200 bg-white shadow-card">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 font-display text-sm font-semibold text-surface-900">
          <Receipt className="h-4 w-4 text-brand-600" />{t("pm_expense_income_stmt", lang)}</span>
        <ChevronDown className={`h-4 w-4 text-surface-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <div className="grid grid-cols-3 gap-2 border-t border-surface-100 px-4 py-3">
        <div>
          <p className="text-xs text-surface-500">{t("pm_total_expense", lang)}</p>
          <p className="text-sm font-semibold text-red-600">Rs {totalExpense.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-surface-500">{t("pm_total_income", lang)}</p>
          <p className="text-sm font-semibold text-green-600">Rs {totalRevenue.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-surface-500">{t("pm_net_profit", lang)}</p>
          <p className={`flex items-center gap-1 text-sm font-semibold ${netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
            {netProfit >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            Rs {netProfit.toLocaleString()}
          </p>
        </div>
      </div>

      {open && (
        <div className="border-t border-surface-100 px-4 py-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-surface-400">{t("pm_expense_by_category", lang)}</p>
          <table className="w-full text-sm">
            <tbody>
              {categoryTotals.length === 0 ? (
                <tr>
                  <td className="py-2 text-center text-surface-400">{t("pm_no_expense", lang)}</td>
                </tr>
              ) : (
                categoryTotals.map((c) => (
                  <tr key={c.category} className="border-b border-surface-50 last:border-0">
                    <td className="py-1.5 text-surface-600">{CATEGORY_LABELS[c.category] ?? c.category}</td>
                    <td className="py-1.5 text-right font-medium text-surface-900">Rs {c.amount.toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}