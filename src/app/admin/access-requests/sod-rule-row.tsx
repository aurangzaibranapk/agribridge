"use client";

import { useFormState, useFormStatus } from "react-dom";
import { saveSodRule, type AccessState } from "@/actions/access-requests";
import { t, type Lang } from "@/lib/i18n/translations";

const initial: AccessState = {};

function Btn({ label, tone }: { label: string; tone: "red" | "amber" | "gray" }) {
  const { pending } = useFormStatus();
  const cls = tone === "red" ? "bg-red-600 text-white hover:bg-red-700" : tone === "amber" ? "bg-amber-500 text-white hover:bg-amber-600" : "bg-surface-100 text-surface-800 hover:bg-surface-200 dark:bg-surface-800 dark:text-surface-200";
  return (
    <button type="submit" disabled={pending} className={`rounded-lg px-2.5 py-1 text-[11px] font-medium disabled:opacity-60 ${cls}`}>
      {pending ? "…" : label}
    </button>
  );
}

/** Ek transaction rule: block <-> warn, on/off. Sirf Owner/Admin ko dikhta hai. */
export function SodRuleControls({ lang, rule }: { lang: Lang; rule: { id: string; enforcement: string; is_active: boolean } }) {
  const [state, action] = useFormState(saveSodRule, initial);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <form action={action}>
        <input type="hidden" name="id" value={rule.id} />
        <input type="hidden" name="enforcement" value={rule.enforcement === "block" ? "warn" : "block"} />
        <Btn label={rule.enforcement === "block" ? t("sod_make_warn", lang) : t("sod_make_block", lang)} tone={rule.enforcement === "block" ? "amber" : "red"} />
      </form>
      <form action={action}>
        <input type="hidden" name="id" value={rule.id} />
        <input type="hidden" name="is_active" value={rule.is_active ? "0" : "1"} />
        <Btn label={rule.is_active ? t("sod_off", lang) : t("sod_on", lang)} tone="gray" />
      </form>
      {state.error && <span className="text-[11px] text-red-700">{state.error}</span>}
    </div>
  );
}
