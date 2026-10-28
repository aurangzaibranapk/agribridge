"use client";
import { useTransition } from "react";
import { setLanguage } from "@/actions/language";
import { LANG_LABELS, type Lang } from "@/lib/i18n/translations";

/**
 * Zaban badalne wala switch -- teenon saamne, chhupa hua koi nahi.
 *
 * Purana toggle ek button tha jo do zabanon ke darmiyan palat deta tha.
 * Teen zabanon ke sath wo tareeqa kaam nahi karta: banda dabata rehta hai
 * aur andaza lagata hai ke agli baar kaunsi aayegi. Teenon ek sath dikha
 * dene se ye sawal hi khatam ho jata hai -- aur ye bhi saaf rehta hai ke
 * abhi kaunsi lagi hui hai.
 *
 * Har zaban ka naam apni hi zaban mein likha hai (English, Roman Urdu,
 * اردو). Jo banda ye safha nahi parh sakta, wo apni zaban ka naam phir
 * bhi pehchan leta hai.
 */
export function LanguageSwitch({
  current,
  className,
  tone = "default",
}: {
  current: Lang;
  className?: string;
  tone?: "default" | "onDark";
}) {
  const [pending, start] = useTransition();
  const langs: Lang[] = ["en", "rm", "ur"];
  const onDark = tone === "onDark";

  return (
    <div
      className={
        "inline-flex items-center gap-0.5 rounded-lg border p-0.5 " +
        (onDark ? "border-white/15 bg-white/5 " : "border-surface-200 dark:border-surface-700 ") +
        (className ?? "")
      }
    >
      {langs.map((lang) => {
        const active = lang === current;
        return (
          <button
            key={lang}
            type="button"
            disabled={pending || active}
            onClick={() => start(() => void setLanguage(lang))}
            className={
              "rounded-md px-2 py-1 text-xs font-medium transition " +
              (active
                ? onDark
                  ? "bg-emerald-600 text-white"
                  : "bg-brand-600 text-white"
                : onDark
                  ? "text-white/70 hover:bg-white/10"
                  : "text-surface-600 hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-800")
            }
            title={LANG_LABELS[lang]}
          >
            {lang === "en" ? "EN" : lang === "rm" ? "Roman" : "اردو"}
          </button>
        );
      })}
    </div>
  );
}
