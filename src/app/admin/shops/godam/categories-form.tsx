"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { saveShopCategoriesForm } from "@/actions/shop-categories";
import { useFormState } from "@/lib/hooks/use-safe-form-state";
import { t, type Lang } from "@/lib/i18n/translations";

export type CatView = { id: string; name: string; count: number; subs: { id: string; name: string; count: number }[] };

function SaveButton({ lang, disabled }: { lang: Lang; disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? "..." : t("dgcat_save", lang)}
    </button>
  );
}

export function ShopCategoriesForm({
  lang,
  shopId,
  shopName,
  businessType,
  linkedHq,
  cats,
  checked,
  canEdit,
}: {
  lang: Lang;
  shopId: string;
  shopName: string;
  businessType: string;
  linkedHq: boolean;
  cats: CatView[];
  checked: string[];
  canEdit: boolean;
}) {
  const [state, action] = useFormState(saveShopCategoriesForm, {});
  const [on, setOn] = useState(() => new Set(checked));
  const [open, setOpen] = useState<string | null>(null);
  const toggleTop = (c: CatView) => {
    const next = new Set(on);
    const v = !next.has(c.id);
    if (v) next.add(c.id);
    else next.delete(c.id);
    // Sub-categories parent ke sath chalti hain.
    for (const s of c.subs) {
      if (v) next.add(s.id);
      else next.delete(s.id);
    }
    setOn(next);
  };
  const toggleSub = (id: string) => {
    const next = new Set(on);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setOn(next);
  };
  const shown = cats.filter((c) => c.count > 0 || on.has(c.id) || c.subs.some((s) => on.has(s.id)));
  const hidden = cats.length - shown.length;
  const [showAll, setShowAll] = useState(false);
  const list = showAll ? cats : shown;

  return (
    <form action={action} data-testid="shop-categories-card" className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-white/10 dark:bg-[#101f42]/80">
      <input type="hidden" name="shop_id" value={shopId} />
      {Array.from(on).map((id) => {
        const top = cats.find((c) => c.id === id);
        return <input key={id} type="hidden" name={top ? "top" : "sub"} value={id} />;
      })}
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">{shopName}</h3>
          {businessType ? <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] text-brand-700 dark:bg-white/10 dark:text-brand-200">{businessType}</span> : null}
        </div>
        <span className={`text-[11px] font-semibold ${linkedHq ? "text-brand-700 dark:text-brand-200" : "text-amber-700"}`}>
          {linkedHq ? t("dgcat_linked", lang) : t("dgcat_not_linked", lang)}
        </span>
      </div>
      <ul className="divide-y divide-surface-100 dark:divide-white/10">
        {list.map((c) => (
          <li key={c.id} className="py-2">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                aria-label={c.name}
                checked={on.has(c.id)}
                disabled={!canEdit}
                onChange={() => toggleTop(c)}
                className="mt-1 h-4 w-4 rounded border-surface-300 text-brand-600"
              />
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium text-surface-900 dark:text-white">{c.name}</span>
                {c.subs.length > 0 && (
                  <button type="button" onClick={() => setOpen(open === c.id ? null : c.id)} className="ml-2 text-[11px] text-brand-700 underline dark:text-brand-200">
                    {c.subs.length} {t("dgcat_subs", lang)}
                  </button>
                )}
              </div>
              <span className="whitespace-nowrap text-xs text-surface-500">{c.count} {t("dgcat_products", lang)}</span>
            </div>
            {open === c.id && (
              <ul className="ml-7 mt-1 space-y-1">
                {c.subs.map((s) => (
                  <li key={s.id} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      aria-label={s.name}
                      checked={on.has(s.id)}
                      disabled={!canEdit}
                      onChange={() => toggleSub(s.id)}
                      className="h-3.5 w-3.5 rounded border-surface-300 text-brand-600"
                    />
                    <span className="flex-1 text-surface-700 dark:text-surface-200">{s.name}</span>
                    <span className="text-surface-500">{s.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <button type="button" onClick={() => setShowAll(!showAll)} className="mt-1 text-xs text-brand-700 underline dark:text-brand-200">
          {showAll ? t("dgcat_fewer", lang) : `${t("dgcat_more", lang)} (${hidden})`}
        </button>
      )}
      {on.size === 0 && <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">{t("dgcat_empty_all", lang)}</p>}
      {state.error && <p className="mt-2 text-sm text-red-600 dark:text-red-300">{state.error}</p>}
      {state.success && <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">{t("dgod_saved", lang)}</p>}
      {canEdit && (
        <div className="mt-3">
          <SaveButton lang={lang} disabled={false} />
        </div>
      )}
    </form>
  );
}
