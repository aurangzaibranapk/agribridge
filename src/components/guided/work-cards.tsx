"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import * as Icons from "lucide-react";
import { ChevronDown, ChevronRight, CheckCircle2 } from "lucide-react";
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
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${TONE[badge.tone]}`}>
      {badge.count === null ? "—" : badge.count}
      {badge.label && <span className="font-medium opacity-80">{badge.label}</span>}
    </span>
  );
}

export function WorkCard({ card, big = false, onOpen }: { card: CardData; big?: boolean; onOpen?: (href: string) => void }) {
  return (
    <Link
      href={card.href}
      onClick={() => onOpen?.(card.href)}
      className={`group flex items-start gap-3 rounded-xl border border-surface-200 bg-white transition hover:border-brand-300 hover:bg-brand-50/40 hover:shadow-md dark:border-surface-800 dark:bg-surface-900 dark:hover:border-brand-700 dark:hover:bg-brand-950/20 ${
        big ? "p-4" : "p-3.5"
      }`}
    >
      <span className={`flex shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300 ${big ? "h-10 w-10" : "h-9 w-9"}`}>
        <Icon name={card.icon} className={big ? "h-5 w-5" : "h-4 w-4"} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className={`font-display font-semibold text-surface-900 dark:text-surface-100 ${big ? "text-[15px]" : "text-sm"}`}>
            {card.label}
          </span>
          <Badge badge={card.badge} />
        </span>
        {card.description && (
          <span className="mt-0.5 block text-xs leading-relaxed text-surface-500">{card.description}</span>
        )}
      </span>
      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-surface-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
    </Link>
  );
}

/** Haal hi mein khole gaye safhe -- isi browser mein, kisi server par nahi. */
const RECENT_KEY = "agribridge:recent-work";

export function useRecent(): [string[], (href: string) => void] {
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

  return [recent, remember];
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
  const [recent, remember] = useRecent();

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

  function toggle(key: string) {
    setOpen((o) => {
      const next = { ...o, [key]: !o[key] };
      try {
        if (next[key]) localStorage.setItem(LAST_DEPT_KEY, key);
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
    <div className="space-y-7">
      {recentCards.length > 0 && (
        <section>
          <h2 className="mb-2 font-display text-xs font-semibold uppercase tracking-wide text-surface-400">
            {t("mw_recent", lang)}
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {recentCards.map((c) => (
              <Link
                key={c.href}
                href={c.href}
                onClick={() => remember(c.href)}
                className="inline-flex items-center gap-1.5 rounded-full border border-surface-200 bg-white px-3 py-1.5 text-xs font-medium text-surface-700 hover:border-brand-300 hover:text-brand-700 dark:border-surface-800 dark:bg-surface-900 dark:text-surface-300"
              >
                <Icon name={c.icon} className="h-3.5 w-3.5 text-brand-600" />
                {c.label}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2.5 font-display text-xs font-semibold uppercase tracking-wide text-surface-400">
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {quick.map((c) => (
              <WorkCard key={`q-${c.href}`} card={c} big onOpen={remember} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2.5 font-display text-xs font-semibold uppercase tracking-wide text-surface-400">
          {t("mw_depts", lang)}
        </h2>
        <div className="space-y-2.5">
          {departments.map((d) => {
            const isOpen = !!open[d.key];
            const sections = new Map<string, CardData[]>();
            for (const c of d.tools) {
              const k = c.section ?? "";
              sections.set(k, [...(sections.get(k) ?? []), c]);
            }

            return (
              <div key={d.key} className="overflow-hidden rounded-xl border border-surface-200 bg-surface-50/60 dark:border-surface-800 dark:bg-surface-900/40">
                <button
                  type="button"
                  onClick={() => toggle(d.key)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-100/70 dark:hover:bg-surface-800/50"
                  aria-expanded={isOpen}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-brand-600 shadow-sm dark:bg-surface-800 dark:text-brand-300">
                    <Icon name={d.icon} className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-sm font-semibold text-surface-900 dark:text-surface-100">{d.label}</span>
                    <span className="block text-[11px] text-surface-500">
                      {t("mw_tools_n", lang).replace("{n}", String(d.toolCount))}
                      {" · "}
                      {d.attention === null
                        ? t("mw_count_unknown", lang)
                        : d.attention > 0
                          ? t("mw_need_n", lang).replace("{n}", String(d.attention))
                          : t("mw_all_clear", lang)}
                    </span>
                    {/* Band qatar par jhalak -- warna banda har department
                        khol kar dekhta hai ke andar hai kya. */}
                    {!isOpen && d.preview.length > 0 && (
                      <span className="mt-0.5 block truncate text-[11px] text-surface-400">
                        {d.preview.join(", ")}
                        {d.toolCount > d.preview.length ? "…" : ""}
                      </span>
                    )}
                  </span>
                  {d.attention !== null && d.attention > 0 && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                      {d.attention}
                    </span>
                  )}
                  {isOpen ? <ChevronDown className="h-4 w-4 text-surface-400" /> : <ChevronRight className="h-4 w-4 text-surface-400" />}
                </button>

                {isOpen && (
                  <div className="space-y-4 border-t border-surface-200 bg-white px-3 py-3 dark:border-surface-800 dark:bg-surface-900">
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
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
