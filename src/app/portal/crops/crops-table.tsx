"use client";
import { useState } from "react";
import { ChevronDown, Sprout, Trash2 } from "lucide-react";
import { CropExpensePanel } from "./crop-expense-panel";
import { EditCropButton } from "./edit-crop-modal";
import { deleteCropAction } from "./actions";
import { useLanguage } from "@/hooks/useLanguage";
import { t } from "@/lib/i18n/translations";

interface RateOption {
  id: string;
  name: string;
  rate: number;
}

interface ExpenseOptions {
  landPrep: RateOption[];
  labor: RateOption[];
  fertilizer: RateOption[];
  pesticide: RateOption[];
  seed: RateOption[];
}

interface Expense {
  id: string;
  expense_category: string;
  source: string;
  description: string | null;
  amount: number;
}

interface CropRow {
  id: string;
  cropName: string;
  farmName: string;
  sowingDate: string;
  harvestDate: string;
  percent: number;
  daysRemaining: number;
  daysElapsed: number;
  totalDays: number;
  areaSownAcres: number | null;
  isBooked: boolean;
  expenses: Expense[];
}

export function CropsTable({ crops, expenseOptions }: { crops: CropRow[]; expenseOptions: ExpenseOptions }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { language: lang } = useLanguage();

  return (
    <div className="overflow-x-auto rounded-card border border-surface-200 bg-white shadow-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-200 bg-surface-50 text-left text-xs font-medium text-surface-500">
            <th className="px-3 py-2">{t("crop", lang)}</th>
            <th className="px-3 py-2">{t("farm_label", lang)}</th>
            <th className="px-3 py-2">{t("sowing_date", lang)}</th>
            <th className="px-3 py-2">{t("table_progress_header", lang)}</th>
            <th className="px-3 py-2 text-right">{t("total_expense_col", lang)}</th>
            <th className="px-3 py-2 text-right">{t("per_acre_col", lang)}</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {crops.map((c) => {
            const totalExpense = c.expenses.reduce((sum, e) => sum + e.amount, 0);
            const perAcre = c.areaSownAcres && c.areaSownAcres > 0 ? totalExpense / c.areaSownAcres : null;
            const isExpanded = expandedId === c.id;
            const isReady = c.daysRemaining <= 0;

            return (
              <>
                <tr key={c.id} className="border-b border-surface-100 last:border-0 hover:bg-surface-50">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <Sprout className="h-3.5 w-3.5 text-brand-600" />
                      <span className="font-medium text-surface-900">{c.cropName}</span>
                      <EditCropButton crop={{ id: c.id, crop_name: c.cropName, sowing_date: c.sowingDate }} />
                      <form action={deleteCropAction} onSubmit={(e) => { if (!confirm(t("confirm_delete_crop", lang))) e.preventDefault(); }}>
                        <input type="hidden" name="crop_id" value={c.id} />
                        <button type="submit" className="text-red-400 hover:text-red-600">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </form>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-surface-600">{c.farmName}</td>
                  <td className="px-3 py-2 text-surface-600">{new Date(c.sowingDate).toLocaleDateString()}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-100">
                        <div className="h-full rounded-full bg-brand-500" style={{ width: `${c.percent}%` }} />
                      </div>
                      <span className="text-xs text-surface-500">{isReady ? t("ready_label", lang) : `${c.daysRemaining}d`}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-surface-800">Rs {totalExpense.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right text-surface-500">
                    {perAcre !== null ? `Rs ${perAcre.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "-"}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : c.id)}
                      className="flex items-center gap-1 rounded-lg border border-surface-200 px-2 py-1 text-xs text-surface-600 hover:bg-surface-100"
                    >
                      {t("details_btn", lang)} <ChevronDown className={`h-3 w-3 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                    </button>
                  </td>
                </tr>
                {isExpanded && (
                  <tr key={`${c.id}-expanded`}>
                    <td colSpan={7} className="bg-surface-50 px-3 py-3">
                      <CropExpensePanel
                        cropHistoryId={c.id}
                        expenses={c.expenses}
                        areaSownAcres={c.areaSownAcres}
                        isReadyToHarvest={isReady}
                        isBooked={c.isBooked}
                        expenseOptions={expenseOptions}
                      />
                    </td>
                  </tr>
                )}
              </>
            );
          })}
          {crops.length === 0 && (
            <tr>
              <td colSpan={7} className="px-3 py-8 text-center text-surface-400">
                {t("no_crops_yet", lang)}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}