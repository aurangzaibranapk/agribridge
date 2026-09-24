import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { StatCard } from "@/components/dashboard/stat-card";
import { DateRangeFilter } from "@/components/dashboard/date-range-filter";
import { isDateRangeKey, getDateRange, type DateRangeKey } from "@/lib/utils/dashboard-filters";
import { CreditCard, Banknote, Wallet, UserCheck, AlertTriangle } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

function formatCategory(cat: string): string {
  return cat.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

export default async function CreditReportPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const params = await searchParams;
  const range: DateRangeKey = isDateRangeKey(params.range) ? params.range : "month";
  const { start, end } = getDateRange(range);
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const { data: ledgerRows } = await supabase
    .from("farmer_credit_ledger")
    .select("farmer_id, source_type, ledger_type, amount, created_at");

  let totalCreditGiven = 0;
  let totalRepaid = 0;
  const farmersWithCreditSet = new Set<string>();
  const byCategory = new Map<string, number>();

  (ledgerRows ?? []).forEach((row) => {
    const amt = Number(row.amount ?? 0);
    if (row.ledger_type === "debit") {
      totalCreditGiven += amt;
      byCategory.set(row.source_type, (byCategory.get(row.source_type) ?? 0) + amt);
    } else {
      totalRepaid += amt;
    }
    farmersWithCreditSet.add(row.farmer_id);
  });
  const totalOutstanding = totalCreditGiven - totalRepaid;

  const { data: periodLedgerRows } = await supabase
    .from("farmer_credit_ledger")
    .select("ledger_type, amount")
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString());

  let creditGivenThisPeriod = 0;
  let repaidThisPeriod = 0;
  (periodLedgerRows ?? []).forEach((row) => {
    const amt = Number(row.amount ?? 0);
    if (row.ledger_type === "debit") creditGivenThisPeriod += amt;
    else repaidThisPeriod += amt;
  });

  const { count: pendingCreditRequests } = await supabase
    .from("credit_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const { data: staleRequestsRaw } = await supabase
    .from("credit_requests")
    .select("id, farmer_id, category, total_amount, created_at")
    .eq("status", "pending")
    .lte("created_at", threeDaysAgo)
    .order("created_at", { ascending: true })
    .limit(10);

  const staleFarmerIds = [...new Set((staleRequestsRaw ?? []).map((r) => r.farmer_id))];
  const { data: staleFarmerNames } = await supabase
    .from("farmers")
    .select("id, full_name")
    .in("id", staleFarmerIds.length ? staleFarmerIds : ["-"]);
  const farmerMap = new Map((staleFarmerNames ?? []).map((f) => [f.id, f.full_name ?? "Farmer"]));

  const staleRequests = (staleRequestsRaw ?? []).map((r) => ({
    id: r.id,
    farmerName: farmerMap.get(r.farmer_id) ?? "Farmer",
    category: r.category,
    amount: Number(r.total_amount ?? 0),
    daysPending: Math.floor((Date.now() - new Date(r.created_at).getTime()) / (1000 * 60 * 60 * 24)),
  }));

  const categoryBreakdown = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div>
      <PageHeader title={t("rc_title", lang)} description="Farmer credit given, repaid, and outstanding" />

      <div className="mt-4">
        <DateRangeFilter current={range} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label={t("db_total_credit_given", lang)} value={`Rs. ${totalCreditGiven.toLocaleString()}`} icon={CreditCard} tone="blue" />
        <StatCard label={t("c_total_repaid", lang)} value={`Rs. ${totalRepaid.toLocaleString()}`} icon={Banknote} tone="brand" />
        <StatCard label={t("c_outstanding", lang)} value={`Rs. ${totalOutstanding.toLocaleString()}`} icon={Wallet} tone="orange" />
        <StatCard label={t("db_farmers_with_credit", lang)} value={String(farmersWithCreditSet.size)} icon={UserCheck} tone="purple" />
        <StatCard label={t("db_pending_requests", lang)} value={String(pendingCreditRequests ?? 0)} icon={AlertTriangle} tone="warn" />
      </div>

      <p className="mt-3 text-xs text-surface-500">
        This period: credit given Rs. {creditGivenThisPeriod.toLocaleString()}, repaid Rs. {repaidThisPeriod.toLocaleString()}
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
          <h2 className="mb-4 font-display text-base font-semibold text-surface-900 dark:text-surface-100">{t("rc_by_category", lang)}</h2>
          {categoryBreakdown.length === 0 ? (
            <p className="text-sm text-surface-400">{t("rc_none_yet", lang)}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {categoryBreakdown.map(([cat, amount]) => (
                <li key={cat} className="flex items-center justify-between border-b border-surface-50 pb-2 last:border-0">
                  <span className="text-surface-700">{formatCategory(cat)}</span>
                  <span className="font-medium text-surface-900">Rs. {amount.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-card border border-amber-200 bg-amber-50 p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
          <h2 className="mb-4 flex items-center gap-1.5 font-display text-base font-semibold text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4" />{t("at_credit_alerts", lang)}</h2>
          {staleRequests.length === 0 ? (
            <p className="text-sm text-amber-700">{t("rc_no_overdue", lang)}</p>
          ) : (
            <ul className="space-y-1.5 text-sm text-amber-800 dark:text-amber-300">
              {staleRequests.map((r) => (
                <li key={r.id}>
                  {r.farmerName} — {formatCategory(r.category)} — Rs. {r.amount.toLocaleString()} ({r.daysPending} din se pending)
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}