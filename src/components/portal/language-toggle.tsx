"use client";
import { useTransition } from "react";
import { setLanguage } from "@/actions/language";
import { t, type Lang } from "@/lib/i18n/translations";

/** EN · Roman · اردو -- teeno seedhe (pehle sirf en <-> ur tha, Roman wapas nahi aati thi). */
const OPTS: { v: Lang; label: string }[] = [{ v: "en", label: "EN" }, { v: "rm", label: "Roman" }, { v: "ur", label: "اردو" }];
export function LanguageToggle({ current }: { current: Lang }) {
  const [pending, start] = useTransition();
  return (
    <div role="group" aria-label={t("ph6_lang_label", current)} className="inline-flex rounded-lg border border-white/20 p-0.5 text-xs font-medium" aria-busy={pending}>
      {OPTS.map((o) => (
        <button key={o.v} type="button" aria-pressed={o.v === current} lang={o.v === "ur" ? "ur" : undefined} disabled={pending}
          onClick={() => o.v !== current && start(() => setLanguage(o.v))}
          className={`min-h-[32px] rounded-md px-2.5 ${o.v === current ? "bg-white/15 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
