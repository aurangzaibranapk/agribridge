import Link from "next/link";
import { AlertTriangle, ChevronRight, CheckCircle2, ShieldAlert, ClipboardCheck, PackageSearch, CircleDot } from "lucide-react";
import { loadNeedsAttention, filterAttention, type AttentionItem } from "@/lib/access/needs-attention";
import { t, type Lang } from "@/lib/i18n/translations";

const TONE: Record<AttentionItem["tone"], string> = {
  red: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  gray: "bg-surface-100 text-surface-700 dark:bg-surface-800 dark:text-surface-300",
};

/**
 * Patti wali shakl (malik ka reference, 4 September): har cheez ek card
 * -- nishan, asal adad, insani naam, chhota jumla aur teer. Wohi ginti,
 * wohi qatarein, sirf shakl alag: ye safhe ka sab se ahem hissa hai aur
 * ek nazar mein paRhna chahiye.
 */
const STRIP_TONE: Record<AttentionItem["tone"], { box: string; icon: string; num: string }> = {
  red: { box: "border-red-200 bg-red-50/70 dark:border-red-900/40 dark:bg-red-950/20", icon: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300", num: "text-red-700 dark:text-red-300" },
  amber: { box: "border-amber-200 bg-amber-50/70 dark:border-amber-900/40 dark:bg-amber-950/20", icon: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300", num: "text-amber-800 dark:text-amber-300" },
  blue: { box: "border-blue-200 bg-blue-50/70 dark:border-blue-900/40 dark:bg-blue-950/20", icon: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", num: "text-blue-800 dark:text-blue-300" },
  gray: { box: "border-surface-200 bg-surface-50 dark:border-surface-800 dark:bg-surface-900", icon: "bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-300", num: "text-surface-800 dark:text-surface-200" },
};

const STRIP_ICON: Record<AttentionItem["tone"], typeof AlertTriangle> = {
  red: ShieldAlert,
  amber: ClipboardCheck,
  blue: PackageSearch,
  gray: CircleDot,
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
  variant = "list",
  showAll = false,
  allHref,
}: {
  lang: Lang;
  allowedRoutes: string[] | null;
  areas?: AttentionItem["area"][];
  compact?: boolean;
  /** "strip" = Mera Kaam wali chauRi patti; "list" = purani do-satar fehrist. */
  variant?: "list" | "strip";
  /** Patti mein chaar ke bajaye saari qatarein. */
  showAll?: boolean;
  /** "Sab dekhein" ka raasta -- na ho to link nahi banta. */
  allHref?: string;
}) {
  const all = await loadNeedsAttention();
  let items = filterAttention(all, allowedRoutes);
  if (areas && areas.length) items = items.filter((i) => areas.includes(i.area));
  const order: AttentionItem["tone"][] = ["red", "amber", "blue", "gray"];
  items.sort((a, b) => order.indexOf(a.tone) - order.indexOf(b.tone));

  if (variant === "strip") {
    // Chaar se ziyada hon to baqi neeche apne department mein waise hi
    // nazar aa jate hain -- yahan sirf sab se ahem chaar. "Aur N" ka
    // koi link nahi banaya: aisa safha hai hi nahi, aur na-maujood
    // darwaza dikhana bande ka waqt zaya karta hai.
    const top = showAll ? items : items.slice(0, 4);
    return (
      <section className="rounded-card border border-surface-200 bg-white p-4 dark:border-surface-800 dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-[15px] font-semibold text-surface-900 dark:text-white">
            <AlertTriangle className="h-4 w-4 text-amber-600" /> {t("na_title", lang)}
          </h3>
          {items.length > top.length && allHref ? (
            <Link href={allHref} className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-700 hover:underline dark:text-brand-300">
              {t("na_see_all", lang)} <ChevronRight className="h-3 w-3" />
            </Link>
          ) : (
            <span className="text-[11px] text-surface-400">{t("na_today", lang)}</span>
          )}
        </div>
        {items.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" /> {t("na_clear", lang)}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {top.map((it) => {
              const tone = STRIP_TONE[it.tone];
              const Icon = STRIP_ICON[it.tone];
              return (
                <Link
                  key={it.key}
                  href={it.href}
                  className={`group flex items-center gap-3 rounded-xl border px-3.5 py-3.5 transition hover:shadow-sm ${tone.box}`}
                >
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone.icon}`}>
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-xl font-bold leading-none tabular-nums ${tone.num}`}>
                      {it.count == null ? "—" : it.count}
                    </span>
                    <span className="mt-1.5 block truncate text-[13.5px] font-medium text-surface-800 dark:text-surface-200">
                      {t(it.label, lang)}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-surface-400 transition group-hover:translate-x-0.5" />
                </Link>
              );
            })}
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="rounded-card border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
      <div className="flex items-center justify-between border-b border-surface-200 px-4 py-2.5 dark:border-surface-800">
        <h3 className="flex items-center gap-2 text-[15px] font-semibold text-surface-900 dark:text-white">
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
