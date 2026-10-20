"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";
import { usePending } from "@/components/pending/pending-context";
import { NayaPill, RedBadge } from "@/components/pending/pending-ui";
import { fmtRs, totals, type PendingCount, type PendingItem } from "@/lib/pending/categories";
import {
  applyDeltas,
  DECISION_FADE_MS,
  DECISION_HIDE_MS,
  deltaForItem,
  groupLeft,
  pendingKey,
  type CountDelta,
  type Decision,
} from "@/lib/pending/decide";
import { cn } from "@/lib/utils/format";

/**
 * Faisle ke baad safha yahin badalta hai -- naya load nahi.
 * Ginti foran ghat-ti hai; qataar thodi der hara/surkh rehti hai, phir hat jaati hai.
 */
export type RowStatus = "approved" | "rejected";
export type RowPhase = "shown" | "fading" | "gone";

export interface DecisionHit {
  key: string;
  status: RowStatus;
  phase: RowPhase;
  group: string;
  isNew: boolean;
  delta: CountDelta;
}

interface Toast {
  kind: "approved" | "rejected" | "error";
  text: string;
}

interface Ctx {
  hits: DecisionHit[];
  hit: (key: string) => DecisionHit | undefined;
  mark: (item: PendingItem, status: RowStatus) => void;
  notifyError: (text: string) => void;
}

const LiveCtx = createContext<Ctx | null>(null);

export function PendingLive({ counts, children }: { counts: PendingCount[]; children: React.ReactNode }) {
  const [hits, setHits] = useState<DecisionHit[]>([]);
  const [toast, setToast] = useState<Toast | null>(null);
  const countsRef = useRef(counts);
  countsRef.current = counts;
  const timers = useRef<number[]>([]);
  const badge = usePending();

  useEffect(() => {
    const ids = timers.current;
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), toast.kind === "error" ? 8000 : 5200);
    return () => window.clearTimeout(id);
  }, [toast]);

  const hit = useCallback((key: string) => hits.find((h) => h.key === key), [hits]);

  const mark = useCallback((item: PendingItem, status: RowStatus) => {
    const key = pendingKey(item.category, item.item_id);
    setHits((prev) => {
      if (prev.some((h) => h.key === key)) return prev;
      return [...prev, { key, status, phase: "shown", group: item.group_key, isNew: item.is_new, delta: deltaForItem(countsRef.current, item) }];
    });
    setToast({ kind: status, text: "" });
    void badge.refresh();
    timers.current.push(
      window.setTimeout(() => {
        setHits((prev) => prev.map((h) => (h.key === key ? { ...h, phase: "fading" } : h)));
      }, DECISION_FADE_MS)
    );
    timers.current.push(
      window.setTimeout(() => {
        setHits((prev) => prev.map((h) => (h.key === key ? { ...h, phase: "gone" } : h)));
      }, DECISION_HIDE_MS)
    );
  }, [badge]);

  const notifyError = useCallback((text: string) => setToast({ kind: "error", text }), []);

  const value = useMemo(() => ({ hits, hit, mark, notifyError }), [hits, hit, mark, notifyError]);

  return (
    <LiveCtx.Provider value={value}>
      {children}
      {toast && <DecisionToast toast={toast} onClose={() => setToast(null)} />}
    </LiveCtx.Provider>
  );
}

export function usePendingLive(): Ctx {
  const ctx = useContext(LiveCtx);
  if (!ctx) throw new Error("PendingLive missing");
  return ctx;
}

