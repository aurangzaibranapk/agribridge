import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { StatCard } from "@/components/dashboard/stat-card";
import { DateRangeFilter } from "@/components/dashboard/date-range-filter";
import { BranchFilter } from "@/components/dashboard/branch-filter";
import { isDateRangeKey, getDateRange, type DateRangeKey } from "@/lib/utils/dashboard-filters";
import { ShoppingCart, ClipboardList, Clock, CheckCircle2, Truck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PurchasesReportPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; branch?: string }>;
}) {
  const params = await searchParams;
  const range: DateRangeKey = isDateRangeKey(params.range) ? params.range : "month";
  const branchId = params.branch || "";
  const { start, end } = getDateRange(range);
  const supabase = createClient();

  const { data: branches } = await supabase.from("branches").select("id, name").eq("is_active", true).order("name");

  let purchasesQuery = supabase
    .from("purchases")
    .select("id, purchase_number, purchase_date, status, total_amount, branch_id, suppliers(name), branches(name)")
    .gte("purchase_date", start.toISOString().slice(0, 10))
    .lte("purchase_date", end.toISOString().slice(0, 10))
    .order("purchase_date", { ascending: false });
  if (branchId) purchasesQuery = purchasesQuery.eq("branch_id", branchId);

  const { data: purchases } = await purchasesQuery.limit(200);

  const totalAmount = (purchases ?? []).reduce((sum, p) => sum + Number(p.total_amount ?? 0), 0);
  const totalCount = (purchases ?? []).length;
  const pendingCount = (purchases ?? []).filter((p) => p.status === "pending").length;
  const receivedCount = (purchases ?? []).filter((p) => p.status === "received").length;

  const bySupplier = new Map<string, number>();
  (purchases ?? []).forEach((p: any) => {
    const supplier = Array.isArray(p.suppliers) ? p.suppliers[0] : p.suppliers;
    const name = supplier?.name ?? "Unknown";
    bySupplier.set(name, (bySupplier.get(name) ?? 0) + Number(p.total_amount ?? 0));
  });
  const topSuppliers = [...bySupplier.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  const rows = (purchases ?? []).slice(0, 50).map((p: any) => {
    const supplier = Array.isArray(p.suppliers) ? p.suppliers[0] : p.suppliers;
    const branch = Array.isArray(p.branches) ? p.branches[0] : p.branches;
    return {
      id: p.id,
      poNumber: p.purchase_number,
      date: p.purchase_date,
      supplier: supplier?.name ?? "-",
      branch: branch?.name ?? "-",
      status: p.status,
      amount: Number(p.total_amount ?? 0),
    };
  });

  return (
    <div>
      <PageHeader title="Purchases Report" description="Purchase orders across all branches" />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <DateRangeFilter current={range} />
        <BranchFilter branches={branches ?? []} current={branchId} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Total Purchases" value={`Rs. ${totalAmount.toLocaleString()}`} icon={ShoppingCart} tone="orange" />
        <StatCard label="Purchase Orders" value={String(totalCount)} icon={ClipboardList} tone="brand" />
        <StatCard label="Pending" value={String(pendingCount)} icon={Clock} tone="warn" />
        <StatCard label="Received" value={String(receivedCount)} icon={CheckCircle2} tone="blue" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
          <h2 className="mb-4 font-display text-base font-semibold text-surface-900 dark:text-surface-100">Purchase Orders</h2>
          {rows.length === 0 ? (
            <p className="text-sm text-surface-400">No purchases in this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-surface-100 text-xs text-surface-500">
                    <th className="py-2 pr-3">PO #</th>
                    <th className="py-2 pr-3">Supplier</th>
                    <th className="py-2 pr-3">Branch</th>
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-surface-50 last:border-0">
                      <td className="py-2 pr-3 font-medium text-surface-900">{r.poNumber}</td>
                      <td className="py-2 pr-3 text-surface-600">{r.supplier}</td>
                      <td className="py-2 pr-3 text-surface-600">{r.branch}</td>
                      <td className="py-2 pr-3 text-surface-500">{r.date}</td>
                      <td className="py-2 pr-3 capitalize text-surface-600">{r.status}</td>
                      <td className="py-2 pr-3 font-medium text-surface-900">Rs. {r.amount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
          <h2 className="mb-4 flex items-center gap-2 font-display text-base font-semibold text-surface-900 dark:text-surface-100">
            <Truck className="h-4 w-4" /> Top Suppliers
          </h2>
          {topSuppliers.length === 0 ? (
            <p className="text-sm text-surface-400">No data yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {topSuppliers.map(([name, amount]) => (
                <li key={name} className="flex items-center justify-between border-b border-surface-50 pb-2 last:border-0">
                  <span className="text-surface-700">{name}</span>
                  <span className="font-medium text-surface-900">Rs. {amount.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}