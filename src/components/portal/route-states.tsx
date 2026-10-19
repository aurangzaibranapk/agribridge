"use client";
import { useEffect } from "react";
import Link from "next/link";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";
import { puranaSafhaKhudTheekKarein } from "@/lib/errors/stale-build";
import { errorRef } from "@/lib/portal/error-ref";

const bar = "rounded-lg bg-surface-200/80 dark:bg-white/10 animate-pulse motion-reduce:animate-none";

/**
 * loading.tsx: asal safhe jaisi shakal (sarkhi, KPI dabbe, list) --
 * data aane par kuch uchhalta nahi. Gaon ke sust network par safha
 * sufaid nahi rehta.
 */
export function PortalLoading({ kpis = 4, rows = 5 }: { kpis?: number; rows?: number }) {
  const lang = useLang();
  return (
    <div className="mx-auto w-full max-w-[1760px] space-y-5 px-4 py-6 sm:px-6" aria-busy="true" aria-live="polite">
      <span className="sr-only" role="status">{t("ph6_loading", lang)}</span>
      <div className="space-y-2" aria-hidden>
        <div className={`${bar} h-7 w-56`} />
        <div className={`${bar} h-4 w-80 max-w-full`} />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-hidden>
        {Array.from({ length: kpis }).map((_, i) => <div key={i} className={`${bar} h-24`} />)}
      </div>
      <div className="space-y-2 rounded-2xl border border-surface-200 p-4 dark:border-surface-800" aria-hidden>
        {Array.from({ length: rows }).map((_, i) => <div key={i} className={`${bar} h-10`} />)}
      </div>
    </div>
  );
}

/**
 * error.tsx: dostana paighaam + hawala code. "Aap ka paisa mehfooz hai,
 * sirf ye screen nahi khuli." Technical jumla nahi -- wo log mein jata hai.
 */
export function PortalError({ error, reset, homeHref, titleKey = "ph6_err_title" }: { error: Error & { digest?: string }; reset: () => void; homeHref: string; titleKey?: "ph6_err_title" | "ph6_err_title_admin" }) {
  const lang = useLang();
  const ref = errorRef(error);
  useEffect(() => {
    if (puranaSafhaKhudTheekKarein(error)) return;
    console.error("Portal safhe par kharabi:", ref, error);
    try {
      fetch("/api/log-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({ module: "code", severity: "rukawat", message: `[${ref}] ${error.message || "portal"}`, route: window.location.pathname, digest: error.digest ?? null, detail: error.stack ?? null }),
      }).catch(() => {});
    } catch { /* safha wohi rahe */ }
  }, [error, ref]);
  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <div role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-center dark:border-amber-500/30 dark:bg-amber-500/10">
        <div className="text-4xl" aria-hidden>⚠️</div>
        <h1 className="mt-2 font-display text-lg font-semibold text-surface-900 dark:text-white">{t(titleKey, lang)}</h1>
        <p className="mt-1 text-sm text-surface-700 dark:text-slate-200">{t("ph6_err_body", lang)}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={reset} className="min-h-[44px] rounded-xl bg-green-600 px-4 text-sm font-semibold text-white hover:bg-green-700">↻ {t("ph6_err_retry", lang)}</button>
          <Link href={homeHref} className="inline-flex min-h-[44px] items-center rounded-xl border border-surface-300 px-4 text-sm font-semibold text-surface-700 dark:border-surface-600 dark:text-slate-200">{t("ph6_err_home", lang)}</Link>
        </div>
        <p className="mt-4 text-[11px] text-surface-500 dark:text-slate-400">{t("ph6_err_ref", lang)}: <span dir="ltr" className="ltr-iso font-mono font-semibold">{ref}</span></p>
      </div>
    </div>
  );
}
