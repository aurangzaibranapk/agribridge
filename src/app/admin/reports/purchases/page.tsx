import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader } from "@/components/ui/layout-primitives";
import { StatCard } from "@/components/dashboard/stat-card";
import { DateRangeFilter } from "@/components/dashboard/date-range-filter";
import { BranchFilter } from "@/components/dashboard/branch-filter";
import { isDateRangeKey, getDateRange, type DateRangeKey } from "@/lib/utils/dashboard-filters";
import { ShoppingCart, ClipboardList, Clock, CheckCircle2, Truck, Package, AlertTriangle } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { AutoRefresh } from "./auto-refresh";

export const dynamic = "force-dynamic";

export default async function PurchasesReportPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; branch?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const range: DateRangeKey = isDateRangeKey(params.range) ? params.range : "year";
  const branchId = params.branch || "";
  const lang = getLanguageFromCookies("rm");
  const { start, end } = getDateRange(range, params.from, params.to);
  const supabase = createClient();
  const service = createServiceClient();

  const { data: branches } = await supabase.from("branches").select("id, name").eq("is_active", true).order("name");

  let purchasesQuery = supabase
    .from("purchases")
    .select("id, purchase_number, purchase_date, status, total_amount, branch_id, suppliers(name), branches(name)")
    .gte("purchase_date", start.toISOString().slice(0, 10))
    .lte("purchase_date", end.toISOString().slice(0, 10))
    .order("purchase_date", { ascending: false });
  if (branchId) purchasesQuery = purchasesQuery.eq("branch_id", branchId);

  const { data: purchases } = await purchasesQuery.limit(200);

  // Item-level: kharida (date-filtered), bika (all-time), baqi stock
  const purchaseIds = (purchases ?? []).map((p) => p.id);
  let itemRows: {
    product: string;
    purchased_qty: number;
    purchased_amount: number;
    sold_qty: number;
    sold_amount: number;
    current_stock: number;
  }[] = [];

  if (purchaseIds.length > 0) {
    const { data: piData } = await service
      .from("purchase_items")
      .select("product_id, received_qty, line_total, products(name)")
      .in("purchase_id", purchaseIds);

    const productIds = [...new Set((piData ?? []).map((r: any) => r.product_id).filter(Boolean))];

    const [{ data: soldData }, { data: invData }] = await Promise.all([
      productIds.length
        ? service.from("pos_sale_items").select("product_id, quantity, subtotal").in("product_id", productIds)
        : Promise.resolve({ data: [] }),
      productIds.length
        ? service.from("inventory").select("product_id, quantity_on_hand").in("product_id", productIds)
        : Promise.resolve({ data: [] }),
    ]);

    // Aggregate by product
    const byProduct = new Map<string, { name: string; pQty: number; pAmt: number; sQty: number; sAmt: number; stock: number }>();
    (piData ?? []).forEach((r: any) => {
      const pid = r.product_id;
      if (!pid) return;
      const name = (Array.isArray(r.products) ? r.products[0] : r.products)?.name ?? pid;
      const existing = byProduct.get(pid) ?? { name, pQty: 0, pAmt: 0, sQty: 0, sAmt: 0, stock: 0 };
      existing.pQty += Number(r.received_qty ?? 0);
      existing.pAmt += Number(r.line_total ?? 0);
      byProduct.set(pid, existing);
    });
    (soldData ?? []).forEach((r: any) => {
      const existing = byProduct.get(r.product_id);
      if (!existing) return;
      existing.sQty += Number(r.quantity ?? 0);
      existing.sAmt += Number(r.subtotal ?? 0);
    });
    (invData ?? []).forEach((r: any) => {
      const existing = byProduct.get(r.product_id);
      if (!existing) return;
      existing.stock += Number(r.quantity_on_hand ?? 0);
    });

    itemRows = [...byProduct.values()]
      .map((v) => ({ product: v.name, purchased_qty: v.pQty, purchased_amount: v.pAmt, sold_qty: v.sQty, sold_amount: v.sAmt, current_stock: v.stock }))
      .sort((a, b) => b.purchased_amount - a.purchased_amount);
  }

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

  // Stock alert: 0 ya kam (≤10) aur over-stocked (bika zyada purchased se)
  const LOW_STOCK_THRESHOLD = 10;
  const stockAlerts = itemRows.filter((r) => r.current_stock <= LOW_STOCK_THRESHOLD || r.sold_qty > r.purchased_qty);

  return (
    <div>
      <AutoRefresh intervalSeconds={60} />
      <PageHeader title={t("rpu_title", lang)} description="Purchase orders across all branches" />

      {/* Stock Alert Banner */}
      {stockAlerts.length > 0 && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/20">
          <div className="mb-2 flex items-center gap-2 font-semibold text-red-700 dark:text-red-400">
            <AlertTriangle className="h-4 w-4" />
            Stock Alert — {stockAlerts.length} item{stockAlerts.length > 1 ? "s" : ""} par dhyan dein
          </div>
          <ul className="space-y-1 text-sm text-red-700 dark:text-red-300">
            {stockAlerts.map((r) => (
              <li key={r.product} className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                <span className="font-medium">{r.product}</span>
                {r.current_stock === 0 && <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold dark:bg-red-900/40">Stock Khatam</span>}
                {r.current_stock > 0 && r.current_stock <= LOW_STOCK_THRESHOLD && (
                  <span className="rounded bg-orange-100 px-1.5 py-0.5 text-xs font-semibold text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
                    Sirf {Math.round(r.current_stock)} baqi
                  </span>
                )}
                {r.sold_qty > r.purchased_qty && (
                  <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold dark:bg-red-900/40">
                    Bika ({Math.round(r.sold_qty)}) &gt; Kharida ({Math.round(r.purchased_qty)})
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <DateRangeFilter current={range} from={params.from} to={params.to} />
        <BranchFilter branches={branches ?? []} current={branchId} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label={t("c_total_purchases", lang)} value={`Rs. ${totalAmount.toLocaleString()}`} icon={ShoppingCart} tone="orange" />
        <StatCard label={t("rpu_purchase_orders", lang)} value={String(totalCount)} icon={ClipboardList} tone="brand" />
        <StatCard label={t("c_pending", lang)} value={String(pendingCount)} icon={Clock} tone="warn" />
        <StatCard label={t("c_received", lang)} value={String(receivedCount)} icon={CheckCircle2} tone="blue" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
          <h2 className="mb-4 font-display text-base font-semibold text-surface-900 dark:text-surface-100">{t("rpu_purchase_orders", lang)}</h2>
          {rows.length === 0 ? (
            <p className="text-sm text-surface-400">{t("rpu_no_purchases", lang)}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-surface-100 text-xs text-surface-500">
                    <th className="py-2 pr-3">PO #</th>
                    <th className="py-2 pr-3">{t("c_supplier", lang)}</th>
                    <th className="py-2 pr-3">{t("c_branch", lang)}</th>
                    <th className="py-2 pr-3">{t("c_date", lang)}</th>
                    <th className="py-2 pr-3">{t("c_status", lang)}</th>
                    <th className="py-2 pr-3">{t("c_amount", lang)}</th>
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
            <Truck className="h-4 w-4" />{t("at_top_suppliers", lang)}</h2>
          {topSuppliers.length === 0 ? (
            <p className="text-sm text-surface-400">{t("rpu_no_data", lang)}</p>
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

      {/* Kharida vs Bika vs Baqi Stock */}
      {itemRows.length > 0 && (
        <div className="mt-6 rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
          <h2 className="mb-1 flex items-center gap-2 font-display text-base font-semibold text-surface-900 dark:text-surface-100">
            <Package className="h-4 w-4" /> Item-wise: Kharida / Bika / Baqi Stock
          </h2>
          <p className="mb-4 text-xs text-surface-400">Is muddat mein kharida gaya. Bika aur stock abhi ka (poora waqt).</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-surface-100 text-xs text-surface-500">
                  <th className="py-2 pr-3">Item</th>
                  <th className="py-2 pr-3 text-right">Kharida (Miqdar)</th>
                  <th className="py-2 pr-3 text-right">Kharida (Raqam)</th>
                  <th className="py-2 pr-3 text-right">Bika (Miqdar)</th>
                  <th className="py-2 pr-3 text-right">Bika (Raqam)</th>
                  <th className="py-2 pr-3 text-right">Baqi Stock</th>
                </tr>
              </thead>
              <tbody>
                {itemRows.map((r) => (
                  <tr key={r.product} className="border-b border-surface-50 last:border-0 hover:bg-surface-50 dark:border-surface-800 dark:hover:bg-surface-800/40">
                    <td className="py-2 pr-3 font-medium text-surface-900 dark:text-surface-100">{r.product}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-surface-600 dark:text-surface-400">{Math.round(r.purchased_qty).toLocaleString()}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-surface-700 dark:text-surface-300">Rs. {Math.round(r.purchased_amount).toLocaleString()}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-emerald-700 dark:text-emerald-400">{Math.round(r.sold_qty).toLocaleString()}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-emerald-700 dark:text-emerald-400">Rs. {Math.round(r.sold_amount).toLocaleString()}</td>
                    <td className={`py-2 pr-3 text-right tabular-nums font-semibold ${r.current_stock <= 5 ? "text-red-600 dark:text-red-400" : "text-surface-900 dark:text-surface-100"}`}>
                      {Math.round(r.current_stock).toLocaleString()}
                      {r.current_stock <= 5 && <span className="ml-1 text-[10px] font-normal">⚠</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-surface-400">Baqi stock 5 ya kam hy to lal rang mein dikhai deta hy — reorder karne ka waqt.</p>
        </div>
      )}
    </div>
  );
}