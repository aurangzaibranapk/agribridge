"use client";
import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

export function PendingSubmit({
  label,
  className,
  locked = false,
}: {
  label: string;
  className: string;
  locked?: boolean;
}) {
  const { pending } = useFormStatus();
  const lang = useLang();
  const busy = pending || locked;
  return (
    <button type="submit" disabled={busy} aria-busy={pending} className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}>
      {pending ? t("ja_action_working", lang) : label}
    </button>
  );
}

export function ActionFeedback({ success, error, notice }: { success?: boolean; error?: string; notice?: string }) {
  const lang = useLang();
  const [toast, setToast] = useState(false);
  useEffect(() => {
    if (!success) return;
    setToast(true);
    const id = window.setTimeout(() => setToast(false), 2800);
    return () => window.clearTimeout(id);
  }, [success]);
  return (
    <>
      {toast && (
        <p role="status" data-testid="application-action-toast" className="mb-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
          {t("ja_action_saved", lang)}
        </p>
      )}
      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
      {notice && <p role="status" className="mb-2 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-800">{notice}</p>}
    </>
  );
}
