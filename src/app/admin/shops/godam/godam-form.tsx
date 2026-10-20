"use client";

import { useFormStatus } from "react-dom";
import { saveShopGodamForm } from "@/actions/shop-godams";
import { useFormState } from "@/lib/hooks/use-safe-form-state";
import { t, type Lang } from "@/lib/i18n/translations";

function SaveButton({ lang }: { lang: Lang }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? "..." : t("dgod_save", lang)}
    </button>
  );
}

export function ShopGodamForm({
  lang,
  shopId,
  linkedIds,
  warehouses,
}: {
  lang: Lang;
  shopId: string;
  linkedIds: string[];
  warehouses: { id: string; name: string; detail: string }[];
}) {
  const [state, action] = useFormState(saveShopGodamForm, {});
  const linked = new Set(linkedIds);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="shop_id" value={shopId} />
      {warehouses.length === 0 ? (
        <p className="text-sm text-surface-600 dark:text-surface-300">{t("dgod_empty_list", lang)}</p>
      ) : (
        <ul className="divide-y divide-surface-200 rounded-xl border border-surface-200 dark:divide-white/10 dark:border-white/10">
          {warehouses.map((w) => (
            <li key={w.id} className="flex items-start gap-3 px-3 py-2.5">
              <input
                id={`godam-${w.id}`}
                type="checkbox"
                name="warehouse_id"
                value={w.id}
                defaultChecked={linked.has(w.id)}
                className="mt-1 h-4 w-4 rounded border-surface-300 text-brand-600"
              />
              <label htmlFor={`godam-${w.id}`} className="min-w-0 cursor-pointer">
                <span className="block text-sm font-medium text-surface-900 dark:text-white">{w.name}</span>
                {w.detail ? <span className="block text-xs text-surface-500 dark:text-surface-400">{w.detail}</span> : null}
              </label>
            </li>
          ))}
        </ul>
      )}
      {linkedIds.length === 0 && (
        <p className="rounded-lg border border-amber-200 bg-[#fff7e6] px-3 py-2 text-sm text-amber-950 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100">
          {t("dgod_none", lang)}
        </p>
      )}
      {state.error && <p className="text-sm text-red-600 dark:text-red-300">{state.error}</p>}
      {state.success && <p className="text-sm text-emerald-700 dark:text-emerald-300">{t("dgod_saved", lang)}</p>}
      <SaveButton lang={lang} />
    </form>
  );
}
