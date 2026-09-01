import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { PageHeader, Card, EmptyState } from "@/components/ui/layout-primitives";
import { StartCountForm, CountingSheet, ReviewSheet } from "./count-client";
import {
  openCount,
  recentCounts,
  overdueCounts,
  COUNT_OVERDUE_DAYS,
} from "@/lib/ledger/stock-count";
import { AlertTriangle, CheckCircle2, PackageSearch, EyeOff } from "lucide-react";

export const dynamic = "force-dynamic";

const ROLES = ["owner", "super_admin", "admin", "manager", "finance", "warehouse"];

function rs(value: number): string {
  return `Rs ${Math.round(value).toLocaleString()}`;
}

export default async function StockCountPage({
  searchParams,
}: {
  searchParams: Promise<{ w?: string; step?: string }>;
}) {
  const params = await searchParams;
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("role, is_active, branch_id").eq("id", user.id).maybeSingle()
    : { data: null };

  if (!me?.is_active || !ROLES.includes(me.role)) {
    return (
      <div className="p-8 text-center text-surface-400">{t("at_warehouse_roles", lang)}</div>
    );
  }

  const seesAll = me.role !== "warehouse" && me.role !== "manager";
  let whQuery = supabase.from("warehouses").select("id, name").eq("is_active", true).order("name");
  if (!seesAll && me.branch_id) whQuery = whQuery.eq("branch_id", me.branch_id);
  const { data: whRows } = await whQuery;

  const warehouses = (whRows ?? []).map((w) => ({ id: w.id, name: w.name }));
  const selected = params.w ?? warehouses[0]?.id ?? null;

  // Milaan ke safhe par hi asal adad kholte hain. Ginti ke safhe par
  // kabhi nahi -- yehi is poore amal ki jaan hai.
  const reviewing = params.step === "review";
  const current = selected ? await openCount(selected, reviewing) : null;

  const [history, overdue] = await Promise.all([recentCounts(15), overdueCounts()]);

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("sc_title", lang)}
        description={t("sc_subtitle", lang)}
      />

      {/* ---- Jin godamon ki ginti nahi hui ---- */}
      {overdue.length > 0 && (
        <Card className="border-l-4 border-l-red-500 bg-red-50 p-4 dark:bg-red-950/20">
          <p className="flex items-start gap-2 text-sm text-red-800 dark:text-red-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>{overdue.length} {t("sc_overdue_1", lang)}</strong> {t("sc_overdue_2", lang)} {COUNT_OVERDUE_DAYS} {t("sc_overdue_3", lang)}
              <span className="mt-1 block text-xs font-normal">
                {overdue.map((o) => (
                  <span key={o.warehouseId} className="mr-3 inline-block">
                    {o.warehouseName} — {o.lastCount ? `${t("sc_last_count", lang)} ${o.lastCount}` : t("sc_never_counted", lang)}
                  </span>
                ))}
              </span>
              <span className="mt-1 block text-xs font-normal">
                {t("sc_never_counted_note", lang)}
              </span>
            </span>
          </p>
        </Card>
      )}

      {warehouses.length === 0 ? (
        <Card className="p-4">
          <EmptyState title={t("sc_no_warehouse", lang)} description={t("sc_no_warehouse_note", lang)} />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,340px)_1fr]">
          <div className="space-y-4">
            {/* ---- Godam chunna ---- */}
            <Card className="p-4">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-400">{t("sc_warehouse", lang)}</h2>
              <ul className="space-y-1">
                {warehouses.map((w) => (
                  <li key={w.id}>
                    <a
                      href={`/admin/stock-count?w=${w.id}`}
                      className={`block rounded-lg px-3 py-2 text-sm transition ${
                        selected === w.id
                          ? "bg-brand-50 font-medium text-brand-800 dark:bg-brand-950/30 dark:text-brand-300"
                          : "text-surface-700 hover:bg-surface-50 dark:text-surface-300 dark:hover:bg-surface-900"
                      }`}
                    >
                      {w.name}
                    </a>
                  </li>
                ))}
              </ul>
            </Card>

            {!current && (
              <Card className="p-4">
                <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-surface-900 dark:text-white">
                  <PackageSearch className="h-4 w-4" /> {t("sc_new_count", lang)}
                </h2>
                <StartCountForm warehouses={warehouses} />
              </Card>
            )}
          </div>

          <div className="space-y-4">
            {/* ---- Khuli hui ginti ---- */}
            {current ? (
              <Card className="p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-surface-900 dark:text-white">
                      {current.warehouseName} — {reviewing ? t("sc_review", lang) : t("sc_counting", lang)}
                    </h2>
                    <p className="text-xs text-surface-500">
                      {current.countDate} • {current.lines.length} {t("sc_items", lang)}
                      {current.startedByName && ` • ${current.startedByName}`}
                    </p>
                  </div>
                  {current.allCounted && !reviewing && (
                    <a
                      href={`/admin/stock-count?w=${current.warehouseId}&step=review`}
                      className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700"
                    >
                      {t("sc_go_to_review", lang)}
                    </a>
                  )}
                  {reviewing && (
                    <a
                      href={`/admin/stock-count?w=${current.warehouseId}`}
                      className="text-xs text-surface-500 underline"
                    >
                      {t("sc_back_to_count", lang)}
                    </a>
                  )}
                </div>

                {reviewing ? (
                  <ReviewSheet countId={current.id} lines={current.lines} />
                ) : (
                  <CountingSheet
                    countId={current.id}
                    lines={current.lines.map((l) => ({
                      id: l.id,
                      productName: l.productName,
                      unit: l.unit,
                      packSize: l.packSize,
                      counted: l.counted,
                    }))}
                  />
                )}

                {!reviewing && !current.allCounted && (
                  <p className="mt-3 flex items-start gap-1.5 text-xs text-surface-500">
                    <EyeOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {t("sc_hidden_until_all", lang)}
                  </p>
                )}
              </Card>
            ) : (
              <Card className="p-6">
                <EmptyState
                  title={t("sc_no_open_count", lang)}
                  description={t("sc_no_open_count_note", lang)}
                />
              </Card>
            )}

            {/* ---- Purani gintiyan ---- */}
            <Card className="overflow-hidden">
              <div className="border-b border-surface-200 px-4 py-3 text-sm font-semibold text-surface-900 dark:border-surface-800 dark:text-white">
                {t("sc_past_counts", lang)}
              </div>
              {history.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-surface-400">{t("sc_no_past_counts", lang)}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead className="border-b border-surface-200 text-left text-xs text-surface-500 dark:border-surface-800">
                      <tr>
                        <th className="px-4 py-2 font-medium">{t("sc_warehouse", lang)}</th>
                        <th className="px-4 py-2 font-medium">{t("sc_date", lang)}</th>
                        <th className="px-4 py-2 text-right font-medium">{t("sc_items", lang)}</th>
                        <th className="px-4 py-2 text-right font-medium">{t("sc_with_gaps", lang)}</th>
                        <th className="px-4 py-2 text-right font-medium">{t("sc_loss_gain", lang)}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                      {history.map((h) => (
                        <tr key={h.id} className={h.gapCount > 0 ? "bg-red-50/60 dark:bg-red-950/10" : ""}>
                          <td className="px-4 py-2 text-surface-800 dark:text-surface-200">{h.warehouseName}</td>
                          <td className="px-4 py-2 text-xs text-surface-500">{h.countDate}</td>
                          <td className="px-4 py-2 text-right tabular-nums text-surface-500">{h.lineCount}</td>
                          <td
                            className={`px-4 py-2 text-right tabular-nums ${
                              h.gapCount > 0
                                ? "font-medium text-red-700 dark:text-red-400"
                                : "text-green-700 dark:text-green-400"
                            }`}
                          >
                            {h.gapCount === 0 ? "—" : h.gapCount}
                          </td>
                          <td
                            className={`px-4 py-2 text-right font-medium tabular-nums ${
                              h.totalDifferenceValue === 0
                                ? "text-green-700 dark:text-green-400"
                                : "text-red-700 dark:text-red-400"
                            }`}
                          >
                            {h.totalDifferenceValue === 0
                              ? "0"
                              : `${h.totalDifferenceValue < 0 ? "−" : "+"}${rs(Math.abs(h.totalDifferenceValue))}`}
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
      )}

      {overdue.length === 0 && history.length > 0 && (
        <Card className="border-l-4 border-l-green-500 p-4">
          <p className="flex items-center gap-2 text-sm text-green-800 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4" /> {t("sc_all_on_time", lang)} {COUNT_OVERDUE_DAYS} {t("sc_all_on_time_days", lang)}
          </p>
        </Card>
      )}
    </div>
  );
}
