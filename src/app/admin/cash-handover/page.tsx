import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { PageHeader, Card, EmptyState } from "@/components/ui/layout-primitives";
import { SendCashForm, ReceiveCard } from "./handover-client";
import { cashInTransit, recentHandovers, TRANSIT_ALERT_DAYS } from "@/lib/ledger/handover";
import { AlertTriangle, CheckCircle2, Send, HandCoins, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

const ROLES = ["owner", "super_admin", "admin", "manager", "finance"];

function rs(value: number): string {
  return `Rs ${Math.round(value).toLocaleString()}`;
}

export default async function CashHandoverPage() {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("role, is_active, full_name").eq("id", user.id).maybeSingle()
    : { data: null };

  if (!me?.is_active || !ROLES.includes(me.role)) {
    return (
      <div className="p-8 text-center text-surface-400">
        Ye safha sirf Manager, Finance aur Admin ke liye hai.
      </div>
    );
  }

  const [{ data: peopleRows }, { data: branchRows }, transit, history] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("is_active", true)
      .neq("id", user!.id)
      .order("full_name"),
    supabase.from("branches").select("id, name").eq("is_active", true).order("name"),
    cashInTransit(),
    recentHandovers(40),
  ]);

  const people = (peopleRows ?? []).map((p) => ({
    id: p.id,
    name: p.full_name ?? "—",
    role: p.role,
  }));
  const branches = (branchRows ?? []).map((b) => ({ id: b.id, name: b.name }));

  // Mere naam bheja hua cash jo maine abhi wusool nahi kiya.
  const { data: mineRows } = await supabase
    .from("cash_handovers")
    .select("id")
    .eq("to_profile_id", user!.id)
    .eq("status", "sent");
  const mineIds = new Set((mineRows ?? []).map((r) => r.id));
  const awaitingMe = transit.filter((t) => mineIds.has(t.id));

  const transitTotal = transit.reduce((s, t) => s + t.amount, 0);
  const stale = transit.filter((t) => t.daysOld >= TRANSIT_ALERT_DAYS);

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("ch_title", lang)}
        description={t("ch_subtitle", lang)}
      />

      {/* ---- Raaste mein kitna hai ---- */}
      <Card
        className={`p-4 ${
          transit.length === 0
            ? "border-l-4 border-l-green-500"
            : stale.length > 0
              ? "border-l-4 border-l-red-500 bg-red-50 dark:bg-red-950/20"
              : "border-l-4 border-l-amber-500 bg-amber-50 dark:bg-amber-950/20"
        }`}
      >
        <div className="flex items-start gap-3">
          {transit.length === 0 ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
          ) : (
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          )}
          <div>
            <p className="text-sm font-semibold text-surface-900 dark:text-white">
              {transit.length === 0
                ? t("ch_none_in_transit", lang)
                : `${rs(transitTotal)} ${t("ch_in_transit_now", lang)} ${transit.length} ${t("ch_handovers", lang)}`}
            </p>
            <p className="mt-0.5 text-xs text-surface-600 dark:text-surface-400">
              {transit.length === 0
                ? t("ch_all_received", lang)
                : t("ch_transit_meaning", lang)}
            </p>
            {stale.length > 0 && (
              <p className="mt-1.5 text-xs font-medium text-red-700 dark:text-red-400">
                {t("ch_stale_1", lang)} {stale.length} — {TRANSIT_ALERT_DAYS}+ {t("ch_stale_2", lang)}
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* ---- Mere naam aaya hua cash ---- */}
      {awaitingMe.length > 0 && (
        <div>
          <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-surface-400">
            <HandCoins className="h-3.5 w-3.5" /> {t("ch_amounts_for_you", lang)}
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {awaitingMe.map((h) => (
              <ReceiveCard
                key={h.id}
                handover={{
                  id: h.id,
                  amount: h.amount,
                  sentBy: h.sentBy,
                  carrier: h.carrier,
                  fromBranch: h.fromBranch,
                  note: h.note,
                  daysOld: h.daysOld,
                }}
              />
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_1fr]">
        {/* ---- Bhejne ka form ---- */}
        <Card className="p-4">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-surface-900 dark:text-white">
            <Send className="h-4 w-4" /> {t("ch_send_cash", lang)}
          </h2>
          {people.length === 0 ? (
            <EmptyState
              title={t("ch_no_one_else", lang)}
              description={t("ch_no_one_else_note", lang)}
            />
          ) : (
            <SendCashForm people={people} branches={branches} />
          )}
        </Card>

        <div className="space-y-4">
          {/* ---- Raaste wali raqmein ---- */}
          <Card className="overflow-hidden">
            <div className="border-b border-surface-200 px-4 py-3 text-sm font-semibold text-surface-900 dark:border-surface-800 dark:text-white">
              {t("ch_in_transit_now_title", lang)}
            </div>
            {transit.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-green-700 dark:text-green-400">
                {t("ch_nothing_in_transit", lang)}
              </p>
            ) : (
              <ul className="divide-y divide-surface-100 dark:divide-surface-800">
                {transit.map((row) => (
                  <li key={row.id} className="flex items-start justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-surface-900 dark:text-white">
                        {rs(row.amount)}
                      </p>
                      <p className="truncate text-xs text-surface-500">
                        {row.sentBy ?? "—"} → {row.toPerson ?? "—"}
                        {row.carrier ? ` (${row.carrier} ${t("ch_carried_by", lang)})` : ""}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-xs ${
                        row.daysOld >= TRANSIT_ALERT_DAYS
                          ? "font-medium text-red-700 dark:text-red-400"
                          : "text-surface-400"
                      }`}
                    >
                      {row.daysOld === 0 ? t("ch_today", lang) : `${row.daysOld} ${t("ch_days", lang)}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* ---- Purana record ---- */}
          <Card className="overflow-hidden">
            <div className="border-b border-surface-200 px-4 py-3 text-sm font-semibold text-surface-900 dark:border-surface-800 dark:text-white">
              {t("ch_past_handovers", lang)}
            </div>
            {history.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-surface-400">{t("ch_no_handovers", lang)}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="border-b border-surface-200 text-left text-xs text-surface-500 dark:border-surface-800">
                    <tr>
                      <th className="px-4 py-2 font-medium">{t("ch_who_to_who", lang)}</th>
                      <th className="px-4 py-2 text-right font-medium">{t("ch_sent", lang)}</th>
                      <th className="px-4 py-2 text-right font-medium">{t("ch_got", lang)}</th>
                      <th className="px-4 py-2 text-right font-medium">{t("ch_difference", lang)}</th>
                      <th className="px-4 py-2 font-medium">{t("ch_reason", lang)}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                    {history.map((h) => (
                      <tr key={h.id} className={h.status === "short" ? "bg-red-50/60 dark:bg-red-950/10" : ""}>
                        <td className="px-4 py-2">
                          <span className="text-surface-800 dark:text-surface-200">
                            {h.sentBy ?? "—"} → {h.toPerson ?? "—"}
                          </span>
                          <span className="block text-xs text-surface-400">
                            {h.sentAt.slice(0, 10)}
                            {h.status === "sent" && t("ch_still_in_transit", lang)}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-surface-600 dark:text-surface-400">
                          {rs(h.amount)}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-surface-900 dark:text-white">
                          {h.received === null ? "—" : rs(h.received)}
                        </td>
                        <td
                          className={`px-4 py-2 text-right font-medium tabular-nums ${
                            !h.difference
                              ? "text-green-700 dark:text-green-400"
                              : "text-red-700 dark:text-red-400"
                          }`}
                        >
                          {h.difference === null
                            ? "—"
                            : h.difference === 0
                              ? "0"
                              : `${h.difference < 0 ? "−" : "+"}${rs(Math.abs(h.difference))}`}
                        </td>
                        <td className="max-w-[200px] truncate px-4 py-2 text-xs text-surface-500">
                          {h.reason ?? ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>

      <p className="flex items-start gap-1.5 px-1 text-xs text-surface-400">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {t("ch_footer_note", lang)}
      </p>
    </div>
  );
}
