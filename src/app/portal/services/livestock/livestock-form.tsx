"use client";
import { useRef, useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { submitLivestockLoan, type ServiceRequestState } from "@/actions/service-requests";
import { useLanguage } from "@/hooks/useLanguage";
import { t } from "@/lib/i18n/translations";

const initialState: ServiceRequestState = {};

export function LivestockForm() {
  const { language: lang } = useLanguage();
  const [state, formAction] = useFormState(submitLivestockLoan, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  if (state.success) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {t("loan_request_submitted_msg", lang)}
        </div>
        <Link href="/portal/dashboard" className="block text-center text-sm text-surface-500 hover:text-brand-700">
          {t("back_to_dashboard", lang)}
        </Link>
      </div>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {state.error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {state.error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium text-surface-700">{t("cows_label", lang)}</label>
          <input type="number" name="cow_count" min="0" defaultValue="0" className="mt-1 w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-surface-700">{t("buffaloes_label", lang)}</label>
          <input type="number" name="buffalo_count" min="0" defaultValue="0" className="mt-1 w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-surface-700">{t("goats_label", lang)}</label>
          <input type="number" name="goat_count" min="0" defaultValue="0" className="mt-1 w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-surface-700">{t("loan_amount_pkr_label", lang)}</label>
        <input type="number" name="loan_amount" min="0" step="1000" className="mt-1 w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" placeholder={t("eg_50000", lang)} required />
      </div>

      <div>
        <label className="block text-sm font-medium text-surface-700">{t("repayment_type_label", lang)}</label>
        <select name="repayment_type" className="mt-1 w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" required defaultValue="">
          <option value="" disabled>{t("select_repayment_placeholder", lang)}</option>
          <option value="milk_installments">{t("repayment_milk_installments", lang)}</option>
          <option value="lump_sum_3_months">{t("repayment_lump_sum_3months", lang)}</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-surface-700">{t("additional_notes_optional", lang)}</label>
        <textarea name="notes" rows={3} className="mt-1 w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" placeholder={t("anything_else_placeholder", lang)} />
      </div>

      <SubmitButton lang={lang} />
    </form>
  );
}

function SubmitButton({ lang }: { lang: "en" | "ur" }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {pending ? t("submitting_label", lang) : t("submit_request_btn", lang)}
    </button>
  );
}