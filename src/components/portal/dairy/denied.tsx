import { t, type Lang } from "@/lib/i18n/translations";
export function Denied({ lang }: { lang: Lang }) {
  return <div className="mx-auto max-w-xl px-4 py-16 text-center"><div className="text-5xl">🔒</div><p className="mt-3 font-semibold text-surface-800 dark:text-slate-100">{t("ad_denied", lang)}</p></div>;
}
