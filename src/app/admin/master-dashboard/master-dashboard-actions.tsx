"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { recordCapitalInjection, type ActionState } from "@/actions/capital-injections";
import { Plus, X } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

export function MasterDashboardActions() {
  const [showAdd, setShowAdd] = useState(false);
  const lang = useLang();

  return (
    <div className="mb-4 flex justify-end print:hidden">
      <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
        <Plus className="h-4 w-4" />{t("md_add_capital", lang)}</button>
      {showAdd && <AddCapitalModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function AddCapitalModal({ onClose }: { onClose: () => void }) {
  const [state, formAction] = useFormState(recordCapitalInjection, initialState);
  const lang = useLang();
  const [sourceType, setSourceType] = useState("owner_capital");
  if (state.success) setTimeout(onClose, 800);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900">{t("md_add_capital", lang)}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        <form action={formAction} encType="multipart/form-data" className="space-y-2">
          <select name="source_type" value={sourceType} onChange={(e) => setSourceType(e.target.value)} className="w-full rounded-lg border border-surface-200 p-2 text-sm">
            <option value="owner_capital">{t("md_owner_capital", lang)}</option>
            <option value="bank_loan">{t("md_bank_loan", lang)}</option>
            <option value="borrowed">{t("md_borrowed", lang)}</option>
            <option value="reinvested_profit">{t("md_reinvested", lang)}</option>
          </select>
          {(sourceType === "bank_loan" || sourceType === "borrowed") && (
            <input name="source_name" placeholder={sourceType === "bank_loan" ? "Bank Naam" : "Kis Se Liya (naam)"} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          )}
          <input type="date" name="injection_date" defaultValue={new Date().toISOString().slice(0, 10)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <input type="number" step="0.01" name="amount" required placeholder={t("c_amount_rs", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <div>
            <label className="text-xs text-surface-500">{t("md_document_optional", lang)}</label>
            <input type="file" name="document" accept="image/*,application/pdf" className="mt-1 w-full text-xs" />
          </div>
          <textarea name="notes" rows={2} placeholder={t("c_notes", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <SubmitButton />
        </form>
      </div>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">{pending ? "..." : "Save Karein"}</button>;
}