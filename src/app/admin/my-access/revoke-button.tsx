"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { requestAccessRevoke, type AccessState } from "@/actions/access-requests";
import { t, type Lang } from "@/lib/i18n/translations";

const initial: AccessState = {};

function SendBtn({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60">
      {pending ? "…" : label}
    </button>
  );
}

/** Maujooda access khatam karwane ki darkhwast (270/385, 10 September). */
export function RevokeButton({ featureKey, lang }: { featureKey: string; lang: Lang }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useFormState(requestAccessRevoke, initial);

  if (state.success) return <span className="text-xs text-emerald-700">{state.message}</span>;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-red-600 underline">
        {t("ma_revoke", lang)}
      </button>
    );
  }

  return (
    <form action={action} className="mt-1 flex flex-wrap items-center gap-1.5">
      <input type="hidden" name="feature_key" value={featureKey} />
      <input
        type="text"
        name="reason"
        placeholder={t("ma_revoke_reason", lang)}
        className="rounded border border-surface-300 px-1.5 py-1 text-xs dark:border-surface-700 dark:bg-surface-900"
      />
      <SendBtn label={t("ma_revoke_send", lang)} />
      <button type="button" onClick={() => setOpen(false)} className="text-xs text-surface-500 underline">
        {t("ma_revoke_cancel", lang)}
      </button>
      {state.error && <span className="w-full text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
