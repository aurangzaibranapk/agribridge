import localFont from "next/font/local";
import { LanguageSwitch } from "@/components/ui/language-switch";
import { LangProvider } from "@/lib/i18n/lang-context";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { loadOpenVacancies } from "@/lib/jobs/load-open-vacancies";
import { LIVE_VACANCY_COPY } from "@/lib/jobs/vacancy-preview";
import { presentVacancy } from "@/lib/jobs/vacancy-i18n";
import { VacancyList } from "./vacancy-list";

export const dynamic = "force-dynamic";

const urdu = localFont({
  src: "../../login/fonts/noto-nastaliq-urdu.woff2",
  variable: "--font-urdu",
  display: "swap",
  weight: "400 700",
});

export default async function CareersPage() {
  const lang = getLanguageFromCookies("en");
  const preview = process.env.NODE_ENV !== "production" && process.env.CAREERS_PREVIEW === "1";
  const sources = preview ? LIVE_VACANCY_COPY : await loadOpenVacancies().catch(() => []);
  const vacancies = sources.map((row) => presentVacancy(row, lang));
  const rtl = lang === "ur";

  return (
    <LangProvider lang={lang}>
      <div
        dir={rtl ? "rtl" : "ltr"}
        lang={rtl ? "ur" : lang === "en" ? "en" : "ur-Latn"}
        className={`bg-brand-25 ${rtl ? `${urdu.variable} font-urdu` : ""}`}
      >
        <div className="mx-auto max-w-3xl px-4 py-6 md:py-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className={`font-display text-2xl font-semibold text-surface-900 md:text-3xl ${rtl ? "leading-snug" : ""}`}>
                {t("sp_careers_title", lang)}
              </h1>
              <p className={`mt-1 text-sm text-surface-500 md:text-base ${rtl ? "leading-relaxed" : ""}`}>{t("sp_careers_lead", lang)}</p>
            </div>
            <LanguageSwitch current={lang} />
          </div>
          <div className="mt-5">
            <VacancyList vacancies={vacancies} />
          </div>
        </div>
      </div>
    </LangProvider>
  );
}
