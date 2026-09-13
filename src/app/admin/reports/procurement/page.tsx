import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { StatCard } from "@/components/dashboard/stat-card";
import { DateRangeFilter } from "@/components/dashboard/date-range-filter";
import { isDateRangeKey, getDateRange, type DateRangeKey } from "@/lib/utils/dashboard-filters";
import { Wheat, Wallet, Users, TrendingUp } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

export default async function ProcurementReportPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const params = await searchParams;
  const range: DateRangeKey = isDateRangeKey(params.range) ? params.range : "month";
  const { start, end } = getDateRange(range);
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const { data: entries } = await supabase
    .from("grain_procurement_entries")
    .select("id, farmer_id, grain_type, entry_date, weight_kg, moisture_percentage, quality_grade, rate_per_kg, total_amount")
    .gte("entry_date", start.toISOString().slice(0, 10))
    .lte("entry_date", end.toISOString().slice(0, 10))
    .order("entry_date", { ascending: false })
    .limit(300);

  const { data: balances } = await supabase
    .from("grain_farmer_balances")
    .select("farmer_id, full_name, total_supplied, total_paid, balance_due")
    .order("balance_due", { ascending: false });

  const totalWeight = (entries ?? []).reduce((sum, e) => sum + Number(e.weight_kg ?? 0), 0);
  const totalAmount = (entries ?? []).reduce((sum, e) => sum + Number(e.total_amount ?? 0), 0);
  const avgRate = totalWeight > 0 ? totalAmount / totalWeight : 0;
  const farmerCount = new Set((entries ?? []).map((e) => e.farmer_id)).size;
  const totalOwed = (balances ?? []).reduce((sum, b) => sum + Number(b.balance_due ?? 0), 0);

  const byGrain = new Map<string, { weight: number; amount: number }>();
  (entries ?? []).forEach((e) => {
    const cur = byGrain.get(e.grain_type) ?? { weight: 0, amount: 0 };
    cur.weight += Number(e.weight_kg ?? 0);
    cur.amount += Number(e.total_amount ?? 0);
    byGrain.set(e.grain_type, cur);
  });
  const grainBreakdown = [...byGrain.entries()].sort((a, b) => b[1].amount - a[1].amount);

  const farmerNameMap = new Map((balances ?? []).map((b) => [b.farmer_id, b.full_name]));
  const topOwed = (balances ?? []).filter((b) => Number(b.balance_due ?? 0) > 0).slice(0, 10);

  return (
    <div>
      <PageHeader title={t("pr_title", lang)} description="Grain procurement by crop, and farmer balances" />

      <div className="mt-4">
        <DateRangeFilter current={range} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label={t("pr_total_quantity", lang)} value={`${totalWeight.toLocaleString()} kg`} icon={Wheat} tone="orange" />
        <StatCard label={t("c_total_amount", lang)} value={`Rs. ${totalAmount.toLocaleString()}`} icon={TrendingUp} tone="brand" />
        <StatCard label={t("pr_avg_rate_kg", lang)} value={`Rs. ${avgRate.toFixed(1)}`} icon={Wheat} tone="purple" />
        <StatCard label={t("c_farmers", lang)} value={String(farmerCount)} icon={Users} tone="blue" />
        <StatCard label={t("c_owed_to_farmers", lang)} value={`Rs. ${totalOwed.toLocaleString()}`} icon={Wallet} tone="warn" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
          <h2 className="mb-4 font-display text-base font-semibold text-surface-900 dark:text-surface-100">{t("pr_crop_breakdown", lang)}</h2>
          {grainBreakdown.length === 0 ? (
            <p className="text-sm text-surface-400">{t("pr_no_procurement", lang)}</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-surface-100 text-xs text-surface-500">
                  <th className="py-1.5 pr-2">{t("c_crop", lang)}</th>
                  <th className="py-1.5 pr-2 text-right">{t("c_quantity", lang)}</th>
                  <th className="py-1.5 pr-2 text-right">{t("c_amount", lang)}</th>
                </tr>
              </thead>
              <tbody>
                {grainBreakdown.map(([grain, v]) => (
                  <tr key={grain} className="border-b border-surface-50 last:border-0">
                    <td className="py-1.5 pr-2 font-medium capitalize text-surface-900">{grain}</td>
                    <td className="py-1.5 pr-2 text-right text-surface-600">{v.weight.toLocaleString()} kg</td>
                    <td className="py-1.5 pr-2 text-right text-surface-600">Rs. {v.amount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
          <h2 className="mb-4 font-display text-base font-semibold text-surface-900 dark:text-surface-100">{t("c_farmers_with_outstanding", lang)}</h2>
          {topOwed.length === 0 ? (
            <p className="text-sm text-surface-400">{t("c_no_outstanding", lang)}</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-surface-100 text-xs text-surface-500">
                  <th className="py-1.5 pr-2">{t("c_farmer", lang)}</th>
                  <th className="py-1.5 pr-2 text-right">{t("pr_supplied", lang)}</th>
                  <th className="py-1.5 pr-2 text-right">{t("c_balance_due", lang)}</th>
                </tr>
              </thead>
              <tbody>
                {topOwed.map((b) => (
                  <tr key={b.farmer_id} className="border-b border-surface-50 last:border-0">
                    <td className="py-1.5 pr-2 font-medium text-surface-900">{b.full_name}</td>
                    <td className="py-1.5 pr-2 text-right text-surface-600">Rs. {Number(b.total_supplied ?? 0).toLocaleString()}</td>
                    <td className="py-1.5 pr-2 text-right font-medium text-red-600">Rs. {Number(b.balance_due ?? 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <h2 className="mb-4 font-display text-base font-semibold text-surface-900 dark:text-surface-100">{t("c_recent_entries", lang)}</h2>
        {(entries ?? []).length === 0 ? (
          <p className="text-sm text-surface-400">{t("c_no_entries_period", lang)}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-surface-100 text-xs text-surface-500">
                  <th className="py-2 pr-3">{t("c_date", lang)}</th>
                  <th className="py-2 pr-3">{t("c_farmer", lang)}</th>
                  <th className="py-2 pr-3">{t("c_crop", lang)}</th>
                  <th className="py-2 pr-3">{t("pr_quality", lang)}</th>
                  <th className="py-2 pr-3 text-right">{t("pr_weight", lang)}</th>
                  <th className="py-2 pr-3 text-right">{t("c_rate", lang)}</th>
                  <th className="py-2 pr-3 text-right">{t("c_amount", lang)}</th>
                </tr>
              </thead>
              <tbody>
                {(entries ?? []).slice(0, 50).map((e) => (
                  <tr key={e.id} className="border-b border-surface-50 last:border-0">
                    <td className="py-2 pr-3 text-surface-500">{e.entry_date}</td>
                    <td className="py-2 pr-3 text-surface-700">{farmerNameMap.get(e.farmer_id) ?? "-"}</td>
                    <td className="py-2 pr-3 capitalize text-surface-600">{e.grain_type}</td>
                    <td className="py-2 pr-3 text-surface-600">{e.quality_grade ?? "-"}</td>
                    <td className="py-2 pr-3 text-right text-surface-700">{Number(e.weight_kg).toLocaleString()} kg</td>
                    <td className="py-2 pr-3 text-right text-surface-600">Rs. {Number(e.rate_per_kg).toFixed(1)}</td>
                    <td className="py-2 pr-3 text-right font-medium text-surface-900">Rs. {Number(e.total_amount).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}