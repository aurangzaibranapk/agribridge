"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HelpCircle, X, PlayCircle, Bot, Pencil, ChevronRight } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

interface HelpData {
  found: boolean;
  key?: string;
  label?: string;
  route?: string;
  lang?: string | null;
  canEdit?: boolean;
  help: null | {
    purpose: string;
    who: string | null;
    when: string | null;
    how: string[];
    next: string | null;
    mistakes: string[];
    video: string | null;
    faq: { q: string; a: string }[];
    related: { key: string; label: string; route: string }[];
  };
}

/**
 * Har safhe ke upar daayen "?" (266). Side panel: ye safha kis liye hai,
 * kya kar sakte hain, aam raasta, ghaltiyan, video, FAQ, AI se poochein.
 * Maloomat feature_help se aati hai -- raasta khud pehchana jata hai,
 * har safhe mein kuch likhna nahi paRta.
 */
export function HelpButton({ compact = false }: { compact?: boolean }) {
  const lang = useLang();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<HelpData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    fetch(`/api/help?path=${encodeURIComponent(pathname)}`)
      .then((r) => r.json())
      .then((d) => alive && setData(d))
      .catch(() => alive && setData({ found: false, help: null }))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [open, pathname]);

  const askHref = `/admin/bridge-ai?q=${encodeURIComponent((data?.label ? `${data.label}: ` : "") + t("hp_ask_default", lang))}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={t("hp_button", lang)}
        className={`inline-flex items-center gap-1 rounded-lg border border-surface-200 text-surface-600 hover:border-brand-400 hover:text-brand-700 dark:border-surface-700 dark:text-surface-300 ${compact ? "h-9 w-9 justify-center" : "h-9 px-2.5"}`}
      >
        <HelpCircle className="h-4 w-4" />
        {!compact && <span className="hidden text-xs font-medium lg:inline">{t("hp_button", lang)}</span>}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setOpen(false)}>
          <aside
            className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-2xl dark:bg-surface-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-surface-400">{t("hp_title", lang)}</p>
                <h2 className="font-display text-lg font-semibold text-surface-900 dark:text-white">
                  {data?.label ?? (loading ? "…" : t("hp_unknown", lang))}
                </h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-surface-400 hover:text-surface-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            {loading && <p className="text-sm text-surface-500">…</p>}

            {!loading && data && !data.found && (
              <p className="text-sm text-surface-600">{t("hp_no_feature", lang)}</p>
            )}

            {!loading && data?.found && !data.help && (
              <div className="space-y-2 text-sm text-surface-600">
                <p>{t("hp_not_written", lang)}</p>
                {data.canEdit && (
                  <Link href={`/admin/platform/help?key=${data.key}`} className="inline-flex items-center gap-1 text-brand-600 underline">
                    <Pencil className="h-3.5 w-3.5" /> {t("hp_write", lang)}
                  </Link>
                )}
              </div>
            )}

            {!loading && data?.help && (
              <div className="space-y-4 text-sm">
                <Section title={t("hp_purpose", lang)}>
                  <p>{data.help.purpose}</p>
                </Section>
                {(data.help.who || data.help.when) && (
                  <div className="grid grid-cols-2 gap-3">
                    {data.help.who && (
                      <Section title={t("hp_who", lang)}>
                        <p>{data.help.who}</p>
                      </Section>
                    )}
                    {data.help.when && (
                      <Section title={t("hp_when", lang)}>
                        <p>{data.help.when}</p>
                      </Section>
                    )}
                  </div>
                )}
                {data.help.how.length > 0 && (
                  <Section title={t("hp_how", lang)}>
                    <ol className="list-decimal space-y-1 pl-5">
                      {data.help.how.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ol>
                  </Section>
                )}
                {data.help.next && (
                  <Section title={t("hp_next", lang)}>
                    <p className="flex items-start gap-1.5">
                      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /> {data.help.next}
                    </p>
                  </Section>
                )}
                {data.help.mistakes.length > 0 && (
                  <Section title={t("hp_mistakes", lang)}>
                    <ul className="list-disc space-y-1 pl-5 text-amber-800 dark:text-amber-300">
                      {data.help.mistakes.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </Section>
                )}
                {data.help.video && (
                  <a
                    href={data.help.video}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-surface-100 px-3 py-2 text-sm font-medium text-surface-800 hover:bg-surface-200 dark:bg-surface-800 dark:text-surface-100"
                  >
                    <PlayCircle className="h-4 w-4" /> {t("hp_video", lang)}
                  </a>
                )}
                {data.help.faq.length > 0 && (
                  <Section title={t("hp_faq", lang)}>
                    <div className="space-y-2">
                      {data.help.faq.map((f, i) => (
                        <div key={i}>
                          <p className="font-medium text-surface-800 dark:text-surface-200">{f.q}</p>
                          <p className="text-surface-600 dark:text-surface-400">{f.a}</p>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}
                {data.help.related.length > 0 && (
                  <Section title={t("hp_related", lang)}>
                    <div className="flex flex-wrap gap-1.5">
                      {data.help.related.map((r) => (
                        <Link key={r.key} href={r.route} onClick={() => setOpen(false)} className="rounded-full bg-surface-100 px-2.5 py-1 text-xs text-surface-700 hover:bg-brand-50 hover:text-brand-700 dark:bg-surface-800 dark:text-surface-300">
                          {r.label}
                        </Link>
                      ))}
                    </div>
                  </Section>
                )}
                <div className="flex flex-wrap items-center gap-2 border-t border-surface-200 pt-3 dark:border-surface-800">
                  <Link href={askHref} onClick={() => setOpen(false)} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
                    <Bot className="h-4 w-4" /> {t("hp_ask_ai", lang)}
                  </Link>
                  {data.canEdit && (
                    <Link href={`/admin/platform/help?key=${data.key}`} onClick={() => setOpen(false)} className="inline-flex items-center gap-1 text-xs text-surface-500 underline">
                      <Pencil className="h-3.5 w-3.5" /> {t("hp_edit", lang)}
                    </Link>
                  )}
                  {data.lang && data.lang !== lang && <span className="text-[11px] text-surface-400">{t("hp_lang_fallback", lang)}</span>}
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-surface-400">{title}</p>
      <div className="text-surface-700 dark:text-surface-300">{children}</div>
    </div>
  );
}
