"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { Save } from "lucide-react";
import { saveFeatureHelp, type HelpState } from "@/actions/feature-help";
import { Card } from "@/components/ui/layout-primitives";
import { Button, Input, Label, Textarea } from "@/components/ui/form";
import { t, type Lang } from "@/lib/i18n/translations";

const initial: HelpState = {};

interface Existing {
  purpose: string;
  who_uses: string;
  when_use: string;
  how_steps: string;
  next_step: string;
  mistakes: string;
  video_url: string;
  faq: string;
  related: string;
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <span className="inline-flex items-center gap-1.5">
        <Save className="h-4 w-4" /> {pending ? "…" : label}
      </span>
    </Button>
  );
}

export function HelpEditor({
  lang,
  featureKey,
  featureLabel,
  editLang,
  existing,
}: {
  lang: Lang;
  featureKey: string;
  featureLabel: string;
  editLang: "rm" | "en" | "ur";
  existing: Existing | null;
}) {
  const [state, action] = useFormState(saveFeatureHelp, initial);
  const e = existing ?? { purpose: "", who_uses: "", when_use: "", how_steps: "", next_step: "", mistakes: "", video_url: "", faq: "", related: "" };

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-base font-semibold text-surface-900 dark:text-white">
          {featureLabel} <span className="font-mono text-xs text-surface-400">{featureKey}</span>
        </h2>
        <div className="flex gap-1 text-xs">
          {(["rm", "en", "ur"] as const).map((l) => (
            <Link key={l} href={`/admin/platform/help?key=${encodeURIComponent(featureKey)}&lang=${l}`} className={`rounded-full px-3 py-1 ${editLang === l ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-700 dark:bg-surface-800 dark:text-surface-300"}`}>
              {l}
            </Link>
          ))}
        </div>
      </div>
      {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state.success && <p className="mb-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{t("hp_saved", lang)}</p>}
      <form action={action} className="space-y-3" key={`${featureKey}-${editLang}`}>
        <input type="hidden" name="feature_key" value={featureKey} />
        <input type="hidden" name="lang" value={editLang} />
        <div>
          <Label>{t("hp_purpose", lang)} *</Label>
          <Textarea name="purpose" rows={2} defaultValue={e.purpose} required />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>{t("hp_who", lang)}</Label>
            <Input name="who_uses" defaultValue={e.who_uses} />
          </div>
          <div>
            <Label>{t("hp_when", lang)}</Label>
            <Input name="when_use" defaultValue={e.when_use} />
          </div>
        </div>
        <div>
          <Label>{t("hp_how", lang)} <span className="text-xs text-surface-400">({t("hp_one_per_line", lang)})</span></Label>
          <Textarea name="how_steps" rows={5} defaultValue={e.how_steps} />
        </div>
        <div>
          <Label>{t("hp_next", lang)}</Label>
          <Input name="next_step" defaultValue={e.next_step} />
        </div>
        <div>
          <Label>{t("hp_mistakes", lang)} <span className="text-xs text-surface-400">({t("hp_one_per_line", lang)})</span></Label>
          <Textarea name="mistakes" rows={3} defaultValue={e.mistakes} />
        </div>
        <div>
          <Label>{t("hp_video", lang)} (URL)</Label>
          <Input name="video_url" defaultValue={e.video_url} placeholder="https://" />
        </div>
        <div>
          <Label>{t("hp_faq", lang)} <span className="text-xs text-surface-400">(Q: … / A: … — {t("hp_one_per_line", lang)})</span></Label>
          <Textarea name="faq" rows={4} defaultValue={e.faq} />
        </div>
        <div>
          <Label>{t("hp_related", lang)} <span className="text-xs text-surface-400">(feature key, {t("hp_one_per_line", lang)})</span></Label>
          <Textarea name="related" rows={2} defaultValue={e.related} />
        </div>
        <Submit label={t("hp_save", lang)} />
      </form>
    </Card>
  );
}
