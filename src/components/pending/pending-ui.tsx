"use client";
import { Clock, UserRound, Check } from "lucide-react";
import { cn } from "@/lib/utils/format";
import { t, type Lang } from "@/lib/i18n/translations";
import { ageTone, roleLabelKey } from "@/lib/pending/categories";

/** Laal ginti (mockup: mock_badge_*). */
export function RedBadge({ n, className }: { n: number; className?: string }) {
  if (n <= 0) return null;
  return (
    <span
      data-badge="pending"
      data-count={n}
      className={cn(
        "inline-flex h-[22px] min-w-[22px] shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-gradient-to-b from-[#ff4d4f] to-[#e11d2e] px-1.5 text-[11px] font-extrabold text-white shadow-[0_4px_10px_-2px_rgba(225,29,46,.55)] ring-2 ring-white dark:ring-[#0b1430]",
        className
      )}
    >
      {n > 999 ? "999+" : n}
    </span>
  );
}

/** Hara "Naya" -- abhi tak nahi khola. */
export function NayaPill({ n, lang, short = false, className }: { n?: number; lang: Lang; short?: boolean; className?: string }) {
  if (n != null && n <= 0) return null;
  return (
    <span
      data-badge="naya"
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-gradient-to-b from-emerald-500 to-emerald-600 px-1.5 text-[10.5px] font-bold text-white shadow-[0_3px_8px_-2px_rgba(5,150,105,.5)]",
        className
      )}
    >
      <i className="inline-block h-1.5 w-1.5 rounded-full bg-white ring-2 ring-white/30" />
      {short ? n : `${t("apb_new", lang)}${n != null ? ` ${n}` : ""}`}
    </span>
  );
}

export function ZeroMark() {
  return <Check aria-hidden className="h-3.5 w-3.5 shrink-0 text-surface-400 dark:text-surface-500" />;
}

export function ageText(days: number | null, lang: Lang): string {
  if (days == null) return "";
  if (days === 0) return t("apb_today", lang);
  return `${days} ${t(days === 1 ? "apb_day_since" : "apb_days_since", lang)}`;
}

export function AgeChip({ days, lang, override }: { days: number | null; lang: Lang; override?: string }) {
  const tone = ageTone(days);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-2 py-0.5 text-[11px] font-bold",
        tone === "blue" && "bg-blue-500/10 text-blue-600 dark:text-blue-400",
        tone === "amber" && "bg-amber-500/15 text-amber-700 dark:text-amber-300",
        tone === "red" && "bg-red-500/10 text-red-600 dark:text-rose-400"
      )}
    >
      <Clock className="h-3 w-3" />
      {override ?? ageText(days, lang)}
    </span>
  );
}

/** "● PENDING · BAQI · 15 din se · Admin / Owner" -- menu ki qatar ke neeche. */
export function PendingMeta({ days, pendingWith, lang, onDark = false }: { days: number | null; pendingWith: string | null; lang: Lang; onDark?: boolean }) {
  return (
    <span className={cn("mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10.5px]", onDark ? "text-white/80" : "text-surface-500 dark:text-surface-400")}>
      <span className={cn("font-bold tracking-wide", onDark ? "text-red-200" : "text-red-600 dark:text-rose-400")}>● {t("apb_pending", lang)}</span>
      {days != null && (
        <span className="inline-flex items-center gap-0.5">
          <Clock className="h-2.5 w-2.5" />
          {ageText(days, lang)}
        </span>
      )}
      {pendingWith && (
        <span className="inline-flex items-center gap-0.5">
          <UserRound className="h-2.5 w-2.5" />
          {t(roleLabelKey(pendingWith), lang)}
        </span>
      )}
    </span>
  );
}
