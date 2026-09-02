"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { GraduationCap, ExternalLink } from "lucide-react";
import { setTrainingMode, type TrainingState } from "@/actions/training";
import { t, type Lang } from "@/lib/i18n/translations";

const initial: TrainingState = {};

function Off({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="text-xs text-surface-500 underline disabled:opacity-60">
      {label}
    </button>
  );
}

/**
 * Training Mode (D): naya banda -- "Aap X department mein hain, aap ke
 * ye N kaam hain", pehla qadam, Academy ka raasta. Wo khud band karta
 * hai; ERP ka poora naqsha us par nahi girta.
 */
export function TrainingBanner({
  lang,
  name,
  department,
  steps,
  tryRoute,
  moduleTitle,
  moduleKey = null,
}: {
  lang: Lang;
  name: string;
  department: string | null;
  steps: string[];
  tryRoute: string | null;
  moduleTitle: string | null;
  /** Guide (274): asal button highlight ke sath qadam ba qadam. */
  moduleKey?: string | null;
}) {
  const [, action] = useFormState(setTrainingMode, initial);
  return (
    <section className="rounded-card border border-brand-300 bg-brand-50 p-4 dark:border-brand-900/50 dark:bg-brand-950/30">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-brand-700 dark:text-brand-300">
            <GraduationCap className="h-4 w-4" /> {t("tm_title", lang)}
          </p>
          <h2 className="mt-1 font-display text-lg font-semibold text-surface-900 dark:text-white">
            {t("tm_welcome", lang).replace("{name}", name || "")}
          </h2>
          {department && <p className="text-sm text-surface-600 dark:text-surface-300">{t("tm_dept", lang).replace("{dept}", department)}</p>}
        </div>
        <form action={action}>
          <input type="hidden" name="on" value="0" />
          <Off label={t("tm_off", lang)} />
        </form>
      </div>
      {steps.length > 0 ? (
        <div className="mt-3">
          <p className="text-sm font-medium text-surface-800 dark:text-surface-200">{t("tm_your_work", lang).replace("{n}", String(steps.length))}</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-surface-700 dark:text-surface-300">
            {steps.slice(0, 6).map((s, i) => (
              <li key={i} className={i === 0 ? "font-medium text-brand-800 dark:text-brand-200" : ""}>{s}</li>
            ))}
          </ol>
        </div>
      ) : (
        <p className="mt-3 text-sm text-surface-600">{t("tm_no_module", lang)}</p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {tryRoute && (
          <Link href={tryRoute} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
            <ExternalLink className="h-4 w-4" /> {t("tm_first_step", lang)}
          </Link>
        )}
        <Link href="/admin/academy" className="inline-flex items-center gap-1.5 rounded-lg border border-brand-300 px-3 py-2 text-sm font-medium text-brand-800 dark:border-brand-800 dark:text-brand-200">
          <GraduationCap className="h-4 w-4" /> {moduleTitle ? `${t("ac_title", lang)}: ${moduleTitle}` : t("ac_title", lang)}
        </Link>
      </div>
    </section>
  );
}
