"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Check, X } from "lucide-react";
import { decideAccess, type AccessState } from "@/actions/access-requests";
import { Card } from "@/components/ui/layout-primitives";
import { Textarea, Label } from "@/components/ui/form";
import { t, type Lang } from "@/lib/i18n/translations";

const initial: AccessState = {};

function Btn({ label, tone, decision }: { label: string; tone: "green" | "red"; decision: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name="decision" value={decision} disabled={pending} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-60 ${tone === "green" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`}>
      {tone === "green" ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />} {pending ? "…" : label}
    </button>
  );
}

export function DecideForm({ lang, id, isHead }: { lang: Lang; id: string; isHead: boolean }) {
  const [state, action] = useFormState(decideAccess, initial);
  return (
    <Card>
      <h3 className="mb-1 text-sm font-semibold">{t("ar_decide", lang)}</h3>
      <p className="mb-2 text-xs text-surface-500">{isHead ? t("ar_head_note", lang) : t("ar_master_note", lang)}</p>
      {state.error && <p className="mb-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state.success && <p className="mb-2 rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{state.message}</p>}
      <form action={action} className="space-y-2">
        <input type="hidden" name="id" value={id} />
        <div>
          <Label>{t("ar_note", lang)}</Label>
          <Textarea name="note" rows={2} />
        </div>
        <div className="flex gap-2">
          <Btn label={t("ar_approve", lang)} tone="green" decision="approved" />
          <Btn label={t("ar_reject", lang)} tone="red" decision="rejected" />
        </div>
      </form>
    </Card>
  );
}
