"use client";
import { Mic, ChevronRight } from "lucide-react";
import { t, type Lang } from "@/lib/i18n/translations";

/** AI se kehne ka raasta -- wohi panel kholta hai jo har safhe par hai. */
export function AskAiButton({ lang }: { lang: Lang }) {
  return (
    <button
      type="button"
      onClick={() => document.dispatchEvent(new CustomEvent("agribridge:open-assistant"))}
      className="flex w-full items-start gap-4 rounded-card border border-surface-200 bg-white p-5 text-left transition hover:border-brand-300 hover:shadow-md dark:border-surface-800 dark:bg-surface-900"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300">
        <Mic className="h-[22px] w-[22px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-base font-semibold text-surface-900 dark:text-surface-100">
          {t("np_ai_title", lang)}
        </span>
        <span className="mt-1 block text-[13px] text-surface-600 dark:text-surface-300">{t("np_ai_desc", lang)}</span>
        <span className="mt-1.5 block text-[12px] text-surface-400">{t("np_ai_hint", lang)}</span>
      </span>
      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-surface-300" />
    </button>
  );
}
