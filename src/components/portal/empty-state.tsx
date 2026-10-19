import Link from "next/link";
import { t, type Lang, type TranslationKey } from "@/lib/i18n/translations";

const OTHERS: Record<Lang, Lang[]> = { en: ["rm", "ur"], rm: ["en", "ur"], ur: ["en", "rm"] };

/**
 * Khaali list khud samjhaye: nishan, ek jumla wajah, aur agla qadam.
 * Server aur client dono mein chalta hai (koi hook nahi).
 */
const CTA = {
  green: "bg-green-600 hover:bg-green-700",
  blue: "bg-gradient-to-r from-blue-600 to-violet-600 hover:opacity-95 rtl:bg-gradient-to-l",
};
export function EmptyState({ icon, title, titleKey, body, bodyKey, lang, cta, secondary, compact = false, tone = "green" }: {
  icon: string; lang: Lang; title?: string; titleKey?: TranslationKey; body?: string; bodyKey?: TranslationKey;
  cta?: { href: string; label: string }; secondary?: { href: string; label: string }; compact?: boolean;
  /** green = kisan / admin dairy, blue = gahak (navy) portal */
  tone?: keyof typeof CTA;
}) {
  return (
    <div role="status" className={`flex flex-col items-center text-center ${compact ? "gap-1.5 py-6" : "gap-2 py-10"}`}>
      <div className={`grid place-items-center rounded-2xl bg-surface-100 dark:bg-white/5 ${compact ? "h-12 w-12 text-2xl" : "h-16 w-16 text-4xl"}`} aria-hidden>{icon}</div>
      <p className="font-semibold text-surface-900 dark:text-white">{titleKey ? t(titleKey, lang) : title}</p>
      {titleKey && (
        <p className="text-[11px] text-surface-500 dark:text-slate-400">
          {OTHERS[lang].map((o, i) => <span key={o}>{i ? " · " : ""}<span dir={o === "ur" ? "rtl" : undefined} lang={o === "ur" ? "ur" : undefined}>{t(titleKey, o)}</span></span>)}
        </p>
      )}
      {(body || bodyKey) && <p className="max-w-md text-sm text-surface-600 dark:text-slate-300">{bodyKey ? t(bodyKey, lang) : body}</p>}
      {(cta || secondary) && (
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {cta && <Link href={cta.href} className={`inline-flex min-h-[44px] items-center rounded-xl px-4 text-sm font-semibold text-white ${CTA[tone]}`}>{cta.label}</Link>}
          {secondary && <Link href={secondary.href} className="inline-flex min-h-[44px] items-center rounded-xl border border-surface-200 px-4 text-sm font-semibold text-surface-700 hover:bg-surface-50 dark:border-surface-700 dark:text-slate-200 dark:hover:bg-white/5">{secondary.label}</Link>}
        </div>
      )}
    </div>
  );
}
