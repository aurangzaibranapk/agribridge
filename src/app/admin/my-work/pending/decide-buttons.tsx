"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Loader2, Lock, X } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";
import { approveState, INLINE_DECISIONS, type PendingItem } from "@/lib/pending/categories";
import { decideMessage, normalizeDecideResult, type DecideResult } from "@/lib/pending/decide";
import { decidePending } from "./actions";
import { statusOf, usePendingLive } from "./live-state";

/**
 * Approve / Reject / Kholein. Browser confirm nahi -- app ka modal.
 * Save hote hi qataar hara/surkh, ginti taaza. Nakami par asal wajah.
 * Apni entry par Approve aur Reject band rehte hain.
 */
export function DecideButtons({
  item,
  href,
  run,
  approveLabel,
  hideOpen = false,
}: {
  item: PendingItem;
  href: string;
  /** Detail safhe par "Approve — naam badal do" jaisa label. */
  approveLabel?: string;
  hideOpen?: boolean;
  /** Preview / test. Asal safha is ko nahi bhejta -- decidePending chalti hai. */
  run?: (fd: FormData) => Promise<DecideResult | undefined>;
}) {
  const lang = useLang();
  const live = usePendingLive();
  const { category, item_id: id, is_own: isOwn, code_own: codeOwn = false } = item;
  const state = approveState({ category, is_own: isOwn, code_own: codeOwn });
  const rule = INLINE_DECISIONS[category];
  const ownTip = t(state === "code" ? "apb_code_tip" : "apb_own_tip", lang);
  const locked = state === "own" || state === "code";
  const [ask, setAsk] = useState<null | "approve" | "reject">(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    if (!ask) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busyRef.current) setAsk(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ask]);

  function open(decision: "approve" | "reject") {
    if (busyRef.current) return;
    setError(null);
    setNote("");
    setAsk(decision);
  }

  async function commit() {
    if (!ask || busyRef.current) return;
    if (ask === "reject" && rule?.rejectNeedsReason && note.trim().length < 5) {
      setError(t("apb_e_reason", lang));
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set("category", category);
    fd.set("id", id);
    fd.set("decision", ask);
    if (note.trim()) fd.set("note", note.trim());
    let res: DecideResult;
    try {
      res = normalizeDecideResult(await (run ?? decidePending)(fd));
    } catch (err) {
      const raw = err instanceof Error ? err.message : "";
      res = { ok: false, code: "action", error: raw && !/NEXT_REDIRECT/.test(raw) ? raw : t("apb_e_server", lang) };
    }
    busyRef.current = false;
    setBusy(false);
    if (!res.ok) {
      const msg = decideMessage(res, lang);
      setError(msg);
      live.notifyError(msg);
      return;
    }
    setAsk(null);
    live.mark(item, statusOf(res.decision));
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-1.5 md:flex-nowrap">
        {state === "enabled" && (
          <>
            <button
              type="button"
              data-approve={item.block_approve ? "blocked" : "enabled"}
              disabled={busy || !!item.block_approve}
              onClick={() => open("approve")}
              className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-b from-emerald-500 to-emerald-600 px-2.5 py-1.5 text-[11.5px] font-bold text-white disabled:cursor-wait disabled:opacity-60"
            >
              {busy && ask === "approve" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              {busy && ask === "approve" ? t("apb_saving", lang) : approveLabel ?? t("apb_approve", lang)}
            </button>
            {rule?.reject && (
              <button
                type="button"
                data-reject="enabled"
                disabled={busy}
                onClick={() => open("reject")}
                className="inline-flex items-center gap-1 rounded-lg border border-surface-200 bg-white px-2.5 py-1.5 text-[11.5px] font-bold text-red-600 disabled:cursor-wait disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-rose-400"
              >
                {busy && ask === "reject" ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                {busy && ask === "reject" ? t("apb_saving", lang) : t("apb_reject", lang)}
              </button>
            )}
          </>
        )}
        {locked && (
          <>
            <button type="button" disabled aria-disabled title={ownTip} data-approve={state} className="inline-flex cursor-not-allowed items-center gap-1 rounded-lg border border-dashed border-surface-300 bg-surface-100 px-2.5 py-1.5 text-[11.5px] font-bold text-surface-400 opacity-60 dark:border-white/15 dark:bg-white/5">
              <Lock className="h-3 w-3" />
              {t("apb_approve", lang)}
            </button>
            <button type="button" disabled aria-disabled title={ownTip} className="inline-flex cursor-not-allowed items-center rounded-lg border border-dashed border-surface-300 bg-surface-100 px-2.5 py-1.5 text-[11.5px] font-bold text-surface-400 opacity-60 dark:border-white/15 dark:bg-white/5">
              {t("apb_reject", lang)}
            </button>
          </>
        )}
        {!hideOpen && <Link href={href} className="inline-flex items-center gap-1 rounded-lg border border-surface-200 bg-white px-2.5 py-1.5 text-[11.5px] font-bold text-surface-800 dark:border-white/10 dark:bg-white/5 dark:text-surface-100">
          {t("apb_open", lang)}
          <ArrowRight className="h-3 w-3" />
        </Link>}
      </div>
      {locked && <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300">{ownTip}</span>}
      {ask && state === "enabled" && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/45 p-4" role="presentation" onClick={() => { if (!busy) setAsk(null); }}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pending-decide-title"
            data-confirm-modal={ask}
            className="w-full max-w-md rounded-2xl border border-surface-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-[#0f1b3d]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="pending-decide-title" className="font-display text-lg font-extrabold text-surface-900 dark:text-white">
              {t(ask === "approve" ? "apb_ask_approve" : "apb_ask_reject", lang)}
            </h2>
            <p className="mt-1.5 text-sm text-surface-500 dark:text-surface-400">{t("apb_rules", lang)}</p>
            {ask === "reject" && (
              <input
                name="note"
                value={note}
                autoFocus
                disabled={busy}
                minLength={rule?.rejectNeedsReason ? 5 : 0}
                maxLength={300}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("apb_reason", lang)}
                className="mt-3 w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
              />
            )}
            {error && (
              <p role="alert" data-confirm-error className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-700 dark:text-rose-300">
                {error}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" disabled={busy} onClick={() => setAsk(null)} className="rounded-lg border border-surface-200 px-3 py-2 text-sm font-bold text-surface-700 disabled:opacity-50 dark:border-white/10 dark:text-surface-200">
                {t("apb_cancel", lang)}
              </button>
              <button
                type="button"
                data-confirm-ok={ask}
                autoFocus={ask === "approve"}
                disabled={busy}
                onClick={() => void commit()}
                className={
                  ask === "approve"
                    ? "inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-emerald-500 to-emerald-600 px-3 py-2 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60"
                    : "inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60"
                }
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {busy ? t("apb_saving", lang) : t(ask === "approve" ? "apb_approve" : "apb_reject", lang)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
