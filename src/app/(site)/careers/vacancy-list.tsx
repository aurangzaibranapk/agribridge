"use client";

import { useState } from "react";
import { Banknote, Briefcase, MapPin, Users } from "lucide-react";
import { ApplyForm } from "./apply-form";
import type { CareerCard } from "@/lib/jobs/vacancy-i18n";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

function BrandTag({ urdu, children }: { urdu: boolean; children: string }) {
  return (
    <span className={`inline-flex max-w-full truncate rounded-full border border-brand-200 bg-brand-25 px-2 py-0.5 text-[11px] font-medium text-brand-800 ${urdu ? "leading-snug" : ""}`}>
      {children}
    </span>
  );
}

export function VacancyList({ vacancies }: { vacancies: CareerCard[] }) {
  const lang = useLang();
  const urdu = lang === "ur";
  const [applyId, setApplyId] = useState<string | null>(null);
  const open = vacancies.find((vacancy) => vacancy.id === applyId) ?? null;

  if (vacancies.length === 0) {
    return <p className="rounded-2xl border border-dashed border-brand-200 bg-white p-8 text-center text-surface-500">{t("sp_no_vacancy", lang)}</p>;
  }

  return (
    <>
      <div className="grid gap-3">
        {vacancies.map((vacancy) => (
          <article key={vacancy.id} className="rounded-2xl border border-brand-100 bg-white p-4 shadow-card">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <Briefcase className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className={`font-display text-lg font-semibold text-surface-900 ${urdu ? "leading-snug" : "leading-tight"}`}>{vacancy.title}</h2>
                  {vacancy.brand && <BrandTag urdu={urdu}>{vacancy.brand}</BrandTag>}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-surface-600">
                  {vacancy.location && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-surface-100 px-2 py-0.5">
                      <MapPin className="h-3 w-3 text-brand-700" aria-hidden />
                      <span className="sr-only">{t("sp_job_location", lang)}: </span>
                      {vacancy.location}
                    </span>
                  )}
                  {vacancy.salary && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-800">
                      <Banknote className="h-3 w-3" aria-hidden />
                      {t("sp_salary", lang)}{" "}
                      <bdi className="tabular-nums ltr-iso">{lang === "ur" ? `${vacancy.salary} ${t("sp_currency", lang)}` : `${t("sp_currency", lang)} ${vacancy.salary}`}</bdi>
                      <span className="font-normal text-brand-700">· {t("sp_per_month", lang)}</span>
                    </span>
                  )}
                  {vacancy.positions != null && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-surface-100 px-2 py-0.5">
                      <Users className="h-3 w-3 text-brand-700" aria-hidden />
                      <bdi className="tabular-nums">{vacancy.positions}</bdi> {t("sp_positions", lang)}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {vacancy.blurb && <p className={`mt-3 line-clamp-2 text-sm text-surface-600 ${urdu ? "leading-relaxed" : "leading-6"}`}>{vacancy.blurb}</p>}
            <button
              type="button"
              onClick={() => setApplyId(vacancy.id)}
              className="mt-3 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
            >
              {t("sp_apply", lang)}
            </button>
          </article>
        ))}
      </div>
      {open && <ApplyForm key={open.id} vacancy={open} onClose={() => setApplyId(null)} />}
    </>
  );
}
