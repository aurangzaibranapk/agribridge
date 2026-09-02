"use client";

import { useState } from "react";
import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { CheckCircle2, PlayCircle, ExternalLink, Bot, ChevronDown, ChevronUp } from "lucide-react";
import { markModule, type TrainingState } from "@/actions/training";
import { Card } from "@/components/ui/layout-primitives";
import { Badge, Button } from "@/components/ui/form";
import { t, type Lang } from "@/lib/i18n/translations";

const initial: TrainingState = {};

function Mark({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      <span className="inline-flex items-center gap-1.5">
        <CheckCircle2 className="h-4 w-4" /> {pending ? "…" : label}
      </span>
    </Button>
  );
}

export function ModuleCard({
  lang,
  moduleKey,
  title,
  summary,
  steps,
  video,
  tryRoute,
  status,
  compact = false,
}: {
  lang: Lang;
  moduleKey: string;
  title: string;
  summary: string | null;
  steps: string[];
  video: string | null;
  tryRoute: string | null;
  status: string | null;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(!compact);
  const [state, action] = useFormState(markModule, initial);
  const done = status === "done";
  return (
    <Card className={done ? "border-emerald-200 dark:border-emerald-900/40" : ""}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">{title}</h3>
          {summary && <p className="mt-0.5 text-sm text-surface-500">{summary}</p>}
        </div>
        {done ? <Badge tone="green">{t("ac_done", lang)}</Badge> : status === "in_progress" ? <Badge tone="amber">{t("ac_in_progress", lang)}</Badge> : <Badge tone="gray">{t("ac_not_started", lang)}</Badge>}
      </div>
      {compact && (
        <button type="button" onClick={() => setOpen((o) => !o)} className="mt-2 inline-flex items-center gap-1 text-xs text-brand-600">
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />} {open ? t("ac_less", lang) : t("ac_more", lang)}
        </button>
      )}
      {open && (
        <div className="mt-3 space-y-3 text-sm">
          {video ? (
            <a href={video} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-surface-100 px-3 py-2 font-medium text-surface-800 hover:bg-surface-200 dark:bg-surface-800 dark:text-surface-100">
              <PlayCircle className="h-4 w-4" /> {t("ac_watch", lang)}
            </a>
          ) : (
            <p className="text-xs text-surface-400">{t("ac_no_video", lang)}</p>
          )}
          <ol className="list-decimal space-y-1 pl-5 text-surface-700 dark:text-surface-300">
            {steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          <div className="flex flex-wrap items-center gap-2 border-t border-surface-200 pt-3 dark:border-surface-800">
            {tryRoute && (
              <Link href={`${tryRoute}${tryRoute.includes("?") ? "&" : "?"}guide=${moduleKey}&step=1`} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
                <ExternalLink className="h-4 w-4" /> {t("ac_guide_start", lang)}
              </Link>
            )}
            {tryRoute && (
              <Link href={tryRoute} className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-2 text-sm text-surface-700 dark:border-surface-700 dark:text-surface-300">
                {t("ac_try", lang)}
              </Link>
            )}
            <Link href={`/admin/bridge-ai?q=${encodeURIComponent(title + ": " + t("ac_ask_q", lang))}`} className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-2 text-sm text-surface-700 dark:border-surface-700 dark:text-surface-300">
              <Bot className="h-4 w-4" /> {t("hp_ask_ai", lang)}
            </Link>
            {!done && (
              <form action={action} className="ml-auto">
                <input type="hidden" name="module_key" value={moduleKey} />
                <input type="hidden" name="status" value="done" />
                <Mark label={t("ac_mark_done", lang)} />
              </form>
            )}
          </div>
          {state.error && <p className="text-xs text-red-600">{state.error}</p>}
        </div>
      )}
    </Card>
  );
}
