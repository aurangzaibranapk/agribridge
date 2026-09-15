import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { StatCard } from "@/components/dashboard/stat-card";
import { DateRangeFilter } from "@/components/dashboard/date-range-filter";
import { isDateRangeKey, getDateRange, type DateRangeKey } from "@/lib/utils/dashboard-filters";
import { Droplet, Wallet, Users, TrendingUp } from "lucide-react";
import { ReportActions } from "./report-actions";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
export const dynamic = "force-dynamic";
export default async function MilkReportPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; farmer_id?: string }>;
}) {
  const params = await searchParams;
  const range: DateRangeKey = isDateRangeKey(params.range) ? params.range : "month";
  const { start, end } = getDateRange(range);
  const farmerFilter = params.farmer_id ?? "";
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  let query = supabase
    .from("milk_entries")
    .select("id, farmer_id, entry_date, shift, quantity_liters, fat_percentage, rate_per_liter, total_amount")
    .gte("entry_date", start.toISOString().slice(0, 10))
    .lte("entry_date", end.toISOString().slice(0, 10))
    .order("entry_date", { ascending: false })
    .limit(300);
  if (farmerFilter) query = query.eq("farmer_id", farmerFilter);

  const { data: entries } = await query;
  const { data: balances } = await supabase
    .from("milk_farmer_balances")
    .select("farmer_id, full_name, total_supplied, total_paid, balance_due")
    .order("balance_due", { ascending: false });

  const totalLiters = (entries ?? []).reduce((sum, e) => sum + Number(e.quantity_liters ?? 0), 0);
  const totalAmount = (entries ?? []).reduce((sum, e) => sum + Number(e.total_amount ?? 0), 0);
  const avgRate = totalLiters > 0 ? totalAmount / totalLiters : 0;
  const avgFat =
    (entries ?? []).length > 0
      ? (entries ?? []).reduce((sum, e) => sum + Number(e.fat_percentage ?? 0), 0) / (entries ?? []).length
      : 0;
  const farmerCount = new Set((entries ?? []).map((e) => e.farmer_id)).size;
  const totalOwed = (balances ?? []).reduce((sum, b) => sum + Number(b.balance_due ?? 0), 0);
  const byFarmer = new Map<string, { liters: number; amount: number }>();
  (entries ?? []).forEach((e) => {
    const cur = byFarmer.get(e.farmer_id) ?? { liters: 0, amount: 0 };
    cur.liters += Number(e.quantity_liters ?? 0);
    cur.amount += Number(e.total_amount ?? 0);
    byFarmer.set(e.farmer_id, cur);
  });
  const farmerNameMap = new Map((balances ?? []).map((b) => [b.farmer_id, b.full_name]));
  const topSuppliers = [...byFarmer.entries()]
    .sort((a, b) => b[1].liters - a[1].liters)
    .slice(0, 5)
    .map(([farmerId, v]) => ({ name: farmerNameMap.get(farmerId) ?? "Farmer", ...v }));
  const topOwed = (balances ?? []).filter((b) => Number(b.balance_due ?? 0) > 0).slice(0, 10);

  const reportSummary = {
    farmerName: farmerFilter ? (farmerNameMap.get(farmerFilter) ?? "Farmer") : "All Farmers",
    periodLabel: range,
    totalLiters,
    totalAmount,
    entries: (entries ?? []).map((e) => ({ entry_date: e.entry_date, quantity_liters: Number(e.quantity_liters), total_amount: Number(e.total_amount) })),
  };

  const allFarmers = [...farmerNameMap.entries()].map(([id, name]) => ({ id, name }));

  return (
    <div>
      <PageHeader title={t("mr_title", lang)} description="Milk collection, rates, and farmer balances" />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <DateRangeFilter current={range} />
          <form className="flex items-center gap-2">
            <input type="hidden" name="range" value={range} />
            <select
              name="farmer_id"
              defaultValue={farmerFilter}
              className="rounded-lg border border-surface-200 p-2 text-sm"
            >
              <option value="">{t("mr_all_farmers", lang)}</option>
              {allFarmers.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
            <button type="submit" className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">{t("c_filter", lang)}</button>
          </form>
        </div>
        <ReportActions summary={reportSummary} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label={t("mr_total_litres", lang)} value={`${totalLiters.toFixed(0)} L`} icon={Droplet} tone="blue" />
        <StatCard label={t("c_total_amount", lang)} value={`Rs. ${totalAmount.toLocaleString()}`} icon={TrendingUp} tone="brand" />
        <StatCard label={t("mr_avg_rate_litre", lang)} value={`Rs. ${avgRate.toFixed(1)}`} icon={Droplet} tone="purple" />
        <StatCard label={t("mr_avg_fat", lang)} value={`${avgFat.toFixed(1)}%`} icon={Droplet} tone="orange" />
        <StatCard label={t("c_owed_to_farmers", lang)} value={`Rs. ${totalOwed.toLocaleString()}`} icon={Wallet} tone="warn" />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
          <h2 className="mb-4 flex items-center gap-1.5 font-display text-base font-semibold text-surface-900 dark:text-surface-100">
            <Users className="h-4 w-4" />{t("at_top_suppliers_period", lang)}</h2>
          {topSuppliers.length === 0 ? (
            <p className="text-sm text-surface-400">{t("mr_no_collection", lang)}</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-surface-100 text-xs text-surface-500">
                  <th className="py-1.5 pr-2">{t("c_farmer", lang)}</th>
                  <th className="py-1.5 pr-2 text-right">{t("mr_litres", lang)}</th>
                  <th className="py-1.5 pr-2 text-right">{t("c_amount", lang)}</th>
                </tr>
              </thead>
              <tbody>
                {topSuppliers.map((s, idx) => (
                  <tr key={idx} className="border-b border-surface-50 last:border-0">
                    <td className="py-1.5 pr-2 font-medium text-surface-900">{s.name}</td>
                    <td className="py-1.5 pr-2 text-right text-surface-600">{s.liters.toFixed(0)} L</td>
                    <td className="py-1.5 pr-2 text-right text-surface-600">Rs. {s.amount.toLocaleString()}</td>
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
                  <th className="py-1.5 pr-2 text-right">{t("c_balance_due", lang)}</th>
                </tr>
              </thead>
              <tbody>
                {topOwed.map((b, idx) => (
                  <tr key={idx} className="border-b border-surface-50 last:border-0">
                    <td className="py-1.5 pr-2 font-medium text-surface-900">{b.full_name}</td>
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
                  <th className="py-2 pr-3">{t("mr_shift", lang)}</th>
                  <th className="py-2 pr-3 text-right">{t("mr_litres", lang)}</th>
                  <th className="py-2 pr-3 text-right">{t("mr_fat", lang)}</th>
                  <th className="py-2 pr-3 text-right">{t("c_rate", lang)}</th>
                  <th className="py-2 pr-3 text-right">{t("c_amount", lang)}</th>
                </tr>
              </thead>
              <tbody>
                {(entries ?? []).slice(0, 50).map((e) => (
                  <tr key={e.id} className="border-b border-surface-50 last:border-0">
                    <td className="py-2 pr-3 text-surface-500">{e.entry_date}</td>
                    <td className="py-2 pr-3 text-surface-700">{farmerNameMap.get(e.farmer_id) ?? "-"}</td>
                    <td className="py-2 pr-3 capitalize text-surface-600">{e.shift}</td>
                    <td className="py-2 pr-3 text-right text-surface-700">{Number(e.quantity_liters).toFixed(1)}</td>
                    <td className="py-2 pr-3 text-right text-surface-600">{e.fat_percentage ?? "-"}</td>
                    <td className="py-2 pr-3 text-right text-surface-600">Rs. {Number(e.rate_per_liter).toFixed(1)}</td>
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