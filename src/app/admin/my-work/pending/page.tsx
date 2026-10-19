import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, AlertTriangle, CheckCircle2, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { loadNav, routeAllowed } from "@/lib/access/nav";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { cn } from "@/lib/utils/format";
import {
  ageDays,
  catLabelKey,
  fmtRs,
  groupItems,
  groupLabelKey,
  roleLabelKey,
  totals as calcTotals,
  type PendingCount,
  type PendingItem,
} from "@/lib/pending/categories";
import { AgeChip, NayaPill, RedBadge } from "@/components/pending/pending-ui";
import { DecideButtons } from "./decide-buttons";

export const dynamic = "force-dynamic";

/**
 * Mere Kaam · Pending Approvals (582, mock_badge_inbox_*). Sirf parhta hai
 * (fn_admin_pending_counts / _items, SECURITY INVOKER = RLS + branch).
 * Faisle purane safhon / purane server actions se hi hote hain.
 */
type Rpc = (fn: string, a?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const ERR: Record<string, "apb_e_bad" | "apb_e_reason" | "apb_e_gone" | "apb_own_tip"> = { bad: "apb_e_bad", reason: "apb_e_reason", gone: "apb_e_gone", own: "apb_own_tip" };

export default async function PendingApprovalsPage({ searchParams }: { searchParams?: { f?: string; ok?: string; e?: string } }) {
  const sb = createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const lang = getLanguageFromCookies("rm");
  const { data: me } = await sb.from("profiles").select("role").eq("id", user.id).single();
  const nav = await loadNav(user.id, (me as { role?: string } | null)?.role ?? "", lang);
  const allowed = nav.unrestricted ? null : nav.allowedRoutes;
  const can = (route: string) => allowed === null || routeAllowed(allowed, route.split(/[?#]/, 1)[0]);
  const rpc = sb.rpc.bind(sb) as unknown as Rpc;

  const [cRes, iRes] = await Promise.all([rpc("fn_admin_pending_counts"), rpc("fn_admin_pending_items", { p_limit: 25 })]);
  const counts = ((cRes.data as PendingCount[] | null) ?? []).filter((c) => can(c.route));
  const allItems = ((iRes.data as PendingItem[] | null) ?? []).filter((i) => can(i.route));
  const tot = calcTotals(counts);
  const filter = searchParams?.f === "mine" ? "mine" : searchParams?.f === "new" ? "new" : "all";
  const items = allItems.filter((i) => (filter === "mine" ? !i.is_own : filter === "new" ? i.is_new : true));
  const byCat = new Map(counts.map((c) => [c.category, c]));
  const shownPerCat = new Map<string, number>();
  for (const i of allItems) shownPerCat.set(i.category, (shownPerCat.get(i.category) ?? 0) + 1);
  const groups = groupItems(items);
  const info = counts.filter((c) => c.is_info && c.readable && Number(c.pending) > 0);
  const unreadable = tot.unreadable;
  const errKey = searchParams?.e ? ERR[searchParams.e] : undefined;

  if (cRes.error) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="font-display text-2xl font-extrabold">{t("apb_title", lang)}</h1>
        <p className="mt-3 rounded-xl bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">{t("apb_unreadable", lang)}</p>
      </div>
    );
  }

  return (
    <div data-pending-page className="mx-auto max-w-6xl space-y-5 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-surface-900 dark:text-white">{t("apb_title", lang)}</h1>
          <p className="mt-1 max-w-2xl text-sm text-surface-500 dark:text-surface-400">{t("apb_sub", lang)}</p>
        </div>
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
              <span className="opacity-80">· {k === "all" ? tot.pending : k === "mine" ? tot.mine : tot.naya}</span>
            </Link>
          ))}
        </div>
      </div>

      {searchParams?.ok && (
        <p className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          {t("apb_done", lang)}
        </p>
      )}
      {searchParams?.e && (
        <p className="rounded-xl bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-700 dark:text-rose-300">
          {errKey ? t(errKey, lang) : decodeURIComponent(searchParams.e)}
        </p>
      )}

      <div data-pending-kpis className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi label={t("apb_kul_baqi", lang)} value={String(tot.pending)} tone="red" />
        <Kpi label={t("apb_kpi_new", lang)} value={String(tot.naya)} tone="green" />
        <Kpi label={t("apb_kpi_old", lang)} value={String(tot.oldTypes)} tone="amber" />
        <Kpi label={t("apb_kpi_mine", lang)} value={String(tot.mine)} tone="blue" />
        <Kpi label={t("apb_kpi_amount", lang)} value={fmtRs(tot.amount)} tone="plain" />
      </div>

      {unreadable.length > 0 && (
        <p data-pending-unreadable className="flex items-start gap-2 rounded-xl border border-amber-300/60 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-800 dark:border-amber-400/20 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            <b>{unreadable.map((c) => t(catLabelKey(c), lang)).join(", ")}</b> — {t("apb_unreadable", lang)}
          </span>
        </p>
      )}

      {groups.length === 0 && (
        <p className="rounded-2xl border border-surface-200 bg-white p-8 text-center text-sm text-surface-500 dark:border-white/10 dark:bg-white/5">{t("apb_none", lang)}</p>
      )}

      {groups.map(({ group, items: list }) => {
        const gCounts = counts.filter((c) => c.group_key === group && !c.is_info && c.readable);
        const gPending = gCounts.reduce((s, c) => s + Number(c.pending ?? 0), 0);
        const gNew = gCounts.reduce((s, c) => s + Number(c.naya ?? 0), 0);
        const cats = [...new Set(list.map((i) => i.category))];
        return (
          <section key={group} data-pending-group={group} className="overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0f1b3d]">
            <header className="flex items-center justify-between gap-2 border-b border-surface-100 px-4 py-3 dark:border-white/5">
              <h2 className="text-[13px] font-extrabold uppercase tracking-wider text-surface-800 dark:text-surface-100">{t(groupLabelKey(group), lang)}</h2>
              <span className="flex items-center gap-1.5">
                <NayaPill n={gNew} lang={lang} />
                <RedBadge n={gPending} />
              </span>
            </header>
            {/* Desktop */}
            <table className="hidden w-full table-fixed text-left text-[12.5px] md:table">
              <thead className="bg-surface-50 text-[10.5px] font-bold uppercase tracking-wider text-surface-400 dark:bg-white/[0.03]">
                <tr>
                  <th className="w-[96px] px-4 py-2">{t("apb_col_state", lang)}</th>
                  <th className="px-2 py-2">{t("apb_col_item", lang)}</th>
                  <th className="w-[110px] px-2 py-2 text-right">{t("apb_col_amount", lang)}</th>
                  <th className="w-[96px] px-2 py-2">{t("apb_col_age", lang)}</th>
                  <th className="w-[130px] px-2 py-2">{t("apb_col_by", lang)}</th>
                  <th className="w-[150px] px-2 py-2">{t("apb_col_with", lang)}</th>
                  <th className="w-[230px] px-4 py-2 text-right">{t("apb_col_act", lang)}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-white/5">
                {list.map((i) => (
                  <tr key={`${i.category}:${i.item_id}`} data-pending-row={i.is_new ? "new" : "pending"} className={cn(i.is_new ? "bg-emerald-500/[0.05]" : "bg-red-500/[0.03]")}>
                    <td className="px-4 py-2.5 align-top">
                      {i.is_new ? <NayaPill lang={lang} /> : <span className="text-[10.5px] font-extrabold tracking-wide text-red-600 dark:text-rose-400">● {t("apb_pending_short", lang)}</span>}
                    </td>
                    <td className="px-2 py-2.5 align-top">
                      <p className="truncate font-bold text-surface-900 dark:text-white">
                        {t(catLabelKey(i.category), lang)} {i.ref && <span className="font-mono text-[11px] text-surface-400">{i.ref}</span>}
                      </p>
                      {i.title && <p className="truncate text-[11.5px] text-surface-500 dark:text-surface-400">{i.title}</p>}
                    </td>
                    <td className="px-2 py-2.5 text-right align-top font-semibold tabular-nums text-surface-800 dark:text-surface-100">{i.amount != null ? fmtRs(i.amount) : "—"}</td>
                    <td className="px-2 py-2.5 align-top"><AgeChip days={ageDays(i.created_at)} lang={lang} /></td>
                    <td className="truncate px-2 py-2.5 align-top text-surface-700 dark:text-surface-200">{i.is_own ? <b className="text-amber-700 dark:text-amber-300">{t("apb_you", lang)}</b> : i.entered_by_name ?? t("apb_noname", lang)}</td>
                    <td className="px-2 py-2.5 align-top">
                      <span className="inline-flex max-w-full items-center gap-1 truncate rounded-lg bg-surface-100 px-2 py-0.5 text-[11.5px] font-semibold text-surface-700 dark:bg-white/5 dark:text-surface-200">
                        <UserRound className="h-3 w-3 shrink-0" />
                        <span className="truncate">{i.actor_name ?? t(roleLabelKey(i.pending_with), lang)}</span>
                      </span>
                    </td>
                    <td className="px-4 py-2.5 align-top"><DecideButtons category={i.category} id={i.item_id} isOwn={i.is_own} href={i.link || i.route} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Mobile */}
            <ul className="divide-y divide-surface-100 md:hidden dark:divide-white/5">
              {list.map((i) => (
                <li key={`${i.category}:${i.item_id}`} data-pending-card className={cn("space-y-2 px-4 py-3", i.is_new ? "bg-emerald-500/[0.05]" : "bg-red-500/[0.03]")}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-bold text-surface-900 dark:text-white">{t(catLabelKey(i.category), lang)} {i.ref && <span className="font-mono text-[11px] text-surface-400">{i.ref}</span>}</p>
                      {i.title && <p className="truncate text-[11.5px] text-surface-500 dark:text-surface-400">{i.title}</p>}
                    </div>
                    <span className="shrink-0 text-[13px] font-bold tabular-nums text-surface-900 dark:text-white">{i.amount != null ? fmtRs(i.amount) : ""}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    {i.is_new ? <NayaPill lang={lang} /> : <span className="font-extrabold text-red-600 dark:text-rose-400">● {t("apb_pending_short", lang)}</span>}
                    <AgeChip days={ageDays(i.created_at)} lang={lang} />
                    <span className="text-surface-500 dark:text-surface-400">{t("apb_entered", lang)}: {i.is_own ? t("apb_you", lang) : i.entered_by_name ?? t("apb_noname", lang)}</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-surface-700 dark:text-surface-200"><UserRound className="h-3 w-3" />{i.actor_name ?? t(roleLabelKey(i.pending_with), lang)}</span>
                  </div>
                  <DecideButtons category={i.category} id={i.item_id} isOwn={i.is_own} href={i.link || i.route} />
                </li>
              ))}
            </ul>
            {cats.map((c) => {
              const total = Number(byCat.get(c)?.pending ?? 0);
              const shown = shownPerCat.get(c) ?? 0;
              return total > shown ? (
                <Link key={c} href={byCat.get(c)!.route} className="block border-t border-surface-100 px-4 py-2 text-xs font-semibold text-blue-600 dark:border-white/5 dark:text-blue-400">
                  +{total - shown} {t(catLabelKey(c), lang)} — {t("apb_more", lang)} →
                </Link>
              ) : null;
            })}
          </section>
        );
      })}

      {info.length > 0 && (
        <section data-pending-info className="rounded-2xl border border-surface-200 bg-surface-100/70 p-4 text-surface-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-surface-300">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-surface-400" />
              <div>
                <p className="text-sm font-bold">{t("apb_info_title", lang)}</p>
                <p className="text-xs text-surface-500 dark:text-surface-400">{t("apb_info_sub", lang)}</p>
              </div>
            </div>
            <span className="flex items-center gap-2">
              <span className="rounded-full bg-surface-300 px-2.5 py-0.5 text-xs font-extrabold text-surface-700 dark:bg-white/10 dark:text-surface-200">{info.reduce((s, c) => s + Number(c.pending ?? 0), 0)}</span>
              {info.map((c) => (
                <Link key={c.category} href={c.route} className="rounded-lg border border-surface-300 bg-white px-2.5 py-1 text-xs font-semibold dark:border-white/10 dark:bg-white/5">{t("apb_info_open", lang)} →</Link>
              ))}
            </span>
          </div>
        </section>
      )}
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
