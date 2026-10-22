import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, AlertTriangle, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { loadNav, routeAllowed } from "@/lib/access/nav";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import {
  catLabelKey,
  groupItems,
  groupLabelKey,
  CODE_MAKER_COLS,
  markCodeOwn,
  adjustMineForCode,
  totals as calcTotals,
  claimForHref,
  inboxGroup,
  parsePendingRoute,
  CATEGORY_KEYS,
  type PendingCount,
  type PendingItem,
} from "@/lib/pending/categories";
import { pendingKey } from "@/lib/pending/decide";
import { attachProductExtras } from "@/lib/pending/product-attach";
import { loadProductPendingExtras } from "@/lib/pending/product-diff-load";
import { isSelfApproveRole } from "@/lib/approval/guards";
import { itemMatchesFilter, type PendingListFilter } from "@/lib/pending/escalation";
import { attachEscalation } from "@/lib/pending/load-escalation";
import { LiveGroupMarks, PendingFilterPills, PendingGroupFrame, PendingKpis, PendingLive } from "./live-state";
import { PendingCard, PendingTableRow } from "./pending-rows";
import { OwnerEscalationSummary, SlaSettings } from "./escalation-ui";

export const dynamic = "force-dynamic";

/**
 * Mere Kaam · Pending Approvals (582, mock_badge_inbox_*). Sirf parhta hai
 * (fn_admin_pending_counts / _items, SECURITY INVOKER = RLS + branch).
 * Faisle purane safhon / purane server actions se hi hote hain.
 */
