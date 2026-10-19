import { t, type Lang, type TranslationKey } from "@/lib/i18n/translations";
import { Tri } from "./dairy-parts";

export const inputCls = "w-full rounded-xl border border-surface-200 bg-surface-50 px-3 py-2.5 text-sm text-surface-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 dark:border-surface-700 dark:bg-surface-800 dark:text-white";
export function Field({ k, lang, children }: { k: TranslationKey; lang: Lang; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-[13px] font-semibold text-surface-800 dark:text-slate-100">
      <Tri k={k} lang={lang} />
      {children}
    </label>
  );
}
/** Segmented radio (mockup ka "Gaye / Bhains / Bakri"). */
export function Seg({ name, options, value, lang }: { name: string; options: { v: string; k: TranslationKey; icon?: string }[]; value: string; lang: Lang }) {
  return (
    <div className="flex gap-1.5">
      {options.map((o) => (
        <label key={o.v} className="flex-1 cursor-pointer">
          <input type="radio" name={name} value={o.v} defaultChecked={o.v === value} className="peer sr-only" />
          <span className="block rounded-xl border border-surface-200 bg-surface-50 px-2 py-2.5 text-center text-[13px] font-medium text-surface-800 peer-checked:border-green-600 peer-checked:bg-green-600 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-green-500/40 dark:border-surface-700 dark:bg-surface-800 dark:text-slate-100 dark:peer-checked:border-green-600 dark:peer-checked:bg-green-600">
            {o.icon ? `${o.icon} ` : ""}{t(o.k, lang)}
          </span>
        </label>
      ))}
    </div>
  );
}
