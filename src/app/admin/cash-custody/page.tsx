import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { canOpenCustodyDesk, holdDuration, rs, statusLabel } from "@/lib/cash-custody/chain";
import {
  loadAajJama,
  loadCustodyAsks,
  loadCustodyBoard,
  loadCustodyViewer,
  loadDepositMakers,
  loadHopsForPackets,
  type CustodyAsk,
  type DepositMakers,
  type NamedHop,
} from "@/lib/cash-custody/load";
import {
  cardTrail,
  holdShort,
  kpisFromOpen,
  kpisUnread,
  needsCue,
  showApprove,
  showAskWhy,
  sortNeeds,
} from "@/lib/cash-custody/needs";
import { homePageForRole } from "@/lib/departments";
import { NeedsBoard, type NeedsCardModel } from "./needs-board";

export const dynamic = "force-dynamic";

/**
 * Aaj aapki zarurat — POS cash custody queue.
 * Purana ledger (1030) neeche rehta hai. Silsila 717 ke packets se.
 */
export default async function CashCustodyPage() {
  const lang = getLanguageFromCookies("rm");
  const viewer = await loadCustodyViewer();
  if (!viewer) redirect("/login");
  if (!canOpenCustodyDesk(viewer.role)) redirect("/admin/my-work");

  const supabase = createClient();
  const [{ data: rows, error: ledgerError }, board, aajJama] = await Promise.all([
    supabase.from("v_cash_custody").select("*").order("cash_paas_hai", { ascending: false }),
    loadCustodyBoard(viewer),
    loadAajJama(viewer),
  ]);

  const open = sortNeeds(board.items);
  const packetIds = open.map((p) => p.id);
  const depositIds = open.map((p) => p.deposit_id).filter((id): id is string => !!id);
  const emptyHops = new Map<string, NamedHop[]>();
  const emptyAsks = new Map<string, CustodyAsk>();
  const emptyMakers = new Map<string, DepositMakers>();
  const [hops, asks, makers] = board.error
    ? [emptyHops, emptyAsks, emptyMakers]
    : await Promise.all([loadHopsForPackets(packetIds), loadCustodyAsks(packetIds), loadDepositMakers(depositIds)]);

  const kpis = board.error
    ? { ...kpisUnread(), aajJama }
    : kpisFromOpen(
        open.map((p) => ({ status: p.status, openedAt: p.opened_at, verifiedAt: p.verified_at })),
        aajJama
      );

  const cards: NeedsCardModel[] = board.error
    ? []
    : open.map((p, index) => {
        const cue = needsCue(p.status, p.overdue);
        const shop = p.shopName ?? p.branchName ?? t("cny_shop", lang);
        const hopRows = hops.get(p.id) ?? [];
        const maker = p.deposit_id ? makers.get(p.deposit_id) : undefined;
        const makerIds = [maker?.staffId, maker?.submittedBy].filter((id): id is string => !!id);
        const mode = showAskWhy(viewer.role, cue.action, viewer.userId, p.current_holder_id)
          ? "ask"
          : showApprove({
                role: viewer.role,
                action: cue.action,
                viewerId: viewer.userId,
                originId: p.origin_profile_id,
                holderId: p.current_holder_id,
                depositId: p.deposit_id,
                makerIds,
              })
            ? "approve"
            : cue.action === "admin_alert"
              ? "alert"
              : "none";
        const ask = asks.get(p.id);
        let title = t("cny_pos", lang);
        let titleAlt = t("cny_pos_alt", lang);
        let detail = t("cny_wasoli_line", lang);
        let detailAlt = t("cny_wasoli_line_alt", lang);
        if (cue.stage === "pos_close") {
          title = `${t("cny_pos", lang)} • ${shop} ${t("cny_slip", lang)}`;
        } else if (cue.stage === "manager_held") {
          title = t("cny_held", lang);
          titleAlt = t("cny_held_alt", lang);
          if (cue.action === "admin_alert") {
            detail = `${rs(Number(p.amount))} ${t("cny_overdue_for", lang)}`;
            detailAlt = `${shop} · ${t("cny_overdue_for_alt", lang)}`;
          } else {
            detail = `${p.holderName ?? "—"} · ${holdDuration(p.holder_since, null)}`;
            detailAlt = `${shop} · ${statusLabel(p.status)}`;
          }
        } else {
          title = t("cny_verify_title", lang);
          titleAlt = t("cny_verify_title_alt", lang);
          detail = `${rs(Number(p.amount))} · ${statusLabel(p.status)}`;
          detailAlt = shop;
        }
        return {
          id: p.id,
          index: index + 1,
          tone: cue.tone,
          mode,
          title,
          titleAlt,
          detail,
          detailAlt,
          trail: cardTrail(
            hopRows.map((h) => ({
              kind: h.kind,
              holderName: h.holderName,
              fromName: h.fromName,
              toName: h.toName,
              startedAt: h.started_at,
              endedAt: h.ended_at,
            }))
          ),
          age: holdShort(p.holder_since || p.opened_at, null),
          askNote: ask?.note ?? null,
          askActor: ask?.actorName ?? null,
        };
      });

  const now = new Date();
  const locale = lang === "ur" ? "ur-PK" : "en-PK";
  const dateLabel = now.toLocaleDateString(locale, { timeZone: "Asia/Karachi", day: "numeric", month: "short", year: "numeric" });
  const weekday = now.toLocaleDateString(locale, { timeZone: "Asia/Karachi", weekday: "long" });

  const people = ledgerError ? null : (rows ?? []);
  const total = people ? people.reduce((s, r) => s + Number(r.cash_paas_hai ?? 0), 0) : null;

  return (
    <div className="space-y-6">
      <NeedsBoard
        lang={lang}
        homeHref={homePageForRole(viewer.role)}
        queueCount={board.error ? null : open.length}
        dateLabel={dateLabel}
        weekday={weekday}
        kpis={kpis}
        cards={cards}
        error={board.error}
        labels={{
          ask: t("cny_ask", lang),
          askAlt: t("cny_ask_alt", lang),
          approve: t("cny_approve", lang),
          approveAlt: t("cny_approve_alt", lang),
          alert: t("cny_alert", lang),
          alertAlt: t("cny_alert_alt", lang),
          note: t("cny_note_ph", lang),
          send: t("cny_send", lang),
          asked: t("cny_asked", lang),
          trail: t("cny_trail", lang),
        }}
      />

      <section className="space-y-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-surface-900 dark:text-white">{t("cny_ledger", lang)}</h2>
          <p className="text-sm text-surface-500">{t("mcus_subtitle", lang)}</p>
        </div>
        <div className="rounded-card border border-amber-200 bg-amber-50 p-4 dark:border-amber-400/30 dark:bg-amber-400/10">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-200">{t("cc_total", lang)}</p>
          <p className="mt-1 font-display text-2xl font-semibold text-amber-800 dark:text-amber-100">
            {total === null ? "—" : `Rs ${total.toLocaleString()}`}
          </p>
          <p className="mt-1 text-xs text-amber-800 dark:text-amber-100">
            {ledgerError
              ? t("cny_unread", lang)
              : "Ye ledger ka 1030 hai — kisi ke naam par cash. Upar wali queue POS ki physical cash hai jab tak bank verify na ho."}
          </p>
        </div>
        <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-white/10 dark:bg-surface-900">
          {people === null ? (
            <p className="px-4 py-10 text-center text-sm text-surface-400">{t("cny_unread", lang)}</p>
          ) : people.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-surface-400">{t("cc_empty", lang)}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 text-left dark:border-white/10">
                  <th className="px-4 py-2 text-xs font-medium uppercase tracking-wide text-surface-500">{t("cc_person", lang)}</th>
                  <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wide text-surface-500">{t("cc_amount", lang)}</th>
                  <th className="px-4 py-2 text-xs font-medium uppercase tracking-wide text-surface-500">{t("cc_last_move", lang)}</th>
                </tr>
              </thead>
              <tbody>
                {people.map((r) => (
                  <tr key={r.profile_id as string} className="border-b border-surface-100 last:border-0 dark:border-white/5">
                    <td className="px-4 py-3">
                      <p className="font-medium text-surface-800 dark:text-white">{r.full_name ?? "—"}</p>
                      <p className="text-xs text-surface-400">{r.role ?? ""}</p>
                    </td>
                    <td className="px-4 py-3 text-right font-display font-semibold text-amber-700">
                      Rs {Number(r.cash_paas_hai ?? 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-xs text-surface-500">
                      {r.aakhri_harkat ? new Date(r.aakhri_harkat as string).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p className="text-xs text-surface-400">
          <Link href="/admin/cash-handover" className="hover:text-brand-700">
            {t("cny_nav_wasoli", lang)}
          </Link>
          {" · "}
          <Link href="/admin/finance/pos-deposits" className="hover:text-brand-700">
            {t("cny_nav_jama", lang)}
          </Link>
        </p>
      </section>
    </div>
  );
}
