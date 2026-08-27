import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { StatCard } from "@/components/dashboard/stat-card";
import { DateRangeFilter } from "@/components/dashboard/date-range-filter";
import { isDateRangeKey, getDateRange, type DateRangeKey } from "@/lib/utils/dashboard-filters";
import { TrendingUp, TrendingDown, Wallet, Landmark } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function FinanceReportPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const params = await searchParams;
  const range: DateRangeKey = isDateRangeKey(params.range) ? params.range : "month";
  const { start, end } = getDateRange(range);
  const supabase = createClient();

  const { data: accounts } = await supabase
    .from("finance_accounts")
    .select("id, name, account_type, current_balance")
    .eq("is_active", true)
    .order("name");

  const { data: transactions } = await supabase
    .from("finance_transactions")
    .select("id, account_id, transaction_type, category, amount, transaction_date, notes")
    .gte("transaction_date", start.toISOString().slice(0, 10))
    .lte("transaction_date", end.toISOString().slice(0, 10))
    .order("transaction_date", { ascending: false })
    .limit(200);

  const accountMap = new Map((accounts ?? []).map((a) => [a.id, a.name]));

  const totalIncome = (transactions ?? [])
    .filter((t) => t.transaction_type === "income")
    .reduce((sum, t) => sum + Number(t.amount ?? 0), 0);
  const totalExpense = (transactions ?? [])
    .filter((t) => t.transaction_type === "expense")
    .reduce((sum, t) => sum + Number(t.amount ?? 0), 0);
  const netCashFlow = totalIncome - totalExpense;
  const totalBalance = (accounts ?? []).reduce((sum, a) => sum + Number(a.current_balance ?? 0), 0);

  const byCategory = new Map<string, number>();
  (transactions ?? [])
    .filter((t) => t.transaction_type === "expense")
    .forEach((t) => {
      const cat = t.category ?? "Uncategorized";
      byCategory.set(cat, (byCategory.get(cat) ?? 0) + Number(t.amount ?? 0));
    });
  const topExpenseCategories = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  const rows = (transactions ?? []).slice(0, 50).map((t) => ({
    id: t.id,
    date: t.transaction_date,
    account: accountMap.get(t.account_id) ?? "-",
    type: t.transaction_type,
    category: t.category ?? "-",
    amount: Number(t.amount ?? 0),
    notes: t.notes ?? "-",
  }));

  function typeTone(type: string) {
    if (type === "income" || type === "transfer_in") return "text-green-600";
    return "text-red-600";
  }

  return (
    <div>
      <PageHeader title="Finance Report" description="Company-wide cash book — income, expenses, and account balances" />

      <div className="mt-4">
        <DateRangeFilter current={range} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Income" value={`Rs. ${totalIncome.toLocaleString()}`} icon={TrendingUp} tone="brand" />
        <StatCard label="Total Expense" value={`Rs. ${totalExpense.toLocaleString()}`} icon={TrendingDown} tone="warn" />
        <StatCard
          label="Net Cash Flow"
          value={`${netCashFlow >= 0 ? "+" : ""}Rs. ${netCashFlow.toLocaleString()}`}
          icon={Wallet}
          tone={netCashFlow >= 0 ? "brand" : "warn"}
        />
        <StatCard label="Total Balance (All Accounts)" value={`Rs. ${totalBalance.toLocaleString()}`} icon={Landmark} tone="purple" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
          <h2 className="mb-4 font-display text-base font-semibold text-surface-900 dark:text-surface-100">Account Balances</h2>
          {(accounts ?? []).length === 0 ? (
            <p className="text-sm text-surface-400">No accounts yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {(accounts ?? []).map((a) => (
                <li key={a.id} className="flex items-center justify-between border-b border-surface-50 pb-2 last:border-0">
                  <span className="capitalize text-surface-700">{a.name} <span className="text-xs text-surface-400">({a.account_type})</span></span>
                  <span className="font-medium text-surface-900">Rs. {Number(a.current_balance ?? 0).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
          <h2 className="mb-4 font-display text-base font-semibold text-surface-900 dark:text-surface-100">Top Expense Categories</h2>
          {topExpenseCategories.length === 0 ? (
            <p className="text-sm text-surface-400">No expenses in this period.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {topExpenseCategories.map(([cat, amount]) => (
                <li key={cat} className="flex items-center justify-between border-b border-surface-50 pb-2 last:border-0">
                  <span className="text-surface-700">{cat}</span>
                  <span className="font-medium text-surface-900">Rs. {amount.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="lg:col-span-1 rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900 lg:col-span-3">
        </div>
      </div>

      <div className="mt-6 rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <h2 className="mb-4 font-display text-base font-semibold text-surface-900 dark:text-surface-100">Recent Transactions</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-surface-400">No transactions in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-surface-100 text-xs text-surface-500">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Account</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Category</th>
                  <th className="py-2 pr-3">Notes</th>
                  <th className="py-2 pr-3">Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-surface-50 last:border-0">
                    <td className="py-2 pr-3 text-surface-500">{r.date}</td>
                    <td className="py-2 pr-3 text-surface-700">{r.account}</td>
                    <td className={`py-2 pr-3 capitalize ${typeTone(r.type)}`}>{r.type.replace("_", " ")}</td>
                    <td className="py-2 pr-3 text-surface-600">{r.category}</td>
                    <td className="py-2 pr-3 text-surface-500">{r.notes}</td>
                    <td className={`py-2 pr-3 font-medium ${typeTone(r.type)}`}>Rs. {r.amount.toLocaleString()}</td>
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