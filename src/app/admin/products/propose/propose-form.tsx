"use client";
import { useFormState, useFormStatus } from "react-dom";
import { staffProposeProduct, type ActionState } from "@/actions/product-permissions";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

interface Category {
  id: string;
  name: string;
}

export function ProposeForm({ categories }: { categories: Category[] }) {
  const [state, formAction] = useFormState(staffProposeProduct, initialState);
  const lang = useLang();

  return (
    <div className="mx-auto max-w-md rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
      {state.error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state.success && <p className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{t("pd_proposed_ok", lang)}</p>}
      <form action={formAction} className="space-y-3">
        <div>
          <label className="text-sm font-medium text-surface-700 dark:text-surface-300">{t("at_product_name_req", lang)}</label>
          <input name="name" required className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" />
        </div>
        <div>
          <label className="text-sm font-medium text-surface-700 dark:text-surface-300">{t("c_category", lang)}</label>
          <select name="category_id" className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm">
            <option value="">- Select Karein -</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-surface-700 dark:text-surface-300">{t("c_pack_size", lang)}</label>
          <input name="pack_size" placeholder={t("pd_pack_size_eg2", lang)} className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" />
        </div>
        <div>
          <label className="text-sm font-medium text-surface-700 dark:text-surface-300">{t("at_proposed_rate_req", lang)}</label>
          <input type="number" step="0.01" name="proposed_price" required className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" />
        </div>
        <SubmitButton />
      </form>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">{pending ? "..." : "Propose Karein"}</button>;
}