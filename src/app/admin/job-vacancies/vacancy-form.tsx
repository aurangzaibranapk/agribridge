"use client";
import { useFormState, useFormStatus } from "react-dom";
import { createVacancy, type ActionState } from "@/actions/jobs";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

interface Branch {
  id: string;
  name: string;
}

export function VacancyForm({ branches }: { branches: Branch[] }) {
  const [state, formAction] = useFormState(createVacancy, initialState);
  const lang = useLang();
  return (
    <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <h3 className="mb-3 text-sm font-semibold text-surface-900 dark:text-white">{t("jv_post", lang)}</h3>
      {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
      {state.success && <p className="mb-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">{t("jv_posted", lang)}</p>}
      <form action={formAction} className="space-y-2">
        <input name="title" required placeholder={t("jv_title_eg", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
        <input name="designation" placeholder={t("c_designation", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
        <select name="branch_id" className="w-full rounded-lg border border-surface-200 p-2 text-sm">
          <option value="">- Koi Shop Select Karein (optional) -</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <div>
          <label className="text-xs text-surface-500">{t("jv_seats", lang)}</label>
          <input type="number" name="seats_total" min="1" defaultValue="1" className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" />
        </div>
        <textarea name="description" rows={2} placeholder={t("jv_description", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
        <textarea name="requirements" rows={2} placeholder={t("jv_requirements", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
        <SubmitButton />
      </form>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
      {pending ? "Posting..." : "Post Vacancy"}
    </button>
  );
}