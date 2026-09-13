import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { StatCard } from "@/components/dashboard/stat-card";
import { BranchFilter } from "@/components/dashboard/branch-filter";
import { Package, PackageX, Boxes, AlertTriangle } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

export default async function InventoryReportPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string }>;
}) {
  const params = await searchParams;
  const branchId = params.branch || "";
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const { data: branches } = await supabase.from("branches").select("id, name").eq("is_active", true).order("name");

  let warehouseQuery = supabase.from("warehouses").select("id, branch_id");
  if (branchId) warehouseQuery = warehouseQuery.eq("branch_id", branchId);
  const { data: warehouses } = await warehouseQuery;
  const warehouseIds = (warehouses ?? []).map((w) => w.id);

  const { data: productsData } = await supabase
    .from("products")
    .select("id, name, pack_size, purchase_price, is_available, min_stock_threshold, categories(name)")
    .eq("is_deleted", false);

  let inventoryQuery = supabase.from("inventory").select("product_id, quantity_on_hand, warehouse_id");
  if (branchId) inventoryQuery = inventoryQuery.in("warehouse_id", warehouseIds.length ? warehouseIds : ["-"]);
  const { data: inventoryRows } = await inventoryQuery;

  const stockByProduct = new Map<string, number>();
  (inventoryRows ?? []).forEach((row) => {
    const cur = stockByProduct.get(row.product_id) ?? 0;
    stockByProduct.set(row.product_id, cur + Number(row.quantity_on_hand ?? 0));
  });

  const totalProducts = (productsData ?? []).length;
  const activeProducts = (productsData ?? []).filter((p) => p.is_available).length;
  const outOfStockProducts = (productsData ?? []).filter((p) => (stockByProduct.get(p.id) ?? 0) <= 0).length;
  const totalStockValue = (productsData ?? []).reduce(
    (sum, p) => sum + (stockByProduct.get(p.id) ?? 0) * Number(p.purchase_price ?? 0),
    0
  );

  const lowStockProducts = (productsData ?? [])
    .filter((p) => Number(p.min_stock_threshold) > 0 && (stockByProduct.get(p.id) ?? 0) <= Number(p.min_stock_threshold))
    .map((p) => ({
      id: p.id,
      name: p.name,
      category: (p.categories as unknown as { name: string }[] | null)?.[0]?.name ?? "-",
      current: stockByProduct.get(p.id) ?? 0,
      minStock: Number(p.min_stock_threshold),
    }));

  const rows = (productsData ?? [])
    .map((p) => ({
      id: p.id,
      name: p.name,
      packSize: p.pack_size,
      category: (p.categories as unknown as { name: string }[] | null)?.[0]?.name ?? "-",
      stock: stockByProduct.get(p.id) ?? 0,
      value: (stockByProduct.get(p.id) ?? 0) * Number(p.purchase_price ?? 0),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 50);

  return (
    <div>
      <PageHeader title={t("ri_title", lang)} description="Stock levels and value across all branches" />

      <div className="mt-4">
        <BranchFilter branches={branches ?? []} current={branchId} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label={t("db_total_products", lang)} value={String(totalProducts)} icon={Package} tone="brand" />
        <StatCard label={t("db_active_products", lang)} value={String(activeProducts)} icon={Package} tone="blue" />
        <StatCard label={t("db_out_of_stock", lang)} value={String(outOfStockProducts)} icon={PackageX} tone="warn" />
        <StatCard label={t("c_total_stock_value", lang)} value={`Rs. ${totalStockValue.toLocaleString()}`} icon={Boxes} tone="purple" />
      </div>

      {lowStockProducts.length > 0 && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-surface-800 dark:bg-surface-900">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-red-800 dark:text-red-300">
            <AlertTriangle className="h-3.5 w-3.5" />{t("at_low_stock", lang)}</p>
          <ul className="space-y-1 text-xs text-red-800 dark:text-red-300">
            {lowStockProducts.map((p) => (
              <li key={p.id}>
                {p.name} ({p.category}) — {p.current} in stock, minimum {p.minStock}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <h2 className="mb-4 font-display text-base font-semibold text-surface-900 dark:text-surface-100">{t("ri_by_product", lang)}</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-surface-400">{t("ri_no_products", lang)}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-surface-100 text-xs text-surface-500">
                  <th className="py-2 pr-3">{t("c_product", lang)}</th>
                  <th className="py-2 pr-3">{t("c_category", lang)}</th>
                  <th className="py-2 pr-3 text-right">{t("c_stock", lang)}</th>
                  <th className="py-2 pr-3 text-right">{t("c_value", lang)}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-surface-50 last:border-0">
                    <td className="py-2 pr-3 font-medium text-surface-900">
                      {r.name}{r.packSize ? ` (${r.packSize})` : ""}
                    </td>
                    <td className="py-2 pr-3 text-surface-600">{r.category}</td>
                    <td className="py-2 pr-3 text-right text-surface-700">{r.stock.toLocaleString()}</td>
                    <td className="py-2 pr-3 text-right font-medium text-surface-900">Rs. {r.value.toLocaleString()}</td>
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