"use client";
import { useEffect } from "react";
import { Bell, X } from "lucide-react";
import { MarkReadLink } from "@/components/notifications/mark-read";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";
import { catLabelKey, fmtRs, roleLabelKey, type PendingItem } from "@/lib/pending/categories";

/** Naya kaam aate hi ~6 second, bina awaaz, sirf screen par. */
export function PendingToast({ toast, onClose }: { toast: { item: PendingItem | null; category: string; n: number }; onClose: () => void }) {
  const lang = useLang();
  useEffect(() => {
    const id = setTimeout(onClose, 6500);
    return () => clearTimeout(id);
  }, [onClose, toast]);
  const it = toast.item;
  const href = it?.link || it?.route || "/admin/my-work/pending";
  return (
    <div
      role="status"
      aria-live="polite"
      data-pending-toast
      className="fixed bottom-5 left-5 z-[70] flex w-[min(26rem,calc(100vw-2.5rem))] gap-3 rounded-2xl border border-surface-200 border-l-4 border-l-emerald-500 bg-white/95 p-3.5 shadow-2xl backdrop-blur dark:border-white/10 dark:border-l-emerald-500 dark:bg-[#111b3d]/95"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
        <Bell className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold text-surface-900 dark:text-white">
          {t("apb_toast_title", lang)} · {t(catLabelKey(toast.category), lang)}
          {toast.n > 1 ? ` (${toast.n})` : ""}
        </p>
        {it && (
          <p className="mt-0.5 text-xs text-surface-500 dark:text-surface-400">
            {[it.amount != null ? fmtRs(it.amount) : null, it.ref, `${t("apb_entered", lang)}: ${it.entered_by_name ?? t("apb_noname", lang)}`, `${t("apb_with", lang)}: ${it.actor_name ?? t(roleLabelKey(it.pending_with), lang)}`]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
        <div className="mt-2 flex gap-1.5">
          <MarkReadLink href={href} onDone={onClose} className="rounded-lg bg-gradient-to-b from-emerald-500 to-emerald-600 px-2.5 py-1 text-xs font-bold text-white">
            {t("apb_open", lang)}
          </MarkReadLink>
          <button type="button" onClick={onClose} className="rounded-lg border border-surface-200 px-2.5 py-1 text-xs font-bold text-surface-700 dark:border-white/10 dark:text-surface-200">
            {t("apb_later", lang)}
          </button>
        </div>
      </div>
      <button type="button" onClick={onClose} aria-label={t("apb_later", lang)} className="self-start rounded p-0.5 text-surface-400 hover:text-surface-600">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
