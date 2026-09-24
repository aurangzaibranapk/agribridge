"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createFarmerLoan, type ActionState } from "@/actions/farmer-loans";
import { Button, Input, Label, Select, Textarea, Badge } from "@/components/ui/form";
import { Plus, X } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

interface Farmer { id: string; full_name: string; farmer_code: string; }
interface Loan {
  id: string;
  farmer_id: string;
  farmer_name: string;
  farmer_code: string;
  principal_amount: number;
  weekly_installment: number;
  outstanding_balance: number;
  status: string;
  notes: string | null;
  created_at: string;
}

export function FarmerLoansClient({ farmers, loans }: { farmers: Farmer[]; loans: Loan[] }) {
  const [showNewLoan, setShowNewLoan] = useState(false);
  const lang = useLang();

  return (
    <div>
      <button onClick={() => setShowNewLoan(true)} className="mb-4 flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
        <Plus className="h-4 w-4" />{t("fl_new_loan", lang)}</button>

      <div className="overflow-x-auto rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
              <th className="px-3 py-2 font-medium text-surface-500">{t("c_farmer", lang)}</th>
              <th className="px-3 py-2 text-right font-medium text-surface-500">{t("fl_loan_amount", lang)}</th>
              <th className="px-3 py-2 text-right font-medium text-surface-500">{t("fl_weekly", lang)}</th>
              <th className="px-3 py-2 text-right font-medium text-surface-500">{t("c_baqi", lang)}</th>
              <th className="px-3 py-2 font-medium text-surface-500">{t("c_status", lang)}</th>
              <th className="px-3 py-2 font-medium text-surface-500">{t("c_date", lang)}</th>
            </tr>
          </thead>
          <tbody>
            {loans.map((l) => (
              <tr key={l.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                <td className="px-3 py-2 font-medium text-surface-800 dark:text-surface-200">{l.farmer_name} <span className="block text-xs text-surface-400">{l.farmer_code}</span></td>
                <td className="px-3 py-2 text-right text-surface-900 dark:text-white">Rs {l.principal_amount.toLocaleString()}</td>
                <td className="px-3 py-2 text-right text-surface-600 dark:text-surface-400">Rs {l.weekly_installment.toLocaleString()}</td>
                <td className="px-3 py-2 text-right font-semibold text-amber-600">Rs {l.outstanding_balance.toLocaleString()}</td>
                <td className="px-3 py-2">
                  <Badge tone={l.status === "paid_off" ? "green" : l.status === "cancelled" ? "gray" : "amber"}>
                    {l.status === "paid_off" ? "Poora Ho Gaya" : l.status === "cancelled" ? "Cancelled" : "Active"}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-xs text-surface-400">{new Date(l.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {loans.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-surface-400">{t("fl_none", lang)}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showNewLoan && <NewLoanModal farmers={farmers} onClose={() => setShowNewLoan(false)} />}
    </div>
  );
}

function NewLoanModal({ farmers, onClose }: { farmers: Farmer[]; onClose: () => void }) {
  const [state, formAction] = useFormState(createFarmerLoan, initialState);
  const lang = useLang();
  if (state.success) setTimeout(() => window.location.reload(), 900);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">{t("fl_new_loan", lang)}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        <form action={formAction} className="space-y-3">
          <div>
            <Label>{t("fl_farmer_req", lang)}</Label>
            <Select name="farmer_id" required>
              <option value="">- select -</option>
              {farmers.map((f) => (
                <option key={f.id} value={f.id}>{f.full_name} ({f.farmer_code})</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>{t("fl_loan_amount_req", lang)}</Label>
            <Input type="number" step="0.01" name="principal_amount" required placeholder={t("fl_eg_10000", lang)} />
          </div>
          <div>
            <Label>{t("fl_weekly_req", lang)}</Label>
            <Input type="number" step="0.01" name="weekly_installment" required placeholder={t("fl_eg_500", lang)} />
          </div>
          <p className="text-[11px] text-surface-400">{t("fl_how_it_works", lang)}</p>
          <div>
            <Label>{t("c_notes_optional", lang)}</Label>
            <Textarea name="notes" rows={2} />
          </div>
          <SubmitButton />
        </form>
      </div>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} className="w-full">{pending ? "Saving..." : "Loan Dein"}</Button>;
}