function DecisionToast({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const lang = useLang();
  const ok = toast.kind === "approved";
  const bad = toast.kind === "error";
  const text = bad ? toast.text : t(ok ? "apb_toast_approved" : "apb_toast_rejected", lang);
  return (
    <div
      role="status"
      aria-live="polite"
      data-decision-toast={toast.kind}
      className={cn(
        "fixed bottom-24 left-1/2 z-[80] flex w-[min(24rem,calc(100vw-2.5rem))] -translate-x-1/2 items-start gap-3 rounded-2xl border bg-white/95 p-3.5 shadow-2xl backdrop-blur dark:bg-[#111b3d]/95",
        ok && "border-emerald-200 dark:border-emerald-400/30",
        toast.kind === "rejected" && "border-red-200 dark:border-red-400/30",
        bad && "border-red-300 dark:border-red-400/40"
      )}
    >
      {bad || toast.kind === "rejected" ? (
        <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-rose-400" />
      ) : (
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
      )}
      <p className={cn("text-sm font-extrabold", bad || toast.kind === "rejected" ? "text-red-700 dark:text-rose-300" : "text-emerald-800 dark:text-emerald-200")}>{text}</p>
      <button type="button" onClick={onClose} className="ml-auto text-xs font-bold text-surface-400" aria-label={t("apb_cancel", lang)}>
        ×
      </button>
    </div>
  );
}

export type PendingTotals = ReturnType<typeof totals>;

export function useLiveNumbers(base: PendingTotals): PendingTotals {
  const { hits } = usePendingLive();
  return applyDeltas(base, hits.map((h) => h.delta));
}

export function PendingFilterPills({ filter, base }: { filter: "all" | "mine" | "new"; base: PendingTotals }) {
  const lang = useLang();
  const live = useLiveNumbers(base);
  return (
    <div className="flex gap-1.5" role="tablist">
      {(["all", "mine", "new"] as const).map((k) => (
        <Link
          key={k}
          href={k === "all" ? "?" : `?f=${k}`}
          aria-selected={filter === k}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
            filter === k ? "bg-gradient-to-r from-[#1e3a8a] to-[#2563eb] text-white" : "border border-surface-200 bg-white text-surface-600 dark:border-white/10 dark:bg-white/5 dark:text-surface-300"
          )}
        >
          {t(k === "all" ? "apb_filter_all" : k === "mine" ? "apb_filter_mine" : "apb_filter_new", lang)}
          <span className="opacity-80">· {k === "all" ? live.pending : k === "mine" ? live.mine : live.naya}</span>
        </Link>
      ))}
    </div>
  );
}

export function PendingKpis({ base }: { base: PendingTotals }) {
  const lang = useLang();
  const live = useLiveNumbers(base);
  return (
    <div data-pending-kpis className="grid grid-cols-2 gap-3 md:grid-cols-5">
      <Kpi label={t("apb_kul_baqi", lang)} value={String(live.pending)} tone="red" />
      <Kpi label={t("apb_kpi_new", lang)} value={String(live.naya)} tone="green" />
      <Kpi label={t("apb_kpi_old", lang)} value={String(live.oldTypes)} tone="amber" />
      <Kpi label={t("apb_kpi_mine", lang)} value={String(live.mine)} tone="blue" />
      <Kpi label={t("apb_kpi_amount", lang)} value={fmtRs(live.amount)} tone="plain" />
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: "red" | "green" | "amber" | "blue" | "plain" }) {
  return (
    <div className="rounded-2xl border border-surface-200 bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-[#0f1b3d]">
      <p className="text-[10.5px] font-bold uppercase tracking-wider text-surface-400">{label}</p>
      <p
        className={cn(
          "mt-1 font-display text-2xl font-extrabold tabular-nums",
          tone === "red" && "text-red-600 dark:text-rose-400",
          tone === "green" && "text-emerald-600 dark:text-emerald-400",
          tone === "amber" && "text-amber-600 dark:text-amber-300",
          tone === "blue" && "text-blue-700 dark:text-blue-300",
          tone === "plain" && "text-surface-900 dark:text-white"
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function LiveGroupMarks({ group, pending, naya }: { group: string; pending: number; naya: number }) {
  const lang = useLang();
  const { hits } = usePendingLive();
  const left = groupLeft(pending, naya, hits.filter((h) => h.group === group));
  return (
    <span className="flex items-center gap-1.5">
      <NayaPill n={left.naya} lang={lang} />
      <RedBadge n={left.pending} />
    </span>
  );
}

export function PendingGroupFrame({
  group,
  pending,
  keys,
  children,
}: {
  group: string;
  pending: number;
  keys: string[];
  children: React.ReactNode;
}) {
  const { hits } = usePendingLive();
  const gone = new Set(hits.filter((h) => h.phase === "gone" && h.group === group).map((h) => h.key));
  const anyVisible = keys.some((k) => !gone.has(k));
  const left = pending - hits.filter((h) => h.group === group).length;
  if (!anyVisible && left <= 0) return null;
  return <>{children}</>;
}

export function statusOf(decision: Decision): RowStatus {
  return decision === "approve" ? "approved" : "rejected";
}
