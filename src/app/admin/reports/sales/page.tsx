import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { StatCard } from "@/components/dashboard/stat-card";
import { DateRangeFilter } from "@/components/dashboard/date-range-filter";
import { BranchFilter } from "@/components/dashboard/branch-filter";
import { isDateRangeKey, getDateRange, type DateRangeKey } from "@/lib/utils/dashboard-filters";
import { Wallet, CreditCard, Landmark, ShoppingCart, ClipboardList, TrendingUp } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

export default async function SalesReportPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; branch?: string }>;
}) {
  const params = await searchParams;
  const range: DateRangeKey = isDateRangeKey(params.range) ? params.range : "month";
  const branchId = params.branch || "";
  const lang = getLanguageFromCookies("rm");
  const { start, end } = getDateRange(range);
  const supabase = createClient();

  const { data: branches } = await supabase.from("branches").select("id, name").eq("is_active", true).order("name");

  let salesQuery = supabase
    .from("pos_sales")
    .select("id, total_amount, payment_mode, created_at, branch_id, created_by, branches(name), dealers(business_name)")
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString())
    .order("created_at", { ascending: false });
  if (branchId) salesQuery = salesQuery.eq("branch_id", branchId);

  const { data: sales } = await salesQuery.limit(200);

  const cashierIds = [...new Set((sales ?? []).map((s) => s.created_by).filter(Boolean))];
  const { data: cashiers } = cashierIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", cashierIds)
    : { data: [] };
  const cashierMap = new Map((cashiers ?? []).map((c) => [c.id, c.full_name]));

  const totalSales = (sales ?? []).reduce((sum, s) => sum + Number(s.total_amount ?? 0), 0);
  const totalCount = (sales ?? []).length;
  const avgSale = totalCount > 0 ? totalSales / totalCount : 0;

  const byMode: Record<string, number> = { cash: 0, khata: 0, split: 0, bank: 0, kisan_card: 0 };
  (sales ?? []).forEach((s: any) => {
    byMode[s.payment_mode] = (byMode[s.payment_mode] ?? 0) + Number(s.total_amount ?? 0);
  });

  const rows = (sales ?? []).slice(0, 50).map((s: any) => {
    const branch = Array.isArray(s.branches) ? s.branches[0] : s.branches;
    const dealer = Array.isArray(s.dealers) ? s.dealers[0] : s.dealers;
    return {
      id: s.id,
      date: s.created_at,
      location: branch?.name ?? dealer?.business_name ?? "-",
      cashier: cashierMap.get(s.created_by) ?? "-",
      paymentMode: s.payment_mode,
      amount: Number(s.total_amount ?? 0),
    };
  });

  return (
    <div>
      <PageHeader title={t("rs_title", lang)} description="Sales across all branches and dealers" />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <DateRangeFilter current={range} />
        <BranchFilter branches={branches ?? []} current={branchId} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label={t("rs_total_sales", lang)} value={`Rs. ${totalSales.toLocaleString()}`} icon={TrendingUp} tone="brand" />
        <StatCard label={t("rs_transactions", lang)} value={String(totalCount)} icon={ClipboardList} tone="blue" />
        <StatCard label={t("rs_avg_sale", lang)} value={`Rs. ${avgSale.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} icon={ShoppingCart} tone="purple" />
        <StatCard label={t("c_cash", lang)} value={`Rs. ${byMode.cash.toLocaleString()}`} icon={Wallet} tone="brand" />
        <StatCard label={t("rs_khata_split", lang)} value={`Rs. ${(byMode.khata + byMode.split).toLocaleString()}`} icon={CreditCard} tone="warn" />
        <StatCard label={t("rs_bank_kisan_card", lang)} value={`Rs. ${(byMode.bank + byMode.kisan_card).toLocaleString()}`} icon={Landmark} tone="orange" />
      </div>

      <div className="mt-6 rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <h2 className="mb-4 font-display text-base font-semibold text-surface-900 dark:text-surface-100">{t("rs_recent_sales", lang)}</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-surface-400">{t("rs_no_sales_period", lang)}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-surface-100 text-xs text-surface-500">
                  <th className="py-2 pr-3">{t("c_date", lang)}</th>
                  <th className="py-2 pr-3">{t("c_location", lang)}</th>
                  <th className="py-2 pr-3">{t("rs_cashier", lang)}</th>
                  <th className="py-2 pr-3">{t("c_payment_mode", lang)}</th>
                  <th className="py-2 pr-3">{t("c_amount", lang)}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-surface-50 last:border-0">
                    <td className="py-2 pr-3 text-surface-500">{new Date(r.date).toLocaleString()}</td>
                    <td className="py-2 pr-3 text-surface-700">{r.location}</td>
                    <td className="py-2 pr-3 text-surface-700">{r.cashier}</td>
                    <td className="py-2 pr-3 capitalize text-surface-600">{r.paymentMode.replace("_", " ")}</td>
                    <td className="py-2 pr-3 font-medium text-surface-900">Rs. {r.amount.toLocaleString()}</td>
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