import Link from "next/link";
import { AlertTriangle, ChevronRight, CheckCircle2 } from "lucide-react";
import { loadNeedsAttention, filterAttention, type AttentionItem } from "@/lib/access/needs-attention";
import { t, type Lang } from "@/lib/i18n/translations";

const TONE: Record<AttentionItem["tone"], string> = {
  red: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  gray: "bg-surface-100 text-surface-700 dark:bg-surface-800 dark:text-surface-300",
};

/**
 * "Aaj kya baqi hai" -- role ke hisaab se, click par kaam ke safhe par
 * (Guided ERP, B). allowedRoutes null = sab dikhao (owner/admin).
 * Jo ginti na mil sake wahan "—", sifar nahi.
 */
export async function NeedsAttention({
  lang,
  allowedRoutes,
  areas,
  compact = false,
}: {
  lang: Lang;
  allowedRoutes: string[] | null;
  areas?: AttentionItem["area"][];
  compact?: boolean;
}) {
  const all = await loadNeedsAttention();
  let items = filterAttention(all, allowedRoutes);
  if (areas && areas.length) items = items.filter((i) => areas.includes(i.area));
  const order: AttentionItem["tone"][] = ["red", "amber", "blue", "gray"];
  items.sort((a, b) => order.indexOf(a.tone) - order.indexOf(b.tone));

  return (
    <section className="rounded-card border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
      <div className="flex items-center justify-between border-b border-surface-200 px-4 py-2.5 dark:border-surface-800">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-surface-900 dark:text-white">
          <AlertTriangle className="h-4 w-4 text-amber-600" /> {t("na_title", lang)}
        </h3>
        <span className="text-[11px] text-surface-400">{t("na_today", lang)}</span>
      </div>
      {items.length === 0 ? (
        <p className="flex items-center gap-2 px-4 py-4 text-sm text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4" /> {t("na_clear", lang)}
        </p>
      ) : (
        <ul className={`divide-y divide-surface-100 dark:divide-surface-800 ${compact ? "" : "sm:grid sm:grid-cols-2 sm:divide-y-0 sm:gap-px sm:bg-surface-100 dark:sm:bg-surface-800"}`}>
          {items.map((it) => (
            <li key={it.key} className="bg-white dark:bg-surface-900">
              <Link href={it.href} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-50 dark:hover:bg-surface-800">
                <span className={`inline-flex min-w-[2.25rem] justify-center rounded-full px-2 py-0.5 text-sm font-semibold tabular-nums ${TONE[it.tone]}`}>
                  {it.count == null ? "—" : it.count}
                </span>
                <span className="flex-1 text-sm text-surface-800 dark:text-surface-200">{t(it.label, lang)}</span>
                <ChevronRight className="h-4 w-4 text-surface-400" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
