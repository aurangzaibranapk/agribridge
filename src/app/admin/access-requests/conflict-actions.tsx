"use client";

import { useFormState, useFormStatus } from "react-dom";
import { RefreshCw, Eye, ShieldOff, RotateCcw } from "lucide-react";
import { scanConflicts, decideConflict, type AccessState } from "@/actions/access-requests";
import { Textarea, Label, Input } from "@/components/ui/form";
import { t, type Lang } from "@/lib/i18n/translations";

const initial: AccessState = {};

function Submit({ label, icon, name, value, tone = "gray", disabled }: { label: string; icon: React.ReactNode; name?: string; value?: string; tone?: "gray" | "orange" | "green"; disabled?: boolean }) {
  const { pending } = useFormStatus();
  const cls = tone === "orange" ? "bg-orange-600 text-white hover:bg-orange-700" : tone === "green" ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-surface-100 text-surface-800 hover:bg-surface-200 dark:bg-surface-800 dark:text-surface-200";
  return (
    <button type="submit" name={name} value={value} disabled={pending || disabled} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-60 ${cls}`}>
      {icon} {pending ? "…" : label}
    </button>
  );
}

/** "Scan chalayein" -- sirf report, kuch hatta nahi. */
export function ScanButton({ lang }: { lang: Lang }) {
  const [state, action] = useFormState(scanConflicts, initial);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <Submit label={t("cfl_scan", lang)} icon={<RefreshCw className="h-3.5 w-3.5" />} tone="green" />
      {state.error && <span className="text-xs text-red-700">{state.error}</span>}
      {state.success && <span className="text-xs text-emerald-800">{state.message}</span>}
    </form>
  );
}

/** Ek finding par faisla: dekh liya / override / wapas kholo. Ijazat yahan se nahi hatti. */
export function FindingActions({ lang, id, status, enforcement, isMaster }: { lang: Lang; id: string; status: string; enforcement: string; isMaster: boolean }) {
  const [state, action] = useFormState(decideConflict, initial);
  return (
    <form action={action} className="mt-2 space-y-2 rounded-lg border border-surface-200 p-2 dark:border-surface-700">
      <input type="hidden" name="id" value={id} />
      {state.error && <p className="rounded bg-red-50 px-2 py-1 text-xs text-red-700">{state.error}</p>}
      {state.success && <p className="rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-800">{state.message}</p>}
      <div>
        <Label>{t("cfl_note", lang)}</Label>
        <Textarea name="note" rows={2} />
      </div>
      {isMaster && enforcement !== "block" && status !== "overridden" && (
        <div>
          <Label>{t("cfl_override_expiry", lang)}</Label>
          <Input type="datetime-local" name="override_expires_at" />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {status !== "acknowledged" && status !== "overridden" && <Submit label={t("cfl_ack", lang)} icon={<Eye className="h-3.5 w-3.5" />} name="status" value="acknowledged" />}
        {isMaster && enforcement !== "block" && status !== "overridden" && <Submit label={t("cfl_override", lang)} icon={<ShieldOff className="h-3.5 w-3.5" />} name="status" value="overridden" tone="orange" />}
        {status !== "open" && <Submit label={t("cfl_reopen", lang)} icon={<RotateCcw className="h-3.5 w-3.5" />} name="status" value="open" />}
      </div>
      <p className="text-[11px] text-surface-500">{enforcement === "block" ? t("cfl_block_note", lang) : t("cfl_actions_note", lang)}</p>
    </form>
  );
}
