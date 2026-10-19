import { t, type Lang } from "@/lib/i18n/translations";
import { rs } from "@/lib/portal/dairy-pl";
import { shortDate } from "@/components/portal/khata/khata-parts";
import type { Suggestion } from "@/lib/portal/dairy-pl-load";

/** Kharcha dobara na gine: dukaan ki vets cheez / pehle se darj vets kharcha jorein -- warna naya khana bharein. */
export function LinkCost({ shop, existing, lang }: { shop: Suggestion[]; existing: { id: string; date: string; amount: number; note: string }[]; lang: Lang }) {
  const vets = shop.filter((s) => s.category === "vets" && !s.added);
  return (
    <div className="rounded-2xl border border-surface-200 p-4 dark:border-surface-700">
      <b className="text-[13px] text-surface-900 dark:text-white">🔗 {t("bh_link_title", lang)}</b>
      <p className="mb-2 mt-0.5 text-xs text-surface-500 dark:text-slate-400">{t("bh_link_sub", lang)}</p>
      <div className="grid gap-1.5 text-[12.5px]">
        <label className="flex items-center gap-2 rounded-xl border border-surface-200 px-3 py-2 dark:border-surface-700"><input type="radio" name="link" value="" defaultChecked /> {t("bh_link_none", lang)}</label>
        {vets.map((s) => (
          <label key={s.item_id} className="flex items-center gap-2 rounded-xl border border-surface-200 px-3 py-2 dark:border-surface-700">
            <input type="radio" name="link" value={`pos:${s.item_id}`} />
            <span className="flex-1 text-surface-800 dark:text-slate-200">🏪 {s.product} · {s.ref} · {shortDate(s.sale_date, lang)}</span><b className="text-surface-900 dark:text-white">{rs(s.amount)}</b>
          </label>
        ))}
        {existing.map((x) => (
          <label key={x.id} className="flex items-center gap-2 rounded-xl border border-surface-200 px-3 py-2 dark:border-surface-700">
            <input type="radio" name="link" value={`exp:${x.id}`} />
            <span className="flex-1 text-surface-800 dark:text-slate-200">💉 {x.note || t("bh_link_vets", lang)} · {shortDate(x.date, lang)}</span><b className="text-surface-900 dark:text-white">{rs(x.amount)}</b>
          </label>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-surface-500">{t("bh_link_note", lang)}</p>
    </div>
  );
}
