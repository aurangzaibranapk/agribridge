"use client";
import Link from "next/link";
import { UserRound } from "lucide-react";
import { cn } from "@/lib/utils/format";
import { t, type Lang } from "@/lib/i18n/translations";
import { ageDays, catLabelKey, fmtRs, groupLabelKey, roleLabelKey, type PendingItem } from "@/lib/pending/categories";
import { AgeChip, NayaPill } from "@/components/pending/pending-ui";
import { PENDING_PAGE } from "@/components/pending/pending-context";

/** Ghanti ke andar ki fehrist (mock_badge_bell_*). Sirf dikhana -- faisla apne safhe par. */
export function PendingBellList({ items, mode, lang, onNavigate }: { items: PendingItem[] | null; mode: "new" | "pending"; lang: Lang; onNavigate: () => void }) {
  if (items === null) return <p className="px-4 py-6 text-center text-xs text-surface-400">{t("nbell_loading", lang)}</p>;
  const list = (mode === "new" ? items.filter((i) => i.is_new) : items)
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 8);
  if (!list.length)
    return <p className="px-4 py-6 text-center text-xs text-surface-400">{t(mode === "new" ? "apb_none_new" : "apb_none", lang)}</p>;
  return (
    <div className="divide-y divide-surface-100 dark:divide-white/5">
      {list.map((i) => {
        const days = ageDays(i.created_at);
        return (
          <Link
            key={`${i.category}:${i.item_id}`}
            href={i.link || i.route}
            onClick={onNavigate}
            data-bell-item={i.is_new ? "new" : "pending"}
            className={cn("flex gap-3 px-4 py-3 hover:bg-surface-50 dark:hover:bg-white/5", i.is_new && "bg-emerald-500/[0.07]")}
          >
            <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", i.is_new ? "bg-emerald-500" : "bg-red-500")} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-bold text-surface-900 dark:text-white">
                {t(catLabelKey(i.category), lang)}
                {i.ref ? ` ${i.ref}` : ""}
                {i.amount != null ? ` · ${fmtRs(i.amount)}` : ""}
              </span>
              <span className="mt-0.5 block truncate text-[11.5px] text-surface-500 dark:text-surface-400">
                {i.title ? `${i.title} · ` : ""}
                {t("apb_entered", lang)}: {i.is_own ? t("apb_you", lang) : i.entered_by_name ?? t("apb_noname", lang)}
              </span>
              <span className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
                {i.is_new ? <NayaPill lang={lang} /> : <span className="font-bold text-red-600 dark:text-rose-400">● {t("apb_pending", lang)}</span>}
                <AgeChip days={days} lang={lang} />
                <span className="inline-flex items-center gap-1 font-semibold text-surface-700 dark:text-surface-200">
                  <UserRound className="h-3 w-3" />
                  {i.actor_name ?? t(roleLabelKey(i.pending_with), lang)}
                </span>
                <span className="rounded-md bg-surface-100 px-1.5 py-0.5 text-[10px] font-bold text-surface-500 dark:bg-white/5 dark:text-surface-400">
                  {t(groupLabelKey(i.group_key), lang)}
                </span>
              </span>
            </span>
          </Link>
        );
      })}
      <Link href={PENDING_PAGE} onClick={onNavigate} className="flex justify-between px-4 py-2.5 text-xs font-bold">
        <span className="font-medium text-surface-400">{t("apb_refresh", lang)}</span>
        <span className="text-blue-600 dark:text-blue-400">{t("apb_see_all", lang)} →</span>
      </Link>
    </div>
  );
}
