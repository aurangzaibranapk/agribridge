"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Lock, X } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";
import { approveState, INLINE_DECISIONS } from "@/lib/pending/categories";
import { decidePending } from "./actions";

/**
 * Approve / Reject / Kholein. Apni entry par Approve aur Reject band
 * (title: "Apni entry — koi doosra approve karega"). Jin ka faisla yahan
 * nahi ho sakta wo sirf apne safhe par khulte hain.
 */
export function DecideButtons({ category, id, isOwn, href }: { category: string; id: string; isOwn: boolean; href: string }) {
  const lang = useLang();
  const [rejecting, setRejecting] = useState(false);
  const state = approveState({ category, is_own: isOwn });
  const rule = INLINE_DECISIONS[category];
  const ownTip = t("apb_own_tip", lang);
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-1.5 md:flex-nowrap">
        {state === "enabled" && (
          <>
            <form action={decidePending} onSubmit={(e) => { if (!window.confirm(t("apb_confirm_approve", lang))) e.preventDefault(); }}>
              <input type="hidden" name="category" value={category} />
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="decision" value="approve" />
              <button type="submit" data-approve="enabled" className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-b from-emerald-500 to-emerald-600 px-2.5 py-1.5 text-[11.5px] font-bold text-white">
                <Check className="h-3 w-3" />
                {t("apb_approve", lang)}
              </button>
            </form>
            {rule?.reject && (
              <button type="button" onClick={() => setRejecting((v) => !v)} className="inline-flex items-center gap-1 rounded-lg border border-surface-200 bg-white px-2.5 py-1.5 text-[11.5px] font-bold text-red-600 dark:border-white/10 dark:bg-white/5 dark:text-rose-400">
                <X className="h-3 w-3" />
                {t("apb_reject", lang)}
              </button>
            )}
          </>
        )}
        {state === "own" && (
          <>
            <button type="button" disabled aria-disabled title={ownTip} data-approve="own" className="inline-flex cursor-not-allowed items-center gap-1 rounded-lg border border-dashed border-surface-300 bg-surface-100 px-2.5 py-1.5 text-[11.5px] font-bold text-surface-400 opacity-60 dark:border-white/15 dark:bg-white/5">
              <Lock className="h-3 w-3" />
              {t("apb_approve", lang)}
            </button>
            <button type="button" disabled aria-disabled title={ownTip} className="inline-flex cursor-not-allowed items-center rounded-lg border border-dashed border-surface-300 bg-surface-100 px-2.5 py-1.5 text-[11.5px] font-bold text-surface-400 opacity-60 dark:border-white/15 dark:bg-white/5">
              {t("apb_reject", lang)}
            </button>
          </>
        )}
        <Link href={href} className="inline-flex items-center gap-1 rounded-lg border border-surface-200 bg-white px-2.5 py-1.5 text-[11.5px] font-bold text-surface-800 dark:border-white/10 dark:bg-white/5 dark:text-surface-100">
          {t("apb_open", lang)}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      {state === "own" && <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300">{ownTip}</span>}
      {rejecting && state === "enabled" && (
        <form action={decidePending} className="flex gap-1.5">
          <input type="hidden" name="category" value={category} />
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="decision" value="reject" />
          <input name="note" required={!!rule?.rejectNeedsReason} minLength={rule?.rejectNeedsReason ? 5 : 0} placeholder={t("apb_reason", lang)} className="w-48 rounded-lg border border-surface-200 bg-white px-2 py-1 text-xs dark:border-white/10 dark:bg-white/5" />
          <button type="submit" className="rounded-lg bg-red-600 px-2.5 py-1 text-[11.5px] font-bold text-white">{t("apb_reject", lang)}</button>
        </form>
      )}
    </div>
  );
}
