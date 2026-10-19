import { t, type Lang } from "@/lib/i18n/translations";

/** Pehla Tab: seedha safhe ke mawaad par (menu chhor kar). */
export function SkipLink({ lang }: { lang: Lang }) {
  return (
    <a href="#portal-main" className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-amber-400 focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-amber-950">
      {t("ph6_skip", lang)}
    </a>
  );
}
