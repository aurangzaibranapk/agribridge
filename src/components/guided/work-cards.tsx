"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import * as Icons from "lucide-react";
import { ChevronRight, CheckCircle2, ArrowRight } from "lucide-react";
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

/** Rail mein department ki ginti -- chhota nishan, poora badge nahi. */
function RailCount({ dept, lang }: { dept: DeptData; lang: Lang }) {
  if (dept.attention === null) {
    return <span className="shrink-0 text-[11px] text-surface-400">—</span>;
  }
  if (dept.attention > 0) {
    return (
      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
        {dept.attention}
      </span>
    );
  }
  return <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-label={t("mw_all_clear", lang)} />;
}

export interface AttentionChip {
  key: string;
  label: string;
  count: number | null;
  tone: "red" | "amber" | "blue" | "gray";
  href: string;
}

export function MyWorkBody({
  lang, quick, departments, defaultDept, attention, attentionTotal, attentionAllHref,
}: {
  lang: Lang;
  quick: CardData[];
  departments: DeptData[];
  /**
   * Role ka apna department -- login ke foran baad wohi khula milta hai.
   * null (manager/owner) = sab band, taake "Aaj ka kaam" par nazar rahe.
   */
  defaultDept: string | null;
  /** "Needs Attention" -- pehli chaar, pehle se tarjuma shuda. */
  attention: AttentionChip[];
  attentionTotal: number;
  attentionAllHref: string | null;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [recent, remember, clearRecent] = useRecent();

  // Pehla faisla client par hota hai, server par nahi: aakhri khola gaya
  // department sirf isi browser ko maloom hai. Us ke baghair role ka
  // apna department, aur wo bhi na ho to (ek hi department ho to wohi,
  // warna) koi nahi -- nazar "Aaj ka kaam" par rehti hai.
  useEffect(() => {
    let key: string | null = null;
    try {
      const saved = localStorage.getItem(LAST_DEPT_KEY);
      if (saved && departments.some((d) => d.key === saved)) key = saved;
    } catch {
      /* private window -- role wala default chal jayega */
    }
    if (!key && defaultDept && departments.some((d) => d.key === defaultDept)) key = defaultDept;
    if (!key && departments.length === 1) key = departments[0].key;
    setSelected(key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultDept, departments.length]);

  /**
   * Malik (7 September): "page ko scroll na karna paray... phir next
   * kisi aur product par click kare to wo bhi usi page par scroll na
   * karna paray... page apni jagah se na hile."
   *
   * Pehle department ka card khulte hi apne NEECHE apne auzaar dikhata
   * tha -- is se poora safha lamba/chhota hota rehta tha aur switch
   * karte hi scroll position uchhal jati thi. Ab left mein sirf
   * department ki fehrist hai (rail), aur daayen ek fixed-height panel
   * -- click karne se sirf ANDAR ka maal badalta hai, safhe ki lambai
   * nahi. Isi liye poora safha apni jagah se nahi hilta.
   */
  function select(key: string) {
    setSelected(key);
    try {
      localStorage.setItem(LAST_DEPT_KEY, key);
    } catch {
      /* yaad na rahe to bhi safha chalta rahe */
    }
  }

  const byHref = new Map<string, CardData>();
  for (const d of departments) for (const c of d.tools) byHref.set(c.href, c);
  const recentCards = recent.map((h) => byHref.get(h)).filter((c): c is CardData => !!c);

  const activeDept = departments.find((d) => d.key === selected) ?? null;

  return (
    <div className="space-y-4">
      {/* Needs attention + Aaj ka kaam + haal hi mein istemal -- ab TEEN
          alag bade dabbon mein nahi, ek hi chhoti patti mein (malik, 7
          September: "ek line mein ya do jagah bane, scroll na ho, sab ek
          hi page par rahe"). */}
      <section className="rounded-card border border-surface-200 bg-white px-4 py-3 dark:border-surface-800 dark:bg-surface-900">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {attention.length === 0 ? (
              <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {t("na_clear", lang)}
              </span>
            ) : (
              <>
                {attention.map((it) => (
                  <Link
                    key={it.key}
                    href={it.href}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium ${TONE[it.tone]}`}
                  >
                    <span className="tabular-nums font-semibold">{it.count ?? "—"}</span>
                    {it.label}
                  </Link>
                ))}
                {attentionTotal > attention.length && attentionAllHref && (
                  <Link href={attentionAllHref} className="inline-flex items-center gap-0.5 text-[12px] font-medium text-brand-700 hover:underline dark:text-brand-300">
                    {t("na_see_all", lang)} <ChevronRight className="h-3 w-3" />
                  </Link>
                )}
              </>
            )}
          </div>

          <span className="hidden h-4 w-px bg-surface-200 dark:bg-surface-700 sm:inline-block" />

          <div className="flex flex-wrap items-center gap-2">
            {quick.length === 0 ? (
              <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {t("mw_quick_clear", lang)}
              </span>
            ) : (
              quick.slice(0, 4).map((c) => (
                <Link
                  key={`q-${c.href}`}
                  href={c.href}
                  onClick={() => remember(c.href)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[12.5px] font-medium text-amber-900 hover:border-amber-300 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300"
                >
                  <Icon name={c.icon} className="h-3.5 w-3.5" />
                  {c.label}
                  {c.badge?.count != null && <span className="tabular-nums">· {c.badge.count}</span>}
                </Link>
              ))
            )}
          </div>

          {recentCards.length > 0 && (
            <>
              <span className="hidden h-4 w-px bg-surface-200 dark:bg-surface-700 sm:inline-block" />
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-medium uppercase tracking-wide text-surface-400">{t("mw_recent", lang)}:</span>
                {recentCards.slice(0, 3).map((c) => (
                  <Link
                    key={c.href}
                    href={c.href}
                    onClick={() => remember(c.href)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-surface-200 px-2.5 py-1 text-[12.5px] font-medium text-surface-600 hover:border-brand-300 hover:text-brand-700 dark:border-surface-700 dark:text-surface-300"
                  >
                    <Icon name={c.icon} className="h-3.5 w-3.5 text-brand-600" />
                    {c.label}
                  </Link>
                ))}
                <button
                  type="button"
                  onClick={clearRecent}
                  className="text-[11px] font-medium text-surface-400 hover:text-surface-600 dark:hover:text-surface-300"
                >
                  {t("mw_recent_clear", lang)}
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      {/*
       * Departments -- Fixed Split Workspace (malik, 7 September).
       *
       * Pehle department ka card khulte hi apne NEECHE poori chauRai
       * mein auzaar dikhata tha, aur switch karte hi safhe ki lambai
       * badal jati thi -- scroll position uchhalti thi. Screenshot mein
       * yehi dikha: Milk khula to Farmers/Grain neeche dhakel gaye.
       *
       * Ab left mein sirf department NAAM (rail), daayen ek fixed
       * min-height panel jis mein sirf ANDAR ka maal badalta hai --
       * safhe ki lambai department se department badalte hue kabhi
       * nahi badalti, is liye page apni jagah se nahi hilta. Kisi ek
       * department mein bahut zyada auzaar hon to sirf PANEL ke andar
       * scroll hota hai, poora safha nahi.
       *
       * Ek hi department ho (chhota role) to rail bekar hai -- seedha
       * uske auzaar dikha dete hain.
       */}
      <section className="overflow-hidden rounded-card border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
        <h2 className="border-b border-surface-100 px-5 py-3 font-display text-[13px] font-semibold uppercase tracking-wide text-surface-500 dark:border-surface-800">
          {t("mw_depts", lang)}
        </h2>

        {departments.length <= 1 ? (
          <div className="p-4">
            {departments.length === 1 && <ToolGrid tools={departments[0].tools} onOpen={remember} />}
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row">
            {/* Rail -- department ki fehrist, khud kaam nahi kholti. */}
            <div className="flex shrink-0 flex-row overflow-x-auto border-b border-surface-100 dark:border-surface-800 sm:w-56 sm:flex-col sm:overflow-x-visible sm:border-b-0 sm:border-r sm:dark:border-surface-800">
              {departments.map((d) => {
                const isSelected = d.key === selected;
                return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => select(d.key)}
                    aria-current={isSelected}
                    className={`flex shrink-0 items-center gap-2.5 whitespace-nowrap border-b-2 px-4 py-3 text-left transition sm:w-full sm:border-b-0 sm:border-l-2 ${
                      isSelected
                        ? "border-brand-500 bg-brand-50/60 text-brand-700 dark:bg-brand-950/30 dark:text-brand-300"
                        : "border-transparent text-surface-600 hover:bg-surface-50 dark:text-surface-300 dark:hover:bg-surface-800/60"
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        isSelected ? "bg-white text-brand-600 dark:bg-surface-900" : "bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300"
                      }`}
                    >
                      <Icon name={d.icon} className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1 text-[13px] font-medium">{d.label}</span>
                    <RailCount dept={d} lang={lang} />
                  </button>
                );
              })}
            </div>

            {/* Panel -- sirf isi ka maal badalta hai, iski min-height
                fixed hai taake department switch karne se safhe ki
                lambai na badle. */}
            <div className="min-h-[280px] flex-1 overflow-y-auto p-4" style={{ maxHeight: "min(70vh, 640px)" }}>
              {activeDept ? (
                <>
                  <p className="mb-3 text-xs font-medium tabular-nums text-surface-400">
                    {t("mw_tools_n", lang).replace("{n}", String(activeDept.toolCount))}
                  </p>
                  <ToolGrid tools={activeDept.tools} onOpen={remember} />
                </>
              ) : (
                <p className="text-sm text-surface-400">{t("mw_open", lang)}</p>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

/** Ek department ke auzaar -- section ke hisaab se, chhote khaanon mein. */
function ToolGrid({ tools, onOpen }: { tools: CardData[]; onOpen: (href: string) => void }) {
  if (tools.length === 0) return null;
  const sections = new Map<string, CardData[]>();
  for (const c of tools) {
    const k = c.section ?? "";
    sections.set(k, [...(sections.get(k) ?? []), c]);
  }
  return (
    <div className="space-y-4">
      {[...sections.entries()].map(([section, items]) => (
        <div key={section || "_"}>
          {section && <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-surface-400">{section}</p>}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((c) => (
              <WorkCard key={c.href} card={c} onOpen={onOpen} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