type Rpc = (fn: string, a?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const ERR: Record<string, "apb_e_bad" | "apb_e_reason" | "apb_e_gone" | "apb_own_tip" | "apb_code_tip"> = { bad: "apb_e_bad", reason: "apb_e_reason", gone: "apb_e_gone", own: "apb_own_tip", code: "apb_code_tip" };

const FILTERS = ["all", "mine", "new", "escalated", "overdue"] as const;

export default async function PendingApprovalsPage({ searchParams }: { searchParams?: { f?: string; ok?: string; e?: string; route?: string } }) {
  const sb = createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const lang = getLanguageFromCookies("rm");
  const { data: me } = await sb.from("profiles").select("role").eq("id", user.id).single();
  const viewerRole = (me as { role?: string } | null)?.role ?? "";
  const nav = await loadNav(user.id, viewerRole, lang);
  const allowed = nav.unrestricted ? null : nav.allowedRoutes;
  const can = (route: string) => allowed === null || routeAllowed(allowed, route.split(/[?#]/, 1)[0]);
  const rpc = sb.rpc.bind(sb) as unknown as Rpc;
  const focus = parsePendingRoute(searchParams?.route);
  const menus = nav.groups.map((g) => ({ key: g.key, hrefs: g.items.map((i) => i.href) }));

  const cRes = await rpc("fn_admin_pending_counts");
  const rawCounts = ((cRes.data as PendingCount[] | null) ?? []).filter((c) => can(c.route));
  const focusGroup = focus ? nav.groups.find((g) => g.items.some((i) => i.href.split(/[?#]/, 1)[0] === focus)) : undefined;
  const focusSiblings = focus ? (focusGroup ? focusGroup.items.map((i) => i.href) : [focus]) : [];
  const focusCats = focus ? claimForHref(rawCounts, focus, focusSiblings).map((c) => c.category) : [];
  const itemParts = focus
    ? await Promise.all(focusCats.map((cat) => rpc("fn_admin_pending_items", { p_limit: 200, p_category: cat })))
    : [await rpc("fn_admin_pending_items", { p_limit: 25 })];
  const rawItems = itemParts.flatMap((p) => (p.data as PendingItem[] | null) ?? []).filter((i) => can(i.route));
  // Manager code wala bhi maker hai (528) -- us par Approve band, "mujh par baqi" se bahar.
  const codeBy = new Map<string, string | null>();
  for (const [cat, src] of Object.entries(CODE_MAKER_COLS)) {
    const ids = rawItems.filter((i) => i.category === cat).map((i) => i.item_id);
    if (!ids.length) continue;
    const { data: rows } = await (sb.from(src.table as never) as unknown as {
      select: (c: string) => { in: (k: string, v: string[]) => Promise<{ data: Record<string, string | null>[] | null }> };
    }).select(`id, ${src.col}`).in("id", ids);
    for (const r of rows ?? []) codeBy.set(String(r.id), r[src.col] ?? null);
  }
  const editIds = rawItems.filter((i) => i.category === "product_edits").map((i) => i.item_id);
  const mergeIds = rawItems.filter((i) => i.category === "product_merge").map((i) => i.item_id);
  const extras = editIds.length || mergeIds.length ? await loadProductPendingExtras(sb as never, editIds, mergeIds).catch(() => new Map()) : new Map();
  const marked = attachProductExtras(markCodeOwn(rawItems, codeBy, user.id), extras);
  const overlay = await attachEscalation(sb as never, marked, viewerRole, user.id).catch(() => null);
  const allItems = overlay?.items ?? marked;
  const counts = adjustMineForCode(rawCounts, allItems);
  const scopeCounts = focus ? counts.filter((c) => focusCats.includes(c.category)) : counts;
  const tot = calcTotals(scopeCounts);
  const filter: PendingListFilter = (FILTERS as readonly string[]).includes(searchParams?.f ?? "") ? (searchParams!.f as PendingListFilter) : "all";
  const inScope = focus ? allItems.filter((i) => focusCats.includes(i.category)) : allItems;
  const items = inScope.filter((i) => itemMatchesFilter(filter, i, viewerRole));
  const byCat = new Map(scopeCounts.map((c) => [c.category, c]));
  const shownPerCat = new Map<string, number>();
  for (const i of inScope) shownPerCat.set(i.category, (shownPerCat.get(i.category) ?? 0) + 1);
  const placed = items.map((i) => ({ ...i, group_key: inboxGroup(i.route, i.group_key, menus) }));
  const groups = groupItems(placed);
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
    <PendingLive counts={counts} viewerRole={viewerRole}>
    <div data-pending-page className="mx-auto max-w-6xl space-y-5 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-surface-900 dark:text-white">{t("apb_title", lang)}</h1>
          <p className="mt-1 max-w-2xl text-sm text-surface-500 dark:text-surface-400">{t("apb_sub", lang)}</p>
        </div>
        <PendingFilterPills filter={filter} base={tot} route={focus} escalated={overlay?.escalatedToMe ?? 0} overdue={overlay?.overdue ?? 0} />
      </div>

      {focus && (
        <p data-pending-route={focus} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">
          <span>{t("apb_queue_for", lang)}</span>
          <Link href="/admin/my-work/pending" className="font-semibold underline">{t("apb_queue_all", lang)}</Link>
        </p>
      )}

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

      <PendingKpis base={tot} />

      {overlay?.summary && (
        <OwnerEscalationSummary count={overlay.summary.count} oldest={overlay.summary.oldest} byPerson={overlay.summary.byPerson} />
      )}
      {isSelfApproveRole(viewerRole) && (
        <SlaSettings
          options={(CATEGORY_KEYS as readonly string[]).filter((c) => c !== "data_health").map((category) => ({
            category,
            hours: overlay?.sla[category] ?? 24,
          }))}
        />
      )}

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
        const gCounts = scopeCounts.filter((c) => inboxGroup(c.route, c.group_key, menus) === group && !c.is_info && c.readable);
        const gPending = gCounts.reduce((s, c) => s + Number(c.pending ?? 0), 0);
        const gNew = gCounts.reduce((s, c) => s + Number(c.naya ?? 0), 0);
        const cats = [...new Set(list.map((i) => i.category))];
        return (
          <PendingGroupFrame key={group} group={group} pending={gPending} keys={list.map((i) => pendingKey(i.category, i.item_id))}>
          <section data-pending-group={group} className="overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0f1b3d]">
            <header className="flex items-center justify-between gap-2 border-b border-surface-100 px-4 py-3 dark:border-white/5">
              <h2 className="text-[13px] font-extrabold uppercase tracking-wider text-surface-800 dark:text-surface-100">{t(groupLabelKey(group), lang)}</h2>
              <LiveGroupMarks group={group} pending={gPending} naya={gNew} />
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
                  <th className="w-[290px] px-4 py-2 text-right">{t("apb_col_act", lang)}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-white/5">
                {list.map((i) => (
                  <PendingTableRow key={pendingKey(i.category, i.item_id)} item={i} />
                ))}
              </tbody>
            </table>
            {/* Mobile */}
            <ul className="divide-y divide-surface-100 md:hidden dark:divide-white/5">
              {list.map((i) => (
                <PendingCard key={pendingKey(i.category, i.item_id)} item={i} />
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
          </PendingGroupFrame>
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
    </PendingLive>
  );
}
