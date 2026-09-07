"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import * as Icons from "lucide-react";
import { ChevronDown, ChevronRight, CheckCircle2, ArrowRight } from "lucide-react";
import { t, type Lang } from "@/lib/i18n/translations";

/**
 * "Mera Kaam" ke cards -- department kholne/band karne wala hissa.
 *
 * Poora safha ek sath khol dena hi asal shikayat thi: 50 dabbe, sab ek
 * jaise. Ab department ka card upar hai (kitne auzaar, kitne par kaam
 * baqi), aur us par click karne se usi ke auzaar khulte hain.
 *
 * Pehla department khud khula rehta hai -- warna login ke baad safha
 * khali lagta hai aur banda samajhta hai ke usay kuch mila hi nahi.
 */

export interface CardData {
  href: string;
  label: string;
  description?: string | null;
  icon: string | null;
  section?: string | null;
  badge: { count: number | null; tone: "red" | "amber" | "blue" | "gray"; label: string | null } | null;
}

export interface DeptData {
  key: string;
  label: string;
  icon: string | null;
  tools: CardData[];
  toolCount: number;
  attention: number | null;
  preview: string[];
}

const TONE: Record<string, string> = {
  red: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  gray: "bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-300",
};

function Icon({ name, className }: { name: string | null; className?: string }) {
  const C =
    (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[name ?? ""] ??
    Icons.LayoutGrid;
  return <C className={className} />;
}

/** Card par adad. Ginti na mile to "—" -- sifar likhna jhoot hota. */
function Badge({ badge }: { badge: CardData["badge"] }) {
  if (!badge) return null;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${TONE[badge.tone]}`}>
      {badge.count === null ? "—" : badge.count}
      {badge.label && <span className="font-medium opacity-80">{badge.label}</span>}
    </span>
  );
}

export function WorkCard({
  card, big = false, onOpen, openLabel = "",
}: {
  card: CardData;
  big?: boolean;
  onOpen?: (href: string) => void;
  openLabel?: string;
}) {
  return (
    <Link
      href={card.href}
      onClick={() => onOpen?.(card.href)}
      className={`group flex items-start gap-3 rounded-xl border border-surface-200 bg-white transition hover:border-brand-300 hover:bg-brand-50/40 hover:shadow-md dark:border-surface-800 dark:bg-surface-900 dark:hover:border-brand-700 dark:hover:bg-brand-950/20 ${
        big ? "p-4" : "p-3.5"
      }`}
    >
      <span className={`flex shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300 ${big ? "h-11 w-11" : "h-10 w-10"}`}>
        <Icon name={card.icon} className={big ? "h-5 w-5" : "h-[18px] w-[18px]"} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className={`font-display font-semibold text-surface-900 dark:text-surface-100 ${big ? "text-base" : "text-[15px]"}`}>
            {card.label}
          </span>
          <Badge badge={card.badge} />
        </span>
        {card.description && (
          <span className="mt-1 block text-[13px] leading-relaxed text-surface-500">{card.description}</span>
        )}
        {big && (
          // Bare card par teer kaafi nahi -- saaf likha hua qadam chahiye,
          // taake nazar wahin jaye jahan click karna hai.
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 dark:bg-brand-600 ">
            {openLabel} <ArrowRight className="h-3 w-3" />
          </span>
        )}
      </span>
      {!big && (
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-surface-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
      )}
    </Link>
  );
}

/** Haal hi mein khole gaye safhe -- isi browser mein, kisi server par nahi. */
const RECENT_KEY = "agribridge:recent-work";

export function useRecent(): [string[], (href: string) => void, () => void] {
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      if (raw) setRecent(JSON.parse(raw));
    } catch {
      // Private window ya band ki hui storage -- yahan kuch na dikhana
      // kaafi hai, safha waise hi chalta rahe.
    }
  }, []);

  function remember(href: string) {
    setRecent((prev) => {
      const next = [href, ...prev.filter((h) => h !== href)].slice(0, 4);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        /* storage band ho to bhi safha chalta rahe */
      }
      return next;
    });
  }

  function clear() {
    setRecent([]);
    try {
      localStorage.removeItem(RECENT_KEY);
    } catch {
      /* storage band ho to bhi safha chalta rahe */
    }
  }

  return [recent, remember, clear];
}

/** Aakhri khola gaya department -- isi browser mein. */
const LAST_DEPT_KEY = "agribridge:last-dept";

export function MyWorkBody({
  lang, quick, departments, defaultDept,
}: {
  lang: Lang;
  quick: CardData[];
  departments: DeptData[];
  /**
   * Role ka apna department -- login ke foran baad wohi khula milta hai.
   * null (manager/owner) = sab band, taake "Aaj ka kaam" par nazar rahe.
   */
  defaultDept: string | null;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [recent, remember, clearRecent] = useRecent();

  // Pehla faisla client par hota hai, server par nahi: aakhri khola gaya
  // department sirf isi browser ko maloom hai. Us ke baghair role ka
  // apna department, aur wo bhi na ho to sab band.
  useEffect(() => {
    let key: string | null = null;
    try {
      const saved = localStorage.getItem(LAST_DEPT_KEY);
      if (saved && departments.some((d) => d.key === saved)) key = saved;
    } catch {
      /* private window -- role wala default chal jayega */
    }
    if (!key && defaultDept && departments.some((d) => d.key === defaultDept)) key = defaultDept;
    if (key) setOpen({ [key]: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultDept, departments.length]);

  // Malik (7 September): "page ko scroll na karna paray... phir next
  // kisi aur product par click kare to wo bhi usi page par scroll na
  // karna paray... page apni jagah se na hile." Ek waqt mein ek hi
  // department khula rehta hai -- doosra kholte hi pehla khud band ho
  // jata hai. Warna teen-chaar department khulte khulte safha lamba
  // hota jata aur banda apna khola hua panel dhoondne ke liye scroll
  // karta rehta.
  function toggle(key: string) {
    setOpen((o) => {
      const abhiKhula = !!o[key];
      const next = abhiKhula ? {} : { [key]: true };
      try {
        if (!abhiKhula) localStorage.setItem(LAST_DEPT_KEY, key);
      } catch {
        /* yaad na rahe to bhi safha chalta rahe */
      }
      return next;
    });
  }

  const byHref = new Map<string, CardData>();
  for (const d of departments) for (const c of d.tools) byHref.set(c.href, c);
  const recentCards = recent.map((h) => byHref.get(h)).filter((c): c is CardData => !!c);

  return (
    <div className="space-y-4">
      {/* Ye hissa khali bhi rehta hai to nazar aata hai -- warna safha har
          naye bande ke liye alag shakl ka lagta hai, aur wo samajh nahi
          pata ke yahan aata kya hai. */}
      <section className="rounded-card border border-surface-200 bg-white p-5 dark:border-surface-800 dark:bg-surface-900">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-[13px] font-semibold uppercase tracking-wide text-surface-500">
              {t("mw_recent", lang)}
            </h2>
            {/* Ye fehrist khud banti hai; bande ke paas usay mitane ka
                raasta hona chahiye -- warna ek dafa khola hua safha
                hamesha uske saamne rehta hai. */}
            {recentCards.length > 0 && (
              <button
                type="button"
                onClick={clearRecent}
                className="text-[11px] font-medium text-surface-400 hover:text-surface-600 dark:hover:text-surface-300"
              >
                {t("mw_recent_clear", lang)}
              </button>
            )}
          </div>
          {recentCards.length === 0 ? (
            <p className="rounded-xl border border-dashed border-surface-200 px-4 py-3 text-xs text-surface-400 dark:border-surface-800">
              {t("mw_recent_empty", lang)}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {recentCards.map((c) => (
                <Link
                  key={c.href}
                  href={c.href}
                  onClick={() => remember(c.href)}
                  className="inline-flex items-center gap-2 rounded-xl border border-surface-200 bg-white px-3.5 py-2.5 text-[13px] font-medium text-surface-700 hover:border-brand-300 hover:text-brand-700 dark:border-surface-800 dark:bg-surface-900 dark:text-surface-300"
                >
                  <Icon name={c.icon} className="h-4 w-4 text-brand-600" />
                  {c.label}
                </Link>
              ))}
            </div>
          )}
        </section>

      <section className="rounded-card border border-surface-200 bg-white p-5 dark:border-surface-800 dark:bg-surface-900">
        <h2 className="mb-3 font-display text-[13px] font-semibold uppercase tracking-wide text-surface-500">
          {t("mw_quick", lang)}
        </h2>
        {quick.length === 0 ? (
          // Khali qatar dikhane se behtar hai ke banda ek jumle mein dekh
          // le ke aaj is ke zimme kuch nahi.
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {t("mw_quick_clear", lang)}
          </div>
        ) : (
          // Ek ya do hi kaam hon to unhen teen ke khaane mein daal kar
          // baayen kone mein chhota na chhoRein -- card poori chauRai
          // mein zyada saaf nazar aata hai.
          <div
            // Khaane hamesha teen. Ek hi kaam ho to wo darmiyane naap ka
            // card rehta hai -- poori chauRai ki qatar "kaam ka card"
            // nahi, "ittila ki patti" lagti hai.
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {quick.map((c) => (
              <WorkCard key={`q-${c.href}`} card={c} big onOpen={remember} openLabel={t("mw_open_now", lang)} />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-card border border-surface-200 bg-white p-5 dark:border-surface-800 dark:bg-surface-900">
        <h2 className="mb-3 font-display text-[13px] font-semibold uppercase tracking-wide text-surface-500">
          {t("mw_depts", lang)}
        </h2>

        {/* Chhote, barabar naap ke cards -- teen khaanay, chhoti screen par
            do, mobile par ek. Card khud kaam nahi kholta, sirf batata hai
            andar kya hai; kholne ka faisla neeche alag panel karta hai
            (grid ke andar ek card ka khulna baaki cards ko terha kar deta
            tha). */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {departments.map((d) => {
            const isOpen = !!open[d.key];
            return (
              <button
                key={d.key}
                type="button"
                onClick={() => toggle(d.key)}
                aria-expanded={isOpen}
                className={`flex flex-col items-start rounded-xl border p-4 text-left transition ${
                  isOpen
                    ? "border-brand-300 bg-brand-50/50 dark:border-brand-700 dark:bg-brand-950/20"
                    : "border-surface-200/80 hover:border-brand-300 hover:bg-brand-50/30 dark:border-surface-800 dark:hover:bg-brand-950/20"
                }`}
              >
                <div className="flex w-full items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300">
                    <Icon name={d.icon} className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-[13px] font-semibold uppercase tracking-wide text-surface-900 dark:text-surface-100">
                      {d.label}
                    </span>
                    {/* Jhalak: andar kya hai -- warna banda har department
                        khol kar dekhta hai. */}
                    {d.preview.length > 0 && (
                      <span className="block truncate text-[12px] text-surface-500">
                        {d.preview.join(", ")}
                        {d.toolCount > d.preview.length ? "…" : ""}
                      </span>
                    )}
                  </span>
                </div>

                <div className="mt-3 flex w-full items-center justify-between">
                  <span className="text-xs font-medium tabular-nums text-surface-500">
                    {t("mw_tools_n", lang).replace("{n}", String(d.toolCount))}
                  </span>
                  <span className="flex items-center gap-1.5">
                    {/* "Sab Theek" ab lafzon mein nahi -- sirf ek chhota
                        hara nishan. Sifar hone ka matlab yahan waqai
                        "kuch baqi nahi" hai, is liye ye jhoot nahi. */}
                    {d.attention === null ? (
                      <span className="rounded-full bg-surface-100 px-2.5 py-1 text-xs font-medium text-surface-500 dark:bg-surface-800 dark:text-surface-400">
                        {t("mw_count_unknown", lang)}
                      </span>
                    ) : d.attention > 0 ? (
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                        {t("mw_need_n", lang).replace("{n}", String(d.attention))}
                      </span>
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-label={t("mw_all_clear", lang)} />
                    )}
                    {isOpen ? <ChevronDown className="h-4 w-4 text-surface-400" /> : <ChevronRight className="h-4 w-4 text-surface-400" />}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Khula hua department -- poori chauRai mein, grid ke NEECHE.
            Grid ke ANDAR khulta to sirf usi khane ka column terha ho
            jata; yahan poori qatar sath rehti hai. */}
        {departments
          .filter((d) => open[d.key])
          .map((d) => {
            const sections = new Map<string, CardData[]>();
            for (const c of d.tools) {
              const k = c.section ?? "";
              sections.set(k, [...(sections.get(k) ?? []), c]);
            }
            return (
              <div key={`open-${d.key}`} className="mt-3 rounded-xl border border-surface-200 bg-brand-25 p-4 dark:border-surface-800 dark:bg-surface-950/40">
                <p className="mb-3 flex items-center gap-2 font-display text-sm font-semibold text-surface-900 dark:text-surface-100">
                  <Icon name={d.icon} className="h-4 w-4 text-brand-600" /> {d.label}
                </p>
                <div className="space-y-4">
                  {[...sections.entries()].map(([section, cards]) => (
                    <div key={section || "_"}>
                      {section && (
                        <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-surface-400">{section}</p>
                      )}
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                        {cards.map((c) => (
                          <WorkCard key={`${d.key}-${c.href}`} card={c} onOpen={remember} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
      </section>
    </div>
  );
}
