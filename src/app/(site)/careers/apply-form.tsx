"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { applyToVacancy, type ActionState } from "@/actions/jobs";
import { CheckCircle2 } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

export function ApplyForm({ vacancyId, onClose }: { vacancyId: string; onClose: () => void }) {
  const lang = useLang();
  const [state, formAction] = useFormState(applyToVacancy, initialState);

  if (state.success) {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-lg bg-green-50 px-3 py-3 text-sm text-green-700">
        <CheckCircle2 className="h-5 w-5 shrink-0" />{t("sp_application_received", lang)}</div>
    );
  }

  return (
    <form action={formAction} encType="multipart/form-data" className="mt-3 space-y-2 rounded-lg bg-surface-50 p-3">
      <input type="hidden" name="vacancy_id" value={vacancyId} />
      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}

      <p className="pt-1 text-xs font-semibold uppercase tracking-wide text-surface-400">{t("sp_basic_info", lang)}</p>
      <input name="full_name" required placeholder={t("sp_full_name", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
      <input type="email" name="email" required placeholder={t("sp_email", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
      <input name="phone" placeholder={t("sp_phone", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
      <input name="cnic" placeholder={t("sp_cnic_number", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
      <input name="address" placeholder={t("sp_address", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
      <input type="number" name="expected_salary" placeholder={t("sp_expected_salary", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />

      <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-surface-400">{t("sp_exp_qual", lang)}</p>
      <textarea name="qualification" rows={2} placeholder={t("sp_qualification", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
      <textarea name="experience" rows={2} placeholder={t("sp_past_work", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
      <textarea name="message" rows={2} placeholder={t("sp_about_you", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />

      <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-surface-400">{t("sp_documents", lang)}</p>
      <div>
        <label className="text-xs text-surface-500">{t("sp_cnic_front", lang)}</label>
        <input type="file" name="cnic_front_image" accept="image/*" className="mt-1 w-full text-xs" />
      </div>
      <div>
        <label className="text-xs text-surface-500">{t("sp_cnic_back", lang)}</label>
        <input type="file" name="cnic_back_image" accept="image/*" className="mt-1 w-full text-xs" />
      </div>
      <div>
        <label className="text-xs text-surface-500">{t("sp_qual_cert", lang)}</label>
        <input type="file" name="certificate" accept="image/*,.pdf" className="mt-1 w-full text-xs" />
      </div>
      <div>
        <label className="text-xs text-surface-500">{t("sp_exp_cert", lang)}</label>
        <input type="file" name="experience_certificate" accept="image/*,.pdf" className="mt-1 w-full text-xs" />
      </div>
      <div>
        <label className="text-xs text-surface-500">{t("sp_cv", lang)}</label>
        <input type="file" name="cv" accept="image/*,.pdf,.doc,.docx" className="mt-1 w-full text-xs" />
      </div>

      <div className="flex gap-2 pt-2">
        <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-surface-200 px-3 py-2 text-sm">{t("sp_cancel", lang)}</button>
        <SubmitButton />
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="flex-1 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
      {pending ? "Submitting..." : "Apply"}
    </button>
  );
}