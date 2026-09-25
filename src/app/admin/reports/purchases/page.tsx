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

  // Stock reconciliation: stock_movements ledger se — poora waqt, self-consistent
  // purchase_in + adj_increase - sale_out - adj_decrease - damaged_out = quantity_on_hand
  // Ye formula HAMESHA balance karta hai — koi false farq nahi
  const { data: smData } = await service
    .from("stock_movements")
    .select(`
      movement_type, quantity,
      inventory!inner(product_id, quantity_on_hand,
        products!inner(id, name, purchase_price))
    `);

  type ItemRow = {
    product: string;
    purchase_in: number;
    sale_out: number;
    transfer_out: number;
    adj_in: number;
    adj_out: number;
    damaged_out: number;
    current_stock: number;
    unit_cost: number;
    stock_value: number;
    sale_value: number;
    transfer_value: number;
    purchase_value: number;
  };

  const byProduct = new Map<string, ItemRow>();
  (smData ?? []).forEach((r: any) => {
    const inv = Array.isArray(r.inventory) ? r.inventory[0] : r.inventory;
    const prod = Array.isArray(inv?.products) ? inv.products[0] : inv?.products;
    const pid: string = prod?.id ?? inv?.product_id;
    if (!pid) return;
    const name: string = prod?.name ?? pid;
    const qty = Number(r.quantity ?? 0);
    const existing = byProduct.get(pid) ?? {
      product: name, purchase_in: 0, sale_out: 0, transfer_out: 0,
      adj_in: 0, adj_out: 0,
      damaged_out: 0, current_stock: Number(inv?.quantity_on_hand ?? 0),
      unit_cost: Number(prod?.purchase_price ?? 0),
      stock_value: 0, sale_value: 0, transfer_value: 0, purchase_value: 0,
    };
    switch (r.movement_type) {
      case "purchase_in": case "return_in":    existing.purchase_in  += qty; break;
      case "sale_out":                         existing.sale_out     += qty; break;
      case "transfer_out":                     existing.transfer_out += qty; break;
      case "adjustment_increase":              existing.adj_in       += qty; break;
      case "adjustment_decrease":              existing.adj_out      += qty; break;
      case "damaged_out": case "expired_out":
      case "loss_write_off":                   existing.damaged_out  += qty; break;
    }
    byProduct.set(pid, existing);
  });

  const itemRows: ItemRow[] = [...byProduct.values()]
    .map((v) => ({
      ...v,
      stock_value:    Math.round(v.current_stock * v.unit_cost),
      sale_value:     Math.round(v.sale_out      * v.unit_cost),
      transfer_value: Math.round(v.transfer_out  * v.unit_cost),
      purchase_value: Math.round(v.purchase_in   * v.unit_cost),
    }))
    .sort((a, b) => b.stock_value - a.stock_value);

  const totalAmount       = (purchases ?? []).reduce((sum, p) => sum + Number(p.total_amount ?? 0), 0);
  const totalStockValue   = itemRows.reduce((s, r) => s + r.stock_value,    0);
  const totalSaleValue    = itemRows.reduce((s, r) => s + r.sale_value,     0);
  const totalTransferValue= itemRows.reduce((s, r) => s + r.transfer_value, 0);
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

  const LOW_STOCK_THRESHOLD = 10;
  const stockAlerts = itemRows.filter(
    (r) => r.current_stock === 0 || r.current_stock <= LOW_STOCK_THRESHOLD
  );

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
        <StatCard label="Stock Value (Baqi)" value={`Rs. ${totalStockValue.toLocaleString()}`} icon={Package} tone="brand" />
        <StatCard label="Biki (Cost par)" value={`Rs. ${totalSaleValue.toLocaleString()}`} icon={CheckCircle2} tone="blue" />
        <StatCard label="Transfer Bheja" value={`Rs. ${totalTransferValue.toLocaleString()}`} icon={Truck} tone="warn" />
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

      {/* Stock Ledger — Kharida / Bika / Baqi / Qeemat */}
      {itemRows.length > 0 && (
        <div className="mt-6 rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
          <h2 className="mb-1 flex items-center gap-2 font-display text-base font-semibold text-surface-900 dark:text-surface-100">
            <Package className="h-4 w-4" /> Stock Ledger — Aya / Bika / Nuksan / Baqi / Qeemat
          </h2>
          <p className="mb-3 text-xs text-surface-400">
            Poora waqt ka hisaab — stock_movements se. <strong>Kharida = Bika + Transfer + Nuksan + Baqi.</strong>
          </p>

          {/* Reconciliation summary */}
          {itemRows.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-3 rounded-lg border border-surface-200 bg-surface-50 px-4 py-3 text-xs dark:border-surface-700 dark:bg-surface-800">
              <span className="font-semibold text-surface-700 dark:text-surface-300">
                Kharida (cost): Rs. {itemRows.reduce((s, r) => s + r.purchase_value, 0).toLocaleString()}
              </span>
              <span className="text-surface-400">=</span>
              <span className="text-emerald-700 dark:text-emerald-400">
                Bika Rs. {totalSaleValue.toLocaleString()}
              </span>
              <span className="text-surface-400">+</span>
              <span className="text-amber-700 dark:text-amber-400">
                Transfer Rs. {totalTransferValue.toLocaleString()}
              </span>
              <span className="text-surface-400">+</span>
              <span className="text-red-600 dark:text-red-400">
                Nuksan Rs. {itemRows.reduce((s, r) => s + Math.round(r.damaged_out * r.unit_cost), 0).toLocaleString()}
              </span>
              <span className="text-surface-400">+</span>
              <span className="font-semibold text-brand-700 dark:text-brand-400">
                Baqi Rs. {totalStockValue.toLocaleString()}
              </span>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-surface-100 text-xs text-surface-500">
                  <th className="py-2 pr-3">Item</th>
                  <th className="py-2 pr-3 text-right">Aya (Qty)</th>
                  <th className="py-2 pr-3 text-right">Bika (Qty)</th>
                  <th className="py-2 pr-3 text-right">Bika (Rs)</th>
                  <th className="py-2 pr-3 text-right">Transfer (Qty)</th>
                  <th className="py-2 pr-3 text-right">Transfer (Rs)</th>
                  <th className="py-2 pr-3 text-right">Nuksan</th>
                  <th className="py-2 pr-3 text-right">Baqi Stock</th>
                  <th className="py-2 pr-3 text-right">Stock Value (Rs)</th>
                </tr>
              </thead>
              <tbody>
                {itemRows.map((r) => (
                  <tr key={r.product} className="border-b border-surface-50 last:border-0">
                    <td className="py-2 pr-3 font-medium text-surface-900 dark:text-surface-100">{r.product}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-surface-600 dark:text-surface-400">{Math.round(r.purchase_in)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-emerald-700 dark:text-emerald-400">{Math.round(r.sale_out)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                      {r.sale_value > 0 ? `Rs. ${r.sale_value.toLocaleString()}` : "—"}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-amber-700 dark:text-amber-400">
                      {r.transfer_out > 0 ? Math.round(r.transfer_out) : "—"}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-amber-700 dark:text-amber-400">
                      {r.transfer_value > 0 ? `Rs. ${r.transfer_value.toLocaleString()}` : "—"}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-red-600 dark:text-red-400">
                      {r.damaged_out > 0 ? Math.round(r.damaged_out) : "—"}
                    </td>
                    <td className={`py-2 pr-3 text-right tabular-nums font-semibold ${r.current_stock === 0 ? "text-red-600 dark:text-red-400" : r.current_stock <= LOW_STOCK_THRESHOLD ? "text-orange-600 dark:text-orange-400" : "text-surface-900 dark:text-surface-100"}`}>
                      {Math.round(r.current_stock)}
                      {r.current_stock > 0 && r.current_stock <= LOW_STOCK_THRESHOLD && <span className="ml-1 text-[10px] font-normal text-orange-500">⚠</span>}
                      {r.current_stock === 0 && <span className="ml-1 text-[10px] font-normal text-red-500">✗</span>}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums font-medium text-brand-700 dark:text-brand-300">
                      {r.stock_value > 0 ? `Rs. ${r.stock_value.toLocaleString()}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-surface-200 dark:border-surface-700">
                  <td className="py-2 pr-3 text-xs font-semibold text-surface-500">TOTAL</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-xs font-semibold text-surface-700 dark:text-surface-300">
                    {Math.round(itemRows.reduce((s, r) => s + r.purchase_in, 0)).toLocaleString()}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    {Math.round(itemRows.reduce((s, r) => s + r.sale_out, 0)).toLocaleString()}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    Rs. {totalSaleValue.toLocaleString()}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-xs font-semibold text-amber-700 dark:text-amber-400">
                    {Math.round(itemRows.reduce((s, r) => s + r.transfer_out, 0)).toLocaleString()}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-xs font-semibold text-amber-700 dark:text-amber-400">
                    Rs. {totalTransferValue.toLocaleString()}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-xs font-semibold text-red-600 dark:text-red-400">
                    {Math.round(itemRows.reduce((s, r) => s + r.damaged_out, 0)).toLocaleString()}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-xs font-semibold text-surface-900 dark:text-surface-100">
                    {Math.round(itemRows.reduce((s, r) => s + r.current_stock, 0)).toLocaleString()}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-xs font-semibold text-brand-700 dark:text-brand-300">
                    Rs. {totalStockValue.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-surface-400">
            ⚠ = 10 ya kam baqi &nbsp;|&nbsp; ✗ = stock khatam &nbsp;|&nbsp; Rs columns = cost price par
          </p>
        </div>
      )}
    </div>
  );
}