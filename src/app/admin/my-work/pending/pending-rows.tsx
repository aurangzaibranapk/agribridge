"use client";
import { Check, UserRound, X } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";
import { ageDays, catLabelKey, fmtRs, roleLabelKey, type PendingItem } from "@/lib/pending/categories";
import { AgeChip, NayaPill } from "@/components/pending/pending-ui";
import { pendingKey, type DecideResult } from "@/lib/pending/decide";
import { cn } from "@/lib/utils/format";
import { DecideButtons } from "./decide-buttons";
import { usePendingLive } from "./live-state";
import { ProductPendingSummary } from "@/components/pending/product-diff-ui";

type Run = (fd: FormData) => Promise<DecideResult | undefined>;

function rowTone(status: "approved" | "rejected" | undefined, fading: boolean, isNew: boolean) {
  return cn(
    "transition-opacity duration-700",
    fading && "opacity-0",
    status === "approved" && "bg-emerald-500/15",
    status === "rejected" && "bg-red-500/10",
    !status && (isNew ? "bg-emerald-500/[0.05]" : "bg-red-500/[0.03]")
  );
}

function StateCell({ status, isNew }: { status?: "approved" | "rejected"; isNew: boolean }) {
  const lang = useLang();
  if (status === "approved") return <span className="text-[10.5px] font-extrabold tracking-wide text-emerald-700 dark:text-emerald-300">● {t("apb_state_approved", lang)}</span>;
  if (status === "rejected") return <span className="text-[10.5px] font-extrabold tracking-wide text-red-600 dark:text-rose-300">● {t("apb_state_rejected", lang)}</span>;
  if (isNew) return <NayaPill lang={lang} />;
  return <span className="text-[10.5px] font-extrabold tracking-wide text-red-600 dark:text-rose-400">● {t("apb_pending_short", lang)}</span>;
}

function DecisionBadge({ status }: { status: "approved" | "rejected" }) {
  const lang = useLang();
  const ok = status === "approved";
  return (
    <span
      role="status"
      data-decision-badge={status}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11.5px] font-bold text-white",
        ok ? "bg-gradient-to-b from-emerald-500 to-emerald-600" : "bg-red-600"
      )}
    >
      {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      {t(ok ? "apb_state_approved" : "apb_state_rejected", lang)}
    </span>
  );
}

export function PendingTableRow({ item, run }: { item: PendingItem; run?: Run }) {
  const lang = useLang();
  const { hit } = usePendingLive();
  const h = hit(pendingKey(item.category, item.item_id));
  if (h?.phase === "gone") return null;
  const href = item.link || item.route;
  return (
    <tr data-pending-row={h?.status ?? (item.is_new ? "new" : "pending")} data-pending-decision={h?.status ?? "open"} className={rowTone(h?.status, h?.phase === "fading", item.is_new)}>
      <td className="px-4 py-2.5 align-top">
        <StateCell status={h?.status} isNew={item.is_new} />
      </td>
      <td className="px-2 py-2.5 align-top">
        {item.product_extra ? <ProductPendingSummary extra={item.product_extra} lang={lang} /> : <>
        <p className="truncate font-bold text-surface-900 dark:text-white">
          {t(catLabelKey(item.category), lang)} {item.ref && <span className="font-mono text-[11px] text-surface-400">{item.ref}</span>}
        </p>
        {item.title && <p className="truncate text-[11.5px] text-surface-500 dark:text-surface-400">{item.title}</p>}
        </>}
      </td>
      <td className="px-2 py-2.5 text-right align-top font-semibold tabular-nums text-surface-800 dark:text-surface-100">{item.amount != null ? fmtRs(item.amount) : "—"}</td>
      <td className="px-2 py-2.5 align-top"><AgeChip days={ageDays(item.created_at)} lang={lang} /></td>
      <td className="truncate px-2 py-2.5 align-top text-surface-700 dark:text-surface-200">{item.is_own ? <b className="text-amber-700 dark:text-amber-300">{t("apb_you", lang)}</b> : item.entered_by_name ?? t("apb_noname", lang)}</td>
      <td className="px-2 py-2.5 align-top">
        <span className="inline-flex max-w-full items-center gap-1 truncate rounded-lg bg-surface-100 px-2 py-0.5 text-[11.5px] font-semibold text-surface-700 dark:bg-white/5 dark:text-surface-200">
          <UserRound className="h-3 w-3 shrink-0" />
          <span className="truncate">{item.actor_name ?? t(roleLabelKey(item.pending_with), lang)}</span>
        </span>
      </td>
      <td className="px-4 py-2.5 align-top">
        {h ? <div className="flex justify-end"><DecisionBadge status={h.status} /></div> : <DecideButtons item={item} href={href} run={run} />}
      </td>
    </tr>
  );
}

export function PendingCard({ item, run }: { item: PendingItem; run?: Run }) {
  const lang = useLang();
  const { hit } = usePendingLive();
  const h = hit(pendingKey(item.category, item.item_id));
  if (h?.phase === "gone") return null;
  const href = item.link || item.route;
  return (
    <li data-pending-card data-pending-decision={h?.status ?? "open"} className={cn("space-y-2 px-4 py-3", rowTone(h?.status, h?.phase === "fading", item.is_new))}>
      <div className="flex items-start justify-between gap-2">
        {item.product_extra ? <ProductPendingSummary extra={item.product_extra} lang={lang} /> : <div className="min-w-0">
          <p className="truncate text-[13px] font-bold text-surface-900 dark:text-white">{t(catLabelKey(item.category), lang)} {item.ref && <span className="font-mono text-[11px] text-surface-400">{item.ref}</span>}</p>
          {item.title && <p className="truncate text-[11.5px] text-surface-500 dark:text-surface-400">{item.title}</p>}
        </div>}
        <span className="shrink-0 text-[13px] font-bold tabular-nums text-surface-900 dark:text-white">{item.amount != null ? fmtRs(item.amount) : ""}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <StateCell status={h?.status} isNew={item.is_new} />
        <AgeChip days={ageDays(item.created_at)} lang={lang} />
        <span className="text-surface-500 dark:text-surface-400">{t("apb_entered", lang)}: {item.is_own ? t("apb_you", lang) : item.entered_by_name ?? t("apb_noname", lang)}</span>
        <span className="inline-flex items-center gap-1 font-semibold text-surface-700 dark:text-surface-200"><UserRound className="h-3 w-3" />{item.actor_name ?? t(roleLabelKey(item.pending_with), lang)}</span>
      </div>
      {h ? <div className="flex justify-end"><DecisionBadge status={h.status} /></div> : <DecideButtons item={item} href={href} run={run} />}
    </li>
  );
}
