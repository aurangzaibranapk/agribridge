"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Check, RotateCcw, X } from "lucide-react";
import { decideAttendanceCorrection, type AttState } from "@/actions/hr-attendance";
import { Card } from "@/components/ui/layout-primitives";
import { Badge, Button, Textarea } from "@/components/ui/form";
import { t, type Lang, type TranslationKey } from "@/lib/i18n/translations";

const initial: AttState = {};

const STATUS_LABEL: Record<string, TranslationKey> = {
  present: "hra_st_present",
  absent: "hra_st_absent",
  leave: "hra_st_leave",
  half_day: "hra_st_half_day",
};

interface Row {
  id: string;
  who: string;
  date: string;
  requestedStatus: string;
  requestedIn: string | null;
  requestedOut: string | null;
  reason: string;
  status: string;
  wasStatus: string | null;
  wasIn: string | null;
}

function Decide({ decision, label, icon }: { decision: string; label: string; icon: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      name="decision"
      value={decision}
      disabled={pending}
      variant={decision === "approved" ? "primary" : "secondary"}
    >
      <span className="inline-flex items-center gap-1">
        {icon} {label}
      </span>
    </Button>
  );
}

export function CorrectionsClient({ lang, rows }: { lang: Lang; rows: Row[] }) {
  const [state, action] = useFormState(decideAttendanceCorrection, initial);

  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <Card key={r.id}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold">{r.who}</p>
              <p className="text-xs text-surface-500">{r.date}</p>
            </div>
            <Badge tone={r.status === "sent_back" ? "amber" : "gray"}>{r.status}</Badge>
          </div>

          {/* Purana aur naya SATH likhe jate hain. Sirf "kya maanga hai"
              dikhana faisla karne wale ko ye batata hi nahi ke badal kya
              raha hai -- aur wohi asal sawal hai. */}
          <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
            <div className="rounded border border-surface-200 bg-surface-50 p-2">
              <p className="text-[10px] uppercase text-surface-400">{t("hra_was", lang)}</p>
              <p className="font-medium">
                {r.wasStatus ? t(STATUS_LABEL[r.wasStatus] ?? "hra_st_missing", lang) : t("hra_st_missing", lang)}
                {r.wasIn ? ` · ${r.wasIn.slice(0, 5)}` : ""}
              </p>
            </div>
            <div className="rounded border border-brand-200 bg-brand-50/50 p-2">
              <p className="text-[10px] uppercase text-surface-400">{t("hra_now", lang)}</p>
              <p className="font-medium">
                {t(STATUS_LABEL[r.requestedStatus] ?? "hra_st_present", lang)}
                {r.requestedIn ? ` · ${r.requestedIn.slice(0, 5)}` : ""}
                {r.requestedOut ? ` – ${r.requestedOut.slice(0, 5)}` : ""}
              </p>
            </div>
          </div>

          <p className="mt-2 rounded bg-surface-50 p-2 text-xs text-surface-700">{r.reason}</p>

          <form action={action} className="mt-2 space-y-2">
            <input type="hidden" name="correction_id" value={r.id} />
            <Textarea name="manager_comment" rows={2} placeholder={t("hra_manager_comment", lang)} required />
            <div className="flex flex-wrap gap-2">
              <Decide decision="approved" label={t("hra_approve", lang)} icon={<Check className="h-3.5 w-3.5" />} />
              <Decide decision="rejected" label={t("hra_reject", lang)} icon={<X className="h-3.5 w-3.5" />} />
              <Decide decision="sent_back" label={t("hra_send_back", lang)} icon={<RotateCcw className="h-3.5 w-3.5" />} />
            </div>
          </form>
        </Card>
      ))}

      {state.error && <p className="text-sm text-red-700">{state.error}</p>}
      {state.notice && <p className="text-sm text-emerald-700">{state.notice}</p>}
    </div>
  );
}
