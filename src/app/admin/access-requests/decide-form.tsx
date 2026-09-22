"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Check, X, ShieldAlert, Pencil } from "lucide-react";
import { decideAccess, type AccessState } from "@/actions/access-requests";
import { Card } from "@/components/ui/layout-primitives";
import { Textarea, Label, Input, Select } from "@/components/ui/form";
import { t, type Lang } from "@/lib/i18n/translations";
import { ACTIONS, DATA_SCOPES } from "@/lib/access/types";

const initial: AccessState = {};

function Btn({ label, tone, decision, disabled, changing }: { label: string; tone: "green" | "red" | "amber"; decision: string; disabled?: boolean; changing?: boolean }) {
  const { pending } = useFormStatus();
  const cls = tone === "green" ? "bg-emerald-600 hover:bg-emerald-700" : tone === "amber" ? "bg-amber-600 hover:bg-amber-700" : "bg-red-600 hover:bg-red-700";
  return (
    <button type="submit" name="decision" value={decision} disabled={pending || disabled} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-60 ${cls}`}>
      {changing ? <Pencil className="h-4 w-4" /> : tone === "green" ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />} {pending ? "…" : label}
    </button>
  );
}

export interface ConflictGate {
  /** none = koi takraao nahi; advise = batao; override = wajah lazmi (Owner/Admin); block = koi nahi */
  level: "none" | "advise" | "override" | "block";
  messages: string[];
}

/**
 * Manzoori ka form (270) + takraao ki jaanch (271):
 *  - advise: warning dikhti hai, manzoori chalti hai (likhi jati hai)
 *  - override: sirf Owner/Admin, wajah + miyaad ke sath
 *  - block: Approve band
 */
export function DecideForm({
  lang,
  id,
  isHead,
  isMaster,
  gate,
  kind,
  requestedActions,
  requestedScope,
}: {
  lang: Lang;
  id: string;
  isHead: boolean;
  isMaster: boolean;
  gate: ConflictGate;
  kind: string;
  requestedActions: string[];
  requestedScope: string;
}) {
  const [state, action] = useFormState(decideAccess, initial);
  const [changing, setChanging] = useState(false);
  const approveDisabled = gate.level === "block" || (gate.level === "override" && !isMaster);
  const canChange = kind === "feature_access";
  return (
    <Card>
      <h3 className="mb-1 text-sm font-semibold">{t("ar_decide", lang)}</h3>
      <p className="mb-2 text-xs text-surface-500">{isHead ? t("ar_head_note", lang) : t("ar_master_note", lang)}</p>
      {gate.level !== "none" && (
        <div className={`mb-3 rounded-lg border px-3 py-2 text-sm ${gate.level === "block" ? "border-red-300 bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-200" : gate.level === "override" ? "border-orange-300 bg-orange-50 text-orange-900 dark:bg-orange-950/30 dark:text-orange-200" : "border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"}`}>
          <p className="flex items-center gap-1.5 font-semibold">
            <ShieldAlert className="h-4 w-4" /> {t("cfl_gate_title", lang)}
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-xs">
            {gate.messages.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
          <p className="mt-1.5 text-xs">
            {gate.level === "block" ? t("cfl_gate_block", lang) : gate.level === "override" ? (isMaster ? t("cfl_gate_override", lang) : t("cfl_gate_override_head", lang)) : t("cfl_gate_advise", lang)}
          </p>
        </div>
      )}
      {state.error && <p className="mb-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state.success && <p className="mb-2 rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{state.message}</p>}
      <form action={action} className="space-y-2">
        <input type="hidden" name="id" value={id} />
        <div>
          <Label>{t("ar_note", lang)}</Label>
          <Textarea name="note" rows={2} />
        </div>
        {gate.level === "override" && isMaster && (
          <div className="grid gap-2 rounded-lg border border-orange-200 p-2 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>{t("cfl_override_reason", lang)} *</Label>
              <Textarea name="override_reason" rows={2} required minLength={5} />
            </div>
            <div>
              <Label>{t("cfl_override_expiry", lang)}</Label>
              <Input type="datetime-local" name="override_expires_at" />
            </div>
            <p className="self-end text-[11px] text-surface-500">{t("cfl_override_note", lang)}</p>
          </div>
        )}
        {canChange && (
          <div>
            {!changing ? (
              <button type="button" onClick={() => setChanging(true)} className="text-xs text-amber-700 underline">
                {t("ar_change_toggle", lang)}
              </button>
            ) : (
              <div className="rounded-lg border border-amber-200 p-2 dark:border-amber-900/50">
                <input type="hidden" name="change" value="1" />
                <Label>{t("ar_change_actions", lang)}</Label>
                <div className="flex flex-wrap gap-2 py-1">
                  {ACTIONS.map((a) => (
                    <label key={a} className="flex items-center gap-1 text-xs">
                      <input type="checkbox" name="changed_actions" value={a} defaultChecked={requestedActions.includes(a)} />
                      {a}
                    </label>
                  ))}
                </div>
                <Label>{t("ar_change_scope", lang)}</Label>
                <Select name="changed_scope" defaultValue={requestedScope} className="w-full">
                  {DATA_SCOPES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
                <button type="button" onClick={() => setChanging(false)} className="mt-1 text-[11px] text-surface-500 underline">
                  {t("ar_change_cancel", lang)}
                </button>
              </div>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {changing ? (
            <Btn label={t("ar_change_approve", lang)} tone="amber" decision="approved" disabled={approveDisabled} changing />
          ) : (
            <Btn label={t("ar_approve", lang)} tone="green" decision="approved" disabled={approveDisabled} />
          )}
          <Btn label={t("ar_reject", lang)} tone="red" decision="rejected" />
        </div>
      </form>
    </Card>
  );
}